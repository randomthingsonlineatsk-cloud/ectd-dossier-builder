// Phase 3 engine tests: node tests/phase3.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setFontLoader } from '../src/engine/pdfgen.js';
import { seqByNumber, createProject } from '../src/engine/model.js';
import { validate } from '../src/engine/validate.js';
import { seedMission, evaluateMission, buildComplete, missionById } from '../src/engine/missions.js';
import { publishWithFiles, createSequence, placeDoc, addCoverLetter, addDeleteLeaf } from '../src/engine/ops.js';
import { consistencyMatrix, correctFact } from '../src/engine/consistency.js';
import { publishSequence } from '../src/engine/backbone.js';
import { sha256 } from '../src/engine/sha256.js';
import * as R from '../src/engine/review.js';
import * as P from '../src/engine/planning.js';
import { createHash } from 'node:crypto';

setFontLoader(async () => fs.readFileSync(new URL('../src/assets/fonts/public-sans-latin-400.ttf', import.meta.url)));
const user = { userId: 'u-test', classId: null };
let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('ok -', name); };
const leafOf = (p, n, docId) => seqByNumber(p, n).leaves.find((l) => l.docId === docId);
const answerAll = (p) => { for (const q of missionById(p.mission.id).quiz ?? []) p.mission.answers[q.id] = q.answer; };
const failed = (ev) => ev.checks.filter((c) => !c.ok).map((c) => c.id);
const fixAll = (p, n) => { for (const iss of consistencyMatrix(p, n).issues) correctFact(p, n, iss); };

await t('SHA-256 matches Node crypto', async () => {
  for (const s of ['', 'abc', 'x'.repeat(1000), 'eCTD v4.0 ✓']) assert.equal(sha256(s), createHash('sha256').update(s).digest('hex'));
});

await t('every product and region builds clean', async () => {
  for (const [pid, region] of [['nce-tablet', 'JP'], ['nce-tablet', 'IN'], ['mab-infusion', 'US'], ['mab-infusion', 'EU'], ['biosimilar-mab', 'US'], ['biosimilar-mab', 'EU']]) {
    const p = createProject({ name: 'x', productId: pid, region, user });
    buildComplete(p);
    const v = validate(p, p.sequences[0].number);
    assert.deepEqual(v.counts, { High: 0, Medium: 0, Low: 0 }, `${pid} ${region}: ${v.findings.map((f) => f.key).join(', ')}`);
  }
});

