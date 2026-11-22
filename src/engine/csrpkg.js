// Import of a clinical study report from the CSR & Narrative Studio (a separate app). The package
// holds the report for Module 5.3.5.1 (study reports of controlled clinical studies) as documents
// with their study tagging, split as ICH E3 granularity expects: the synopsis, the body, section 14,
// and the appendices the Studio holds (16.1.1, 16.1.5, 16.1.9, 16.2.7), each with its E3 file tag.
// Keep in step with csr-narrative-studio/src/domain/handoff.ts (ectdPackage, schema 1).
import { createSequence, placeDoc } from './ops.js';
import { makeDoc, seqByNumber, uid } from './model.js';
import { INDEX, isPlaceable } from './tree.js';
import { FILE_TAGS } from './stf.js';

export const CSR_PKG_KIND = 'csr-studio/ectd-5-3-5';
export const CSR_PKG_SCHEMA = 1;

export function parseCsrPackage(text) {
  let d;
  try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('This file is not valid JSON.'); }
  if (d?.kind !== CSR_PKG_KIND) throw new Error('This is not a clinical study report package from the CSR & Narrative Studio.');
  if (d.schema > CSR_PKG_SCHEMA) throw new Error('This package was made by a newer version of the CSR & Narrative Studio.');
  if (!Array.isArray(d.documents) || !d.documents.length) throw new Error('The package has no documents.');
  if (!d.study?.id) throw new Error('The package does not name its study.');
  return d;
}

// Adds the report's documents to the library and places them, tagged with the study, in the
// selected draft sequence or a new one. Returns the sequence, the placed documents and warnings.
export function importCsrPackage(project, pkg, { seqNumber = null } = {}) {
  const warnings = [];
  if (pkg.study.stage !== 'approved') warnings.push(`The report is at the ${pkg.study.stage} stage, not approved: a report goes into a submission only once it is final and signed.`);
  const chosen = seqNumber ? seqByNumber(project, seqNumber) : null;
  const seq = chosen && chosen.status === 'draft' ? chosen : createSequence(project, {
    submissionType: pkg.submission?.submissionType ?? 'original-application',
    subType: pkg.submission?.subType ?? 'application',
    description: String(pkg.submission?.description ?? `Clinical study report ${pkg.study.id}`).slice(0, 240),
  });
  const placed = [];
  for (const d of pkg.documents) {
    if (!INDEX.map[d.section] || !isPlaceable(d.section)) { warnings.push(`${d.title}: section ${d.section} is not a place for documents in this app's tree; skipped.`); continue; }
    const tag = FILE_TAGS[5].some((t) => t.value === d.study?.tag) ? d.study.tag : 'study-report';
    if (tag !== d.study?.tag) warnings.push(`${d.title}: file tag “${d.study?.tag}” is not one this app knows; tagged “study-report”.`);
    if (tag === 'study-report' && pkg.documents.length > 1) warnings.push(`${d.title}: “study-report” means the whole report is in one file, but this report comes in ${pkg.documents.length} files.`);
    const id = `csr-${uid()}`;
    project.documents[id] = makeDoc({ id, section: d.section, region: null, title: d.title, fileName: d.fileName, pages: d.pages ?? 2, generated: true, content: d.content ?? '', source: 'CSR & Narrative Studio', study: pkg.study.id, fileTag: tag });
    const leaf = placeDoc(project, seq.number, id, d.section, 'new');
    leaf.study = { id: pkg.study.id, tag };
    placed.push({ code: d.section, title: d.title, tag });
  }
  seq.csrPackage = { importedAt: new Date().toISOString(), study: pkg.study, placed, from: { userId: pkg.userId ?? null, classId: pkg.classId ?? null } };
  return { seq, placed, warnings };
}
