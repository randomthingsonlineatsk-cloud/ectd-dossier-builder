// Import of an IND package from the Clinical Trial Simulator (a separate app). The package holds
// the documents of an initial IND (21 CFR 312.23) with their eCTD placement: forms in 1.1, cover
// letter 1.2, general investigational plan 1.20, investigator's brochure 1.14.4.1, investigational
// labels 1.14.4.2, protocol in 5.3.3.1 or 5.3.3.2, summaries in 2.3 and 2.4.
// Keep in step with clinical-trial-simulator/src/application/ind.ts (indPackage, schema 1).
import { createSequence, placeDoc } from './ops.js';
import { makeDoc, seqByNumber, uid } from './model.js';
import { INDEX, isPlaceable } from './tree.js';

export const IND_PKG_KIND = 'clinical-trial-simulator/ind-package';
export const IND_PKG_SCHEMA = 1;
const FORM_BY_FILE = { 'fda-1571.pdf': 'fda-1571', 'fda-1572.pdf': 'fda-1572', 'fda-3674.pdf': 'fda-3674' };

export function parseIndPackage(text) {
  let d;
  try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('This file is not valid JSON.'); }
  if (d?.kind !== IND_PKG_KIND) throw new Error('This is not an IND package from the Clinical Trial Simulator.');
  if (d.schema > IND_PKG_SCHEMA) throw new Error('This IND package was made by a newer version of the Clinical Trial Simulator.');
  if (!Array.isArray(d.documents) || !d.documents.length) throw new Error('The IND package has no documents.');
  return d;
}

// Adds the IND documents to the library and places them in the selected draft sequence, or in a
// new original application. Returns the sequence, the placed documents and warnings.
export function importIndPackage(project, pkg, { seqNumber = null } = {}) {
  const warnings = [];
  if (pkg.region !== 'US') throw new Error('IND packages are for US projects only.');
  if (project.region !== 'US') throw new Error(`The package is for US; this project is for ${project.region}.`);
  if (project.appType !== 'ind') warnings.push(`This project is a ${String(project.appType).toUpperCase()}, not an IND. The documents are placed, but the checks will judge them against the ${String(project.appType).toUpperCase()} requirements.`);
  const chosen = seqNumber ? seqByNumber(project, seqNumber) : null;
  const seq = chosen && chosen.status === 'draft' ? chosen : createSequence(project, {
    submissionType: pkg.submission?.submissionType ?? 'original-application',
    subType: pkg.submission?.subType ?? 'application',
    description: String(pkg.submission?.description ?? 'Initial IND').slice(0, 240),
  });
  const placed = [];
  for (const d of pkg.documents) {
    if (!INDEX.map[d.section] || !isPlaceable(d.section)) { warnings.push(`${d.title}: section ${d.section} is not a place for documents in this app's tree; skipped.`); continue; }
    const id = `cts-${uid()}`;
    const form = d.form ?? FORM_BY_FILE[d.fileName];
    project.documents[id] = makeDoc({ id, section: d.section, region: d.section.startsWith('1') ? 'US' : null, ...(form ? { form } : {}), title: d.title, fileName: d.fileName, pages: d.pages ?? 2, generated: true, content: d.content ?? '', source: 'Clinical Trial Simulator' });
    placeDoc(project, seq.number, id, d.section, 'new');
    placed.push({ code: d.section, title: d.title });
  }
  seq.indPackage = { importedAt: new Date().toISOString(), drug: pkg.product?.drug ?? null, sponsor: pkg.sponsor ?? null, placed, from: { userId: pkg.userId ?? null, classId: pkg.classId ?? null } };
  return { seq, placed, warnings };
}