await t('mission 3: Japan v4.0 with replace, suspend and reuse scores 100', async () => {
  const p = await seedMission(3, 'standard', user);
  assert.equal(p.ectdVersion, '4.0');
  assert.equal(p.sequences[0].number, '0001');
  buildComplete(p);
  answerAll(p);
  await publishWithFiles(p, '0001');
  createSequence(p, {});
  placeDoc(p, '0002', 'jp-p83-v2', '3.2.P.8.3', 'replace', { seq: '0001', leafId: leafOf(p, '0001', 'd-p83').id });
  const interim = leafOf(p, '0001', 'jp-p83-interim');
  const sus = addDeleteLeaf(p, '0002', { seq: '0001', leafId: interim.id, nodeCode: interim.nodeCode, title: interim.title });
  assert.equal(sus.operation, 'suspend');
  placeDoc(p, '0002', 'jp-lit-moa', '5.4');
  addCoverLetter(p, '0002');
  placeDoc(p, '0002', 'jp-resp-1', 'jp:1.13.3');
  const pkg = publishSequence(p, '0002');
  assert.match(pkg.unit.xml, /<statusCode code="suspended"\/>/);
  assert.match(pkg.unit.xml, /<replacementOf typeCode="RPLC">/);
  assert.equal(pkg.unit.reused, 1);
  assert.ok(!pkg.unit.shaTxt.includes('ref-mechanism-of-action'), 'reused file is not listed in sha256.txt');
  assert.match(pkg.unit.xml, /<sequenceNumber value="2"\/>/);
  await publishWithFiles(p, '0002');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('v4.0 rejects delete and append (V4-01)', async () => {
  const p = createProject({ name: 'jp', region: 'JP', user });
  buildComplete(p);
  await publishWithFiles(p, '0001');
  createSequence(p, {});
  const l = leafOf(p, '0001', 'd-p83');
  addDeleteLeaf(p, '0002', { seq: '0001', leafId: l.id, nodeCode: l.nodeCode }, 'delete');
  assert.ok([...validate(p, '0002').keys].some((k) => k.startsWith('V4-01')));
});

await t('mission 13: biosimilar with decoy left out and contradiction fixed scores 100', async () => {
  const p = await seedMission(13, 'standard', user);
  buildComplete(p);
  assert.ok(consistencyMatrix(p, '0000').issues.length > 0, 'planted contradiction is visible');
  fixAll(p, '0000');
  answerAll(p);
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('mission 14: India import application passes screening and scores 100', async () => {
  const p = await seedMission(14, 'standard', user);
  buildComplete(p);
  assert.ok(!leafOf(p, '0000', 'in-3'), 'CT-21 is not placed for an import application');
  answerAll(p);
  await publishWithFiles(p, '0000');
  assert.equal(publishSequence(p, '0000').portal, true);
  assert.equal(R.gatewaySubmit(p, '0000').outcome, 'accepted');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('mission 15: renewal then transfer; a missed holder document is caught', async () => {
  const p = await seedMission(15, 'standard', user);
  createSequence(p, { submissionType: 'renewal', subType: 'initial' });
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'eu-eaf-renewal', 'eu:1.2');
  placeDoc(p, '0001', 'd-co-renewal', '2.5');
  placeDoc(p, '0001', 'eu-pi-renewal', 'eu:1.3.1', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'eu-pi').id });
  assert.equal(validate(p, '0001').counts.High, 0, [...validate(p, '0001').keys].join(', '));
  await publishWithFiles(p, '0001');
  createSequence(p, { submissionType: 'transfer-ma', subType: 'initial' });
  addCoverLetter(p, '0002');
  placeDoc(p, '0002', 'eu-eaf-transfer', 'eu:1.2');
  placeDoc(p, '0002', 'eu-pi-transfer', 'eu:1.3.1', 'replace', { seq: '0001', leafId: leafOf(p, '0001', 'eu-pi-renewal').id });
  p.settings.applicant.name = missionById(15).newHolder;
  assert.ok(consistencyMatrix(p, '0002').issues.some((i) => i.fact.key === 'holder'), 'old pharmacovigilance summary still names the old holder');
  placeDoc(p, '0002', 'eu-pv-transfer', 'eu:1.8.1', 'replace', { seq: '0000', leafId: leafOf(p, '0000', 'eu-pv').id });
  answerAll(p);
  await publishWithFiles(p, '0002');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('mission 16: withdrawal letter, no deletes, scores 100; a delete loses points', async () => {
  const p = await seedMission(16, 'standard', user);
  createSequence(p, { submissionType: 'original-application', subType: 'amendment' });
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'd-356h-wd', '1.1');
  placeDoc(p, '0001', 'd-withdraw', '1.5.5');
  answerAll(p);
  const bad = structuredClone(p);
  const l = leafOf(bad, '0000', 'd-qos');
  addDeleteLeaf(bad, '0001', { seq: '0000', leafId: l.id, nodeCode: l.nodeCode });
  assert.ok(failed(evaluateMission(bad)).includes('noDelete'));
  await publishWithFiles(p, '0001');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('review: EU questions stop the clock, a rejected response reopens with the same number, answers resolve', async () => {
  const p = createProject({ name: 'rv', region: 'EU', user });
  buildComplete(p);
  await publishWithFiles(p, '0000');
  assert.equal(R.gatewaySubmit(p, '0000').outcome, 'accepted');
  let res;
  do res = R.advanceClock(p); while (!res.raised?.length);
  assert.equal(res.milestone.id, 'd120');
  assert.ok(p.review.clock.stopped);
  assert.equal(R.canAdvance(p).ok, false);
  const seq = R.prepareResponseSequence(p);
  assert.equal(seq.subType, 'response');
  assert.equal(seq.relatedSequence, '0000');
  // Send it once without the new data and with the cover letter removed: rejected.
  const cover = seq.leaves.find((l) => l.nodeCode === 'eu:1.0');
  seq.leaves = seq.leaves.filter((l) => l !== cover);
  await publishWithFiles(p, seq.number);
  assert.equal(R.gatewaySubmit(p, seq.number).outcome, 'rejected');
  R.reopenRejected(p, seq.number);
  assert.equal(seqByNumber(p, seq.number).status, 'draft');
  addCoverLetter(p, seq.number);
  for (const q of p.review.questions.filter((x) => x.fixDocId)) {
    const prior = seqByNumber(p, '0000').leaves.find((l) => l.nodeCode === q.section);
    placeDoc(p, seq.number, q.fixDocId, q.section, prior ? 'replace' : 'new', prior ? { seq: '0000', leafId: prior.id } : null);
  }
  await publishWithFiles(p, seq.number);
  const rec = R.gatewaySubmit(p, seq.number);
  assert.equal(rec.outcome, 'accepted');
  assert.equal(rec.attempt, 2);
  assert.ok(p.review.questions.every((q) => q.status === 'resolved'), JSON.stringify(p.review.questions.map((q) => q.note)));
  while (R.canAdvance(p).ok) R.advanceClock(p);
  assert.equal(p.review.clock.outcome.positive, true);
});

await t('review: US refuses to file a seriously incomplete application', async () => {
  const p = createProject({ name: 'rtf', user });
  buildComplete(p, { exclude: (d) => /^(2\.7|2\.5|3\.2\.P\.8)/.test(d.section) });
  await publishWithFiles(p, '0000');
  assert.equal(R.gatewaySubmit(p, '0000').outcome, 'accepted');
  R.advanceClock(p);
  assert.match(p.review.clock.outcome.text, /Refuse to file/);
});

await t('planning: critical path, late rows, reuse for another country', async () => {
  const s = P.schedule(P.defaultTasks(), '2026-11-02');
  assert.deepEqual(s.critical, ['t-csr', 't-ise', 't-cos', 't-lab', 't-m1', 't-pub', 't-val']);
  const tasks = P.defaultTasks();
  tasks.find((x) => x.id === 't-dp').days = 120;
  assert.ok(P.schedule(tasks, '2026-11-02').critical.includes('t-dp'), 'a longer task moves onto the critical path');
  const p = createProject({ name: 'pl', user });
  P.setPlanRow(p, '0000', '2.5', { due: '2020-01-01' });
  assert.ok(P.contentPlan(p, '0000').rows.find((r) => r.code === '2.5').late);
  buildComplete(p);
  await publishWithFiles(p, '0000');
  const res = P.reuseForCountry(p, 'EU', user);
  assert.ok(res.count > 50);
  assert.ok(res.project.sequences[0].leaves.every((l) => !l.nodeCode.startsWith('eu:') && l.operation === 'new'));
  assert.equal(p.plan.registrations.length, 2);
  assert.match(P.csv([{ a: 'x, "y"' }], [['a', 'A']]), /"x, ""y"""/);
});

console.log(`\n${pass} phase 3 tests passed`);
