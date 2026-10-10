// Engine smoke tests: node tests/engine.test.mjs
import assert from 'node:assert/strict';
import { createProject, currentLeaves, seqByNumber } from '../src/engine/model.js';
import { validate } from '../src/engine/validate.js';
import { seedMission, evaluateMission, buildComplete } from '../src/engine/missions.js';
import { publish, publishWithFiles, createSequence, placeDoc, updateLeaf, removeLeaf, fixDoc, addCoverLetter } from '../src/engine/ops.js';
import fs from 'node:fs';
import { setFontLoader, leafPdf } from '../src/engine/pdfgen.js';
import { studyFiles } from '../src/engine/stf.js';
setFontLoader(async () => fs.readFileSync(new URL('../src/assets/fonts/public-sans-latin-400.ttf', import.meta.url)));
import { publishSequence } from '../src/engine/backbone.js';
import { exportProject, parseProjectFile } from '../src/engine/io.js';

const user = { userId: 'u-test', classId: 'c-test' };
let pass = 0; const t = async (name, fn) => { await fn(); pass++; console.log('ok -', name); };

await t('empty project has metadata, M1 and content findings', async () => {
  const p = createProject({ name: 'x', user });
  assert.equal(p.userId, 'u-test'); assert.equal(p.classId, 'c-test');
  const v = validate(p, '0000');
  assert.ok(v.findings.some(f => f.ruleId === 'BB-06'));
  assert.ok(v.findings.some(f => f.ruleId === 'M1-01'));
  assert.ok(v.findings.some(f => f.ruleId === 'CT-01'));
});

await t('complete build validates clean and mission 1 scores 100 after publish', async () => {
  const p = await seedMission(1, 'standard', user);
  buildComplete(p);
  const v = validate(p, '0000');
  if (v.findings.length) console.log(v.findings.map(f => f.key + ' ' + f.message));
  assert.equal(v.counts.High, 0); assert.equal(v.counts.Medium, 0); assert.equal(v.counts.Low, 0);
  publish(p, '0000');
  const e = evaluateMission(p);
  assert.equal(e.score, 100);
  assert.throws(() => placeDoc(p, '0000', 'd-intro', '2.2'));
});

await t('backbone xml is generated with md5 checksums and repeat attributes', async () => {
  const p = await seedMission(1, 'standard', user); buildComplete(p);
  const pkg = publishSequence(p, '0000');
  assert.match(pkg.index, /<m3-2-p-drug-product product-name="Ostrevia"/);
  assert.match(pkg.index, /checksum-type="md5" checksum="[0-9a-f]{32}"/);
  assert.match(pkg.index, /m3\/32-body-data\/32p-drug-prod\/ostrevia-tablet-film-coated\/32p5-contr-drug-prod\/32p51-spec\/specifications.pdf/);
  assert.match(pkg.regional, /<form form-type="fda-356h">/);
  assert.match(pkg.regional, /<application-number application-type="nda">299001</);
  assert.ok(pkg.log.length > 100);
});

await t('mission 11 plants 25 defects that are all detected', async () => {
  const p = await seedMission(11, 'guided', user);
  const e = evaluateMission(p);
  assert.equal(e.total, 25);
  const unfound = e.defects.filter(d => d.fixed);
  assert.deepEqual(unfound.map(d => d.label), []);
  assert.equal(e.score, 0);
});

await t('mission 11 fixes are recognised', async () => {
  const p = await seedMission(11, 'standard', user);
  const qos = seqByNumber(p, '0000').leaves.find(l => l.docId === 'd-qos');
  updateLeaf(p, '0000', qos.id, { fileName: 'quality-overall-summary.pdf' });
  fixDoc(p, 'd-qos', 'links');
  p.settings.applicationNumber = '299001';
  const e = evaluateMission(p);
  assert.equal(e.fixed, 3);
});

