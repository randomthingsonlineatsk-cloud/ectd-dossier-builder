// Import of a labelling package from the Labelling Workbench (a separate app). The package holds
// the product's labels with their Module 1 placement: US 1.14 (draft 1.14.1, final 1.14.2, listed
// drug 1.14.3), EU 1.3.1 (one combined document), India 1.3, Canada 1.3.1 and 1.3.2,
// Switzerland 1.3.1 and 1.3.2, Japan 1.8. Keep in step with labelling-workbench/src/engine/handoff.js (schema 1).
export const LABEL_PKG_REGIONS = ['US', 'EU', 'IN', 'CA', 'CH', 'JP'];
export const LABEL_PKG_NODE = { US: 'Module 1.14', EU: 'Module 1.3.1', IN: 'Module 1.3', CA: 'Module 1.3.1 and 1.3.2', CH: 'Module 1.3.1 and 1.3.2', JP: 'Module 1.8' };
import { createSequence, placeDoc } from './ops.js';
import { makeDoc, seqByNumber, uid } from './model.js';
import { INDEX, isPlaceable } from './tree.js';

export const LABEL_PKG_KIND = 'labelling-workbench/labelling-package';
export const LABEL_PKG_SCHEMA = 1;

export function parseLabellingPackage(text) {
  let d;
  try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('This file is not valid JSON.'); }
  if (d?.kind !== LABEL_PKG_KIND) throw new Error('This is not a labelling package from the Labelling Workbench.');
  if (d.schema > LABEL_PKG_SCHEMA) throw new Error('This labelling package was made by a newer version of the Labelling Workbench.');
  if (!Array.isArray(d.documents) || !d.documents.length) throw new Error('The labelling package has no documents.');
  return d;
}

// Adds the labels to the document library and places them in a sequence: the selected draft
// sequence if there is one, otherwise a new labeling supplement. Returns the sequence and warnings.
export function importLabellingPackage(project, pkg, { seqNumber = null } = {}) {
  const warnings = [];
  if (!LABEL_PKG_REGIONS.includes(pkg.region)) throw new Error(`Labelling packages for ${pkg.region} are not supported.`);
  if (pkg.region !== project.region) throw new Error(`The package is for ${pkg.region}; this project is for ${project.region}.`);
  if (pkg.product?.ectdProductId && pkg.product.ectdProductId !== project.productId) warnings.push(`The package is for ${pkg.product.brandName}, a different product from this project's.`);
  const chosen = seqNumber ? seqByNumber(project, seqNumber) : null;
  const seq = chosen && chosen.status === 'draft' ? chosen : createSequence(project, {
    submissionType: pkg.submission?.submissionType ?? 'labeling-supplement',
    subType: pkg.submission?.subType ?? 'application',
    description: String(pkg.submission?.description ?? 'Labeling').slice(0, 240),
  });
  if (pkg.region === 'JP') warnings.push('The package insert from the Labelling Workbench is an English practice text; Module 1 for Japan must be in Japanese, so the check report will say so.');
  const placed = [];
  for (const d of pkg.documents) {
    if (!INDEX.map[d.section] || !isPlaceable(d.section)) { warnings.push(`${d.title}: section ${d.section} is not a place for documents in this app's tree; skipped.`); continue; }
    const id = `lw-${uid()}`;
    project.documents[id] = makeDoc({ id, section: d.section, region: pkg.region, ...(d.lang ? { lang: d.lang } : {}), title: d.title, fileName: d.fileName, pages: d.pages ?? 2, generated: true, content: d.content ?? '', source: 'Labelling Workbench' });
    placeDoc(project, seq.number, id, d.section, 'new');
    placed.push({ code: d.section, title: d.title });
  }
  seq.labellingPackage = { importedAt: new Date().toISOString(), projectId: pkg.projectId ?? null, trigger: pkg.submission?.trigger ?? null, o4: pkg.submission?.o4 ?? null, placed, from: { userId: pkg.userId ?? null, classId: pkg.classId ?? null } };
  return { seq, placed, warnings };
}
