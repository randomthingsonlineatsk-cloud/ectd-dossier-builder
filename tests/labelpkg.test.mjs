// Labelling package from the Labelling Workbench: labels land in the region's Module 1 labelling node.
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

for (const [r, region, nodes, type] of [['eu', 'EU', ['eu:1.3.1'], 'var-type2'], ['in', 'IN', ['in:1.3'], 'post-approval-change'], ['ca', 'CA', ['ca:1.3.1', 'ca:1.3.2'], 'snds'], ['ch', 'CH', ['ch:1.3.1', 'ch:1.3.2'], 'var-type2'], ['jp', 'JP', ['jp:1.8'], 'jp_partial-change']]) {
  t(`${region}: the package lands in ${nodes.join(' and ')} of a new ${type} sequence`, () => {
    const pkg = parseLabellingPackage(readFileSync(new URL(`./fixtures/labelling-package-${r}.json`, import.meta.url), 'utf8'));
    assert.equal(pkg.region, region);
    const p = createProject({ name: 'labels', productId: 'nce-tablet', region, user: { userId: 'u-1' } });
    p.sequences[0].status = 'published';
    const { seq, placed, warnings } = importLabellingPackage(p, pkg, { seqNumber: p.sequences[0].number });
    assert.equal(warnings.length, region === 'JP' ? 1 : 0, JSON.stringify(warnings));
    assert.equal(seq.submissionType, type);
    assert.equal(placed.length, pkg.documents.length);
    assert.deepEqual([...new Set(seq.leaves.map((l) => l.nodeCode))].sort(), nodes);
    for (const l of seq.leaves) assert.equal(p.documents[l.docId]?.region, region);
  });
}
t('a package for one region is refused by a project for another', () => {
  const pkg = parseLabellingPackage(readFileSync(new URL('./fixtures/labelling-package-jp.json', import.meta.url), 'utf8'));
  const p = createProject({ name: 'x', productId: 'nce-tablet', region: 'EU', user: { userId: 'u-1' } });
  assert.throws(() => importLabellingPackage(p, pkg), /for JP/);
});

console.log(`labelling package: ${n} tests passed`);