await t('mission 4: correct response sequence scores 100', async () => {
  const p = await seedMission(4, 'standard', user);
  assert.equal(seqByNumber(p, '0000').status, 'published');
  createSequence(p, { submissionType: 'original-application', subType: 'amendment', description: 'Response to IR' });
  const s0 = seqByNumber(p, '0000');
  const old = (id) => s0.leaves.find(l => l.docId === id);
  placeDoc(p, '0001', 'd-356h', '1.1');
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'd-ir-resp', '1.11.1');
  placeDoc(p, '0001', 'd-p51-v2', '3.2.P.5.1', 'replace', { seq: '0000', leafId: old('d-p51').id });
  placeDoc(p, '0001', 'd-p83-v2', '3.2.P.8.3', 'replace', { seq: '0000', leafId: old('d-p83').id });
  const v = validate(p, '0001');
  if (v.findings.length) console.log(v.findings.map(f => f.key + ' ' + f.message));
  assert.equal(v.counts.High, 0);
  publish(p, '0001');
  const e = evaluateMission(p);
  assert.equal(e.score, 100, JSON.stringify(e.checks));
  const cur = currentLeaves(p).filter(x => x.leaf.nodeCode === '3.2.P.5.1');
  assert.equal(cur.length, 1); assert.equal(cur[0].leaf.docId, 'd-p51-v2');
});

await t('mission 4: "new" instead of replace is flagged', async () => {
  const p = await seedMission(4, 'expert', user);
  createSequence(p, { subType: 'amendment' });
  placeDoc(p, '0001', 'd-p51-v2', '3.2.P.5.1', 'new');
  const v = validate(p, '0001');
  assert.ok(v.findings.some(f => f.ruleId === 'LC-05'));
  placeDoc(p, '0001', 'd-p83-v2', '3.2.P.8.3', 'replace', { seq: '0000', leafId: 'nope' });
  assert.ok(validate(p, '0001').findings.some(f => f.ruleId === 'LC-02'));
});

await t('export/import round trip keeps ids and re-owns the copy', async () => {
  const p = await seedMission(1, 'standard', user); buildComplete(p);
  const text = exportProject(p, []);
  const q = parseProjectFile(text, { userId: 'u-other', classId: null }, new Set([p.id]));
  assert.notEqual(q.id, p.id); assert.equal(q.userId, 'u-other'); assert.equal(q.importedFrom.userId, 'u-test');
  assert.equal(q.sequences[0].leaves.length, p.sequences[0].leaves.length);
  assert.throws(() => parseProjectFile('{"kind":"other"}', user));
});

await t('study tagging files group M4/M5 leaves and untagged reports are flagged', async () => {
  const p = await seedMission(1, 'standard', user); buildComplete(p);
  const stfs = studyFiles(p, p.sequences[0]);
  assert.ok(stfs.some((f) => f.studyId === 'HRP-301' && f.nodeCode === '5.3.5.1'));
  assert.match(stfs[0].xml, /<file-tag name="(study-report|pre-clinical-study-report)" info-type="ich"\/>/);
  const pkg = publishSequence(p, '0000');
  assert.match(pkg.index, /stf-hrp-301\.xml/);
  const l = p.sequences[0].leaves.find((x) => x.docId === 'd-5351b');
  updateLeaf(p, '0000', l.id, { study: null });
  assert.ok(validate(p, '0000').findings.some((f) => f.key === `SG-01:${l.id}`));
  updateLeaf(p, '0000', l.id, { study: { id: 'HRP-302', tag: 'bogus' } });
  const keys = validate(p, '0000').keys;
  assert.ok(keys.has(`SG-02:${l.id}`) && keys.has(`SG-03:${l.id}`));
});

await t('stub PDFs carry their properties and publishing records real MD5s', async () => {
  const p = await seedMission(1, 'standard', user); buildComplete(p);
  const seq = p.sequences[0];
  const leaf = (id) => seq.leaves.find((l) => l.docId === id);
  p.documents['d-s32'].pdfVersion = '1.3';
  const b = await leafPdf(p, '0000', leaf('d-s32'));
  assert.equal(new TextDecoder().decode(b.slice(0, 8)), '%PDF-1.3');
  p.documents['d-s32'].pdfVersion = '1.7';
  await publishWithFiles(p, '0000');
  const frozen = leaf('d-qos').frozenDoc;
  assert.match(frozen.md5, /^[0-9a-f]{32}$/);
  const again = await leafPdf(p, '0000', leaf('d-qos'));
  const { md5Bytes } = await import('../src/engine/pdfgen.js');
  assert.equal(md5Bytes(again), frozen.md5);
  assert.ok(publishSequence(p, '0000').index.includes(`checksum="${frozen.md5}"`));
});

console.log(`\n${pass} tests passed`);
