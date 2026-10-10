// Phase 2 engine tests: node tests/phase2.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setFontLoader } from '../src/engine/pdfgen.js';
import { seqByNumber, createProject, migrateProject } from '../src/engine/model.js';
import { validate } from '../src/engine/validate.js';
import { seedMission, evaluateMission, buildComplete, missionById } from '../src/engine/missions.js';
import { publishWithFiles, createSequence, placeDoc, addCoverLetter, updateLeaf } from '../src/engine/ops.js';
import { consistencyMatrix, correctFact } from '../src/engine/consistency.js';
import { publishSequence } from '../src/engine/backbone.js';

setFontLoader(async () => fs.readFileSync(new URL('../src/assets/fonts/public-sans-latin-400.ttf', import.meta.url)));
const user = { userId: 'u-test', classId: null };
let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('ok -', name); };
const leafOf = (p, n, docId) => seqByNumber(p, n).leaves.find((l) => l.docId === docId);
const answerAll = (p) => { for (const q of missionById(p.mission.id).quiz ?? []) p.mission.answers[q.id] = q.answer; };
const show = (ev) => ev.checks.filter((c) => !c.ok).map((c) => c.id);
const fixAll = (p, n) => { for (const iss of consistencyMatrix(p, n).issues) correctFact(p, n, iss); };

await t('migration turns the old "original" sub-type into "application"', async () => {
  const p = createProject({ name: 'x', user });
  p.sequences[0].subType = 'original'; delete p.settings.eu;
  migrateProject(p);
  assert.equal(p.sequences[0].subType, 'application');
  assert.ok(p.settings.eu.uuid);
});

await t('EU envelope rules: related sequence and response document', async () => {
  const p = createProject({ name: 'eu', region: 'EU', user });
  buildComplete(p);
  await publishWithFiles(p, '0000');
  createSequence(p, { submissionType: 'maa', subType: 'response' });
  const keys = validate(p, '0001').keys;
  assert.ok(keys.has('EU-11:missing'));
  assert.ok(keys.has('EU-09:responses'));
  assert.match(publishSequence(p, '0001').regional, /<submission-unit type="response"\/>/);
});

await t('mission 2: planted contradictions are found and correctable', async () => {
  const p = await seedMission(2, 'guided', user);
  buildComplete(p);
  const issues = consistencyMatrix(p, '0000').issues;
  assert.deepEqual(issues.map((i) => i.fact.key).sort(), ['dpManufacturer', 'shelfLife']);
  fixAll(p, '0000');
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
  assert.equal(ev.axes.consistency, 100);
});

await t('mission 5: EU response sequence scores 100', async () => {
  const p = await seedMission(5, 'standard', user);
  createSequence(p, { submissionType: 'maa', subType: 'response', relatedSequence: '0000' });
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'eu-resp-d120', 'eu:responses');
  placeDoc(p, '0001', 'd-p51-v2', '3.2.P.5.1', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-p51').id });
  placeDoc(p, '0001', 'eu-pi-v2', 'eu:1.3.1', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'eu-pi').id });
  let ev = evaluateMission(p);
  assert.ok(show(ev).includes('consistent'), 'QOS still states the old limit');
  placeDoc(p, '0001', 'd-qos-v2', '2.3', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-qos').id });
  const v = validate(p, '0001');
  assert.equal(v.counts.High, 0, JSON.stringify(v.findings.map((f) => f.key)));
  await publishWithFiles(p, '0001');
  ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
});

