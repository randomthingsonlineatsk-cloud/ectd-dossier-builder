// Import of a change package from the Variations Classifier (a separate app). The package
// says which kind of sequence to start, the cover letter, and which leaves to add with which
// operation. Keep in step with variations-classifier/src/engine/handoff.js (schema 1).
import { createSequence } from './ops.js';
import { INDEX } from './tree.js';

export const PACKAGE_KIND = 'variations-classifier/change-package';
export const PACKAGE_SCHEMA = 1;
const REGION = { US: 'US', EU: 'EU', IN: 'IN', CA: 'CA', CH: 'CH', JP: 'JP' };

export function parseChangePackage(text) {
  let d;
  try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch { throw new Error('This file is not valid JSON.'); }
  if (d?.kind !== PACKAGE_KIND) throw new Error('This is not a change package from the Variations Classifier.');
  if (d.schema > PACKAGE_SCHEMA) throw new Error('This change package was made by a newer version of the Variations Classifier.');
  for (const k of ['product', 'region', 'submission', 'changes', 'ctd']) if (!(k in d)) throw new Error(`Change package is missing "${k}".`);
  return d;
}

// Starts a draft sequence from the package. Returns the sequence and any warnings.
export function importChangePackage(project, pkg) {
  const warnings = [];
  if (REGION[pkg.region] !== project.region) throw new Error(`The package is for ${pkg.region}; this project is for ${project.region}.`);
  if (pkg.product?.ectdProductId && pkg.product.ectdProductId !== project.productId) warnings.push(`The package is for ${pkg.product.brandName}, a different product from this project's.`);
  if (project.appType && pkg.product?.appType && !project.appType.startsWith(pkg.product.appType)) warnings.push(`The package is for an ${pkg.product.appType.toUpperCase()}; this project is an ${project.appType.toUpperCase()}.`);
  const seq = createSequence(project, {
    submissionType: pkg.submission.ectd.submissionType,
    subType: pkg.submission.ectd.subType,
    description: `${pkg.submission.categoryLabel}: ${pkg.submission.description}`.slice(0, 240),
  });
  const todo = [...(pkg.module1 ?? []).map((m) => ({ code: m.code, label: m.label, operation: 'new', why: ['Regional Module 1'] })), ...pkg.ctd]
    .filter((e, i, a) => a.findIndex((x) => x.code === e.code) === i)
    .map((e) => ({ code: e.code, label: e.label, operation: e.operation, why: e.why ?? [], known: !!INDEX.map[e.code] }));
  for (const t of todo) if (!t.known) warnings.push(`Section ${t.code} is not in this app's ${project.region} tree; place it by hand.`);
  seq.changePackage = {
    caseId: pkg.caseId ?? null, importedAt: new Date().toISOString(),
    category: pkg.submission.category, categoryLabel: pkg.submission.categoryLabel,
    earliestUse: pkg.submission.earliestUse ?? null, implementation: pkg.submission.implementation ?? null,
    pack: pkg.pack ?? null, changes: pkg.changes, todo, coverLetter: pkg.coverLetter ?? '',
    from: { userId: pkg.userId ?? null, classId: pkg.classId ?? null },
  };
  return { seq, warnings };
}

// Which to-do items already have a leaf in the sequence.
export const todoStatus = (seq) => (seq.changePackage?.todo ?? []).map((t) => ({ ...t, placed: seq.leaves.some((l) => l.nodeCode === t.code) }));
