// Labelling package from the Labelling Workbench: labels land in US Module 1.14.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject } from '../src/engine/model.js';
import { createSequence } from '../src/engine/ops.js';
import { parseLabellingPackage, importLabellingPackage } from '../src/engine/labelpkg.js';

let n = 0;
const t = (name, fn) => { fn(); n++; };
const text = readFileSync(new URL('./fixtures/labelling-package-us.json', import.meta.url), 'utf8');

t('parses the package and rejects other files', () => {
  assert.equal(parseLabellingPackage(text).documents.length, 5);
  assert.throws(() => parseLabellingPackage('{"kind":"other"}'));
  assert.throws(() => parseLabellingPackage({ kind: 'labelling-workbench/labelling-package', schema: 1, documents: [] }));
});

t('places every label in Module 1.14 of a new labeling supplement', () => {
  const p = createProject({ name: 'labels', productId: 'nce-tablet', region: 'US', user: { userId: 'u-1' } });
  p.sequences[0].status = 'published';
  const { seq, placed, warnings } = importLabellingPackage(p, parseLabellingPackage(text), { seqNumber: p.sequences[0].number });
  assert.deepEqual(warnings, []);
  assert.equal(seq.submissionType, 'labeling-supplement');
  assert.equal(placed.length, 5);
  assert.ok(seq.leaves.every((l) => l.nodeCode.startsWith('1.14.')));
  assert.ok(seq.leaves.some((l) => l.nodeCode === '1.14.1.2'), 'annotated draft labeling');
  for (const l of seq.leaves) assert.ok(p.documents[l.docId]?.generated);
});

t('uses the selected draft sequence; warns about another product; refuses another region', () => {
  const p = createProject({ name: 'labels', productId: 'nce-tablet', region: 'US', user: { userId: 'u-1' } });
  const draft = createSequence(p, { submissionType: 'labeling-supplement', subType: 'application' });
  const before = p.sequences.length;
  const { seq } = importLabellingPackage(p, parseLabellingPackage(text), { seqNumber: draft.number });
  assert.equal(seq.number, draft.number);
  assert.equal(p.sequences.length, before);
  const other = createProject({ name: 'x', productId: 'talmisartan-er', region: 'US', user: { userId: 'u-1' } });
  assert.equal(importLabellingPackage(other, parseLabellingPackage(text)).warnings.length, 1);
  const eu = createProject({ name: 'x', productId: 'nce-tablet', region: 'EU', user: { userId: 'u-1' } });
  assert.throws(() => importLabellingPackage(eu, parseLabellingPackage(text)), /for US/);
});

console.log(`labelling package: ${n} tests passed`);
