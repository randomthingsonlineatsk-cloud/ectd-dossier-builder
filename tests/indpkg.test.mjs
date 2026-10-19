// IND package from the Clinical Trial Simulator: the initial IND lands in US Module 1, 2 and 5.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject } from '../src/engine/model.js';
import { createSequence } from '../src/engine/ops.js';
import { m1Checklist } from '../src/engine/validate.js';
import { parseIndPackage, importIndPackage } from '../src/engine/indpkg.js';

let n = 0;
const t = (name, fn) => { fn(); n++; };
const text = readFileSync(new URL('./fixtures/ind-package-us.json', import.meta.url), 'utf8');
const indProject = () => {
  const p = createProject({ name: 'ind', productId: 'nce-tablet', region: 'US', appType: 'ind', user: { userId: 'u-1' } });
  return p;
};

t('parses the package and rejects other files', () => {
  assert.equal(parseIndPackage(text).documents.length, 10);
  assert.throws(() => parseIndPackage('{"kind":"labelling-workbench/labelling-package","schema":1,"documents":[{}]}'));
  assert.throws(() => parseIndPackage({ kind: 'clinical-trial-simulator/ind-package', schema: 1, documents: [] }));
  assert.throws(() => parseIndPackage({ kind: 'clinical-trial-simulator/ind-package', schema: 9, documents: [{}] }), /newer/);
});

t('places the IND and meets every mandatory Module 1 item of an initial IND', () => {
  const p = indProject();
  assert.equal(p.appType, 'ind');
  p.sequences[0].status = 'published';
  const { seq, placed, warnings } = importIndPackage(p, parseIndPackage(text), { seqNumber: p.sequences[0].number });
  assert.deepEqual(warnings, []);
  assert.equal(seq.submissionType, 'original-application');
  assert.equal(placed.length, 10);
  const codes = seq.leaves.map((l) => l.nodeCode);
  for (const c of ['1.1', '1.2', '1.20', '1.14.4.1', '1.14.4.2', '5.3.3.1', '2.3', '2.4']) assert.ok(codes.includes(c), c);
  for (const item of m1Checklist(p, seq).filter((i) => i.level === 'mandatory')) {
    assert.ok(seq.leaves.some((l) => l.nodeCode === item.section && (!item.form || p.documents[l.docId]?.form === item.form)), item.label);
  }
  assert.equal(seq.indPackage.drug, 'Vasclarin');
  assert.equal(seq.indPackage.from.userId, 'u-fixture');
});

t('uses the selected draft sequence; warns for a non-IND project; refuses another region', () => {
  const p = indProject();
  const draft = createSequence(p, { submissionType: 'original-application', subType: 'application' });
  const before = p.sequences.length;
  const { seq } = importIndPackage(p, parseIndPackage(text), { seqNumber: draft.number });
  assert.equal(seq.number, draft.number);
  assert.equal(p.sequences.length, before);
  const nda = createProject({ name: 'x', productId: 'nce-tablet', region: 'US', appType: 'nda', user: { userId: 'u-1' } });
  assert.equal(importIndPackage(nda, parseIndPackage(text)).warnings.length, 1);
  const eu = createProject({ name: 'x', productId: 'nce-tablet', region: 'EU', user: { userId: 'u-1' } });
  assert.throws(() => importIndPackage(eu, parseIndPackage(text)), /this project is for EU/);
  assert.throws(() => importIndPackage(p, { ...parseIndPackage(text), region: 'EU' }), /US projects only/);
});

console.log(`indpkg: ${n} tests passed`);
