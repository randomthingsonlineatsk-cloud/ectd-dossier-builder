// Change packages from the Variations Classifier start a sequence of the right type.
import assert from 'node:assert/strict';
import { createProject, coverLetterText } from '../src/engine/model.js';
import { parseChangePackage, importChangePackage, todoStatus } from '../src/engine/changepkg.js';

const pkg = {
  kind: 'variations-classifier/change-package', schema: 1, caseId: 'c-1', userId: 'u-1', classId: null,
  product: { id: 'nce-tablet', ectdProductId: 'nce-tablet', brandName: 'Ostrevia', appType: 'nda' },
  region: 'US', pack: { id: 'us', edition: '2026.1' },
  submission: { category: 'CBE30', categoryLabel: 'Supplement - Changes Being Effected in 30 Days', kind: 'cmc', ectd: { submissionType: 'chemistry-manufacturing-controls-supplement', subType: 'application' }, description: 'Move drug product manufacturing to a different site', earliestUse: '2026-12-02', implementation: { badge: 'Tell, wait 30 days, then do' } },
  changes: [{ id: 'ch-1', changeId: 'dp-site-move', title: 'Move drug product manufacturing to a different site', category: 'CBE30', entry: { at: 'VI.C.1.a' } }],
  module1: [{ code: '1.1', label: 'Form FDA 356h' }, { code: '1.2', label: 'Cover letter' }],
  ctd: [{ code: '1.2', label: 'Cover letter', operation: 'new', why: ['Regional Module 1'] }, { code: '3.2.P.3.1', label: 'Manufacturers', operation: 'replace', why: ['site'] }],
  coverLetter: 'Re: NDA 999101 - CBE-30 training letter',
};
const p = createProject({ name: 't', productId: 'nce-tablet', region: 'US', user: { userId: 'u-1' } });
const parsed = parseChangePackage(JSON.stringify(pkg));
const { seq, warnings } = importChangePackage(p, parsed);
assert.equal(seq.number, '0001');
assert.equal(seq.submissionType, 'chemistry-manufacturing-controls-supplement');
assert.equal(seq.changePackage.todo.length, 3);
assert.deepEqual(warnings, []);
assert.match(coverLetterText(p, seq), /CBE-30 training letter/);
assert.equal(todoStatus(seq).filter((t) => t.placed).length, 0);
assert.throws(() => importChangePackage(createProject({ name: 'e', productId: 'nce-tablet', region: 'EU' }), parsed), /for US/);
assert.throws(() => parseChangePackage('{"kind":"other"}'));
console.log('phase 6 tests: change package import passed');
