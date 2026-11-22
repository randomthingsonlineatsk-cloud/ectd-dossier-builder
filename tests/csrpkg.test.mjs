// Clinical study report from the CSR & Narrative Studio: documents land in 5.3.5.1 with study tags.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject } from '../src/engine/model.js';
import { parseCsrPackage, importCsrPackage } from '../src/engine/csrpkg.js';
import { studyFiles } from '../src/engine/stf.js';

let n = 0;
const t = (name, fn) => { fn(); n++; };
const text = readFileSync(new URL('./fixtures/csr-ectd-glv-12-301.json', import.meta.url), 'utf8');

t('parses the package and rejects other files', () => {
  assert.equal(parseCsrPackage(text).documents.length, 7);
  assert.throws(() => parseCsrPackage('{"kind":"other"}'), /not a clinical study report package/);
  assert.throws(() => parseCsrPackage({ kind: 'csr-studio/ectd-5-3-5', schema: 2, documents: [{}], study: { id: 'X' } }), /newer/);
});

for (const region of ['US', 'EU']) t(`places the report in 5.3.5.1 with study tags (${region})`, () => {
  const p = createProject({ name: 'csr', productId: 'nce-tablet', region, user: { userId: 'u-1' } });
  p.sequences[0].status = 'published';
  const { seq, placed, warnings } = importCsrPackage(p, parseCsrPackage(text));
  assert.equal(placed.length, 7);
  assert.deepEqual(warnings.filter((w) => /not one this app knows/.test(w)), [], 'every E3 file tag is known');
  assert.ok(seq.leaves.every((l) => l.nodeCode === '5.3.5.1'));
  assert.deepEqual(seq.leaves.map((l) => l.study.tag).sort(), ['adverse-event-listings', 'protocol-or-amendment', 'signatures-investigators', 'statistical-methods-interim-analysis-plan', 'study-report-body', 'study-report-body', 'synopsis']);
  assert.ok(seq.leaves.every((l) => l.study.id === 'GLV-12-301'));
  assert.match(warnings.join(' '), /not approved/);
  const stf = studyFiles(p, seq);
  assert.equal(stf.length, region === 'US' ? 1 : 0, 'one study tagging file for GLV-12-301 at 5.3.5.1 (US only)');
});

console.log(`csrpkg: ${n} checks passed`);
