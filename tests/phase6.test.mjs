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
// EU package: variation type, mode and the change list for the cover letter.
const euPkg = { ...pkg, region: 'EU', product: { ...pkg.product, appType: 'nda' },
  submission: { ...pkg.submission, category: 'IB', categoryLabel: 'Type IB', ectd: { submissionType: 'var-type1b', subType: 'initial', submissionMode: 'grouping' } },
  changes: [{ id: 'ch-2', title: 'Move drug product manufacturing to a different site', category: 'IB', categoryLabel: 'Type IB', entry: { at: 'Q.II.b.1(e)' } }],
  module1: [{ code: 'eu:1.0', label: 'Cover letter' }, { code: 'eu:1.2', label: 'Application form' }],
  ctd: [{ code: 'eu:1.0', label: 'Cover letter', operation: 'new', why: [] }, { code: '3.2.P.3.1', label: 'Manufacturers', operation: 'replace', why: [] }] };
const pe = createProject({ name: 'eu', productId: 'nce-tablet', region: 'EU', user: { userId: 'u-1' } });
const r2 = importChangePackage(pe, parseChangePackage(euPkg));
assert.equal(r2.seq.submissionType, 'var-type1b'); assert.equal(r2.seq.submissionMode, 'grouping');
assert.equal(r2.seq.changes[0].type, 'Type IB'); assert.match(r2.seq.changes[0].scope, /Q\.II\.b\.1\(e\)/);
assert.deepEqual(r2.warnings, []);
assert.ok(r2.seq.changePackage.todo.every((t) => t.known), 'EU codes exist in the EU tree');
// India package: post-approval change application.
const inPkg = { ...pkg, region: 'IN', submission: { ...pkg.submission, category: 'L2', categoryLabel: 'Level II: notifiable change', ectd: { submissionType: 'post-approval-change', subType: 'application' } },
  module1: [{ code: 'in:1.1', label: 'Covering letter' }, { code: 'in:1.2.2', label: 'Application and fee' }, { code: 'in:1.5', label: 'Approval in country of origin' }],
  ctd: [{ code: '3.2.P.3.1', label: 'Manufacturers', operation: 'replace', why: [] }] };
const pin = createProject({ name: 'in', productId: 'nce-tablet', region: 'IN', user: { userId: 'u-1' } });
const r3 = importChangePackage(pin, parseChangePackage(inPkg));
assert.equal(r3.seq.submissionType, 'post-approval-change');
assert.ok(r3.seq.changePackage.todo.every((t) => t.known));
console.log('phase 6 tests: change package import passed');