await t('mission 6: new site supplement scores 100', async () => {
  const p = await seedMission(6, 'standard', user);
  answerAll(p);
  createSequence(p, { submissionType: 'chemistry-manufacturing-controls-supplement', subType: 'application' });
  placeDoc(p, '0001', 'd-356h-s1', '1.1');
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'd-p31-v2', '3.2.P.3.1', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-p31').id });
  placeDoc(p, '0001', 'd-a1-v2', '3.2.A.1', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-a1').id });
  placeDoc(p, '0001', 'd-p35-siteb', '3.2.P.3.5');
  placeDoc(p, '0001', 'd-p83-siteb', '3.2.P.8.3');
  assert.deepEqual(consistencyMatrix(p, '0001').issues.map((i) => i.fact.key), []);
  await publishWithFiles(p, '0001');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
});

await t('mission 7: labeling supplement scores 100', async () => {
  const p = await seedMission(7, 'standard', user);
  answerAll(p);
  createSequence(p, { submissionType: 'labeling-supplement', subType: 'application' });
  placeDoc(p, '0001', 'd-356h', '1.1');
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'd-pi-v2', '1.14.1.3', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-pi').id });
  placeDoc(p, '0001', 'd-annot-v2', '1.14.1.2', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-annot').id });
  placeDoc(p, '0001', 'd-hep-review', '5.3.6');
  await publishWithFiles(p, '0001');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
});

await t('mission 8: annual report and PADER score 100', async () => {
  const p = await seedMission(8, 'standard', user);
  answerAll(p);
  createSequence(p, { submissionType: 'annual-report', subType: 'report' });
  placeDoc(p, '0001', 'd-2252-ar', '1.1'); addCoverLetter(p, '0001');
  for (const [d, c] of [['d-ar-safety', '1.13.3'], ['d-ar-mfg', '1.13.5'], ['d-ar-dist', '1.13.11'], ['d-ar-pmc', '1.13.12']]) placeDoc(p, '0001', d, c);
  assert.equal(validate(p, '0001').counts.High, 0);
  await publishWithFiles(p, '0001');
  createSequence(p, { submissionType: 'periodic-safety-reports', subType: 'report' });
  placeDoc(p, '0002', 'd-2252-pader', '1.1'); addCoverLetter(p, '0002');
  placeDoc(p, '0002', 'd-pader', '5.3.6');
  await publishWithFiles(p, '0002');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
});

await t('mission 9: DMF support supplement scores 100', async () => {
  const p = await seedMission(9, 'standard', user);
  answerAll(p);
  createSequence(p, { submissionType: 'chemistry-manufacturing-controls-supplement', subType: 'application' });
  placeDoc(p, '0001', 'd-356h', '1.1'); addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'd-loa-v2', '1.4.1', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-loa').id });
  placeDoc(p, '0001', 'd-s22-v2', '3.2.S.2.2', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'd-s22').id });
  placeDoc(p, '0001', 'd-s44-post', '3.2.S.4.4');
  await publishWithFiles(p, '0001');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
});

await t('mission 10: reformat baseline scores 100 and rejects NeeS volumes', async () => {
  const p = await seedMission(10, 'standard', user);
  p.settings.eu.trackingNumber = 'EMEA/H/C/006123';
  addCoverLetter(p, '0000');
  for (const d of Object.values(p.documents)) if (d.section.startsWith('3.') && !d.decoy && !d.irOnly && (d.version ?? 1) === 1) placeDoc(p, '0000', d.id, d.section);
  const v = validate(p, '0000');
  assert.equal(v.counts.High, 0, JSON.stringify(v.findings.filter((f) => f.severity === 'High').map((f) => f.key)));
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
});

await t('mission 12: complete ANDA scores 100', async () => {
  const p = await seedMission(12, 'standard', user);
  answerAll(p);
  buildComplete(p);
  const v = validate(p, '0000');
  assert.equal(v.counts.High + v.counts.Medium, 0, JSON.stringify(v.findings.map((f) => f.key)));
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, JSON.stringify(show(ev)));
});

await t('ANDA without patent certification is a High finding', async () => {
  const p = await seedMission(12, 'standard', user);
  const L = buildComplete(p);
  updateLeaf(p, '0000', L['g-patcert'].id, { nodeCode: '1.3.5.3' });
  assert.ok(validate(p, '0000').keys.has('M1-12:1.3.5.2'));
});

console.log(`\n${pass} phase 2 tests passed`);
