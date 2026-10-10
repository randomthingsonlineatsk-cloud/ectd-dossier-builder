// Phase 5 engine tests: node tests/phase5.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setFontLoader } from '../src/engine/pdfgen.js';
import { seqByNumber, createProject } from '../src/engine/model.js';
import { validate } from '../src/engine/validate.js';
import { seedMission, evaluateMission, buildComplete, missionById } from '../src/engine/missions.js';
import { publishWithFiles, createSequence, placeDoc, addCoverLetter } from '../src/engine/ops.js';
import { consistencyMatrix, correctFact } from '../src/engine/consistency.js';
import { publishSequence } from '../src/engine/backbone.js';

setFontLoader(async () => fs.readFileSync(new URL('../src/assets/fonts/public-sans-latin-400.ttf', import.meta.url)));
const user = { userId: 'u-test', classId: null };
let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('ok -', name); };
const answerAll = (p) => { for (const q of missionById(p.mission.id).quiz ?? []) p.mission.answers[q.id] = q.answer; };
const failed = (ev) => ev.checks.filter((c) => !c.ok).map((c) => c.id);

await t('IND: 1571 is required and 356h is a trap; the protocol gets its own file tag', async () => {
  const p = createProject({ name: 'ind', appType: 'ind', variant: 'ind', user });
  buildComplete(p);
  assert.equal(validate(p, '0000').counts.High, 0);
  assert.match(publishSequence(p, '0000').regional, /application-type="ind"/);
  const f = p.sequences[0].leaves.find((l) => p.documents[l.docId]?.form === 'fda-1571');
  p.sequences[0].leaves = p.sequences[0].leaves.filter((l) => l !== f);
  assert.ok(validate(p, '0000').keys.has('M1-18:1.1/fda-1571'));
  assert.ok(publishSequence(p, '0000').stfs.some((s) => s.xml.includes('protocol-or-amendment')));
});

await t('mission 17: initial IND scores 100', async () => {
  const p = await seedMission(17, 'standard', user);
  buildComplete(p); answerAll(p);
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('mission 18: 505(b)(2) without the decoy scores 100; without the patent certification it fails', async () => {
  const p = await seedMission(18, 'standard', user);
  buildComplete(p);
  const bad = structuredClone(p);
  bad.sequences[0].leaves = bad.sequences[0].leaves.filter((l) => l.nodeCode !== '1.3.5.2');
  assert.ok(validate(bad, '0000').keys.has('M1-23:1.3.5.2'));
  answerAll(p);
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('mission 19: DMF then a letter of authorization scores 100', async () => {
  const p = await seedMission(19, 'standard', user);
  assert.match(p.settings.applicant.name, /Corvane/);
  buildComplete(p); answerAll(p);
  assert.match(publishSequence(p, '0000').regional, /application-type="dmf"/);
  await publishWithFiles(p, '0000');
  createSequence(p, { submissionType: 'original-application', subType: 'amendment' });
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'dmf-3938', '1.1');
  placeDoc(p, '0001', 'dmf-loa', '1.4.1');
  await publishWithFiles(p, '0001');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('EU decentralised: envelopes per state, national PI per state, the EMA folder is refused', async () => {
  const p = createProject({ name: 'dcp', region: 'EU', appType: 'maa', variant: 'dcp', user });
  buildComplete(p);
  const xml = publishSequence(p, '0000').regional;
  assert.equal((xml.match(/<envelope country=/g) ?? []).length, 4);
  assert.match(xml, /<pi-doc xml:lang="de" type="combined" country="de">/);
  placeDoc(p, '0000', 'eu-pi-ema', 'eu:1.3.1');
  const keys = validate(p, '0000').keys;
  assert.ok([...keys].some((k) => k.startsWith('EU-15')));
  p.settings.eu.cms = [...p.settings.eu.cms, 'es'];
  assert.ok(validate(p, '0000').keys.has('EU-14:es'));
  p.settings.eu.trackingNumber = 'EMEA/H/C/006123';
  assert.ok(validate(p, '0000').keys.has('BB-06:trackingNumber'));
});

await t('mission 20: decentralised procedure scores 100', async () => {
  const p = await seedMission(20, 'standard', user);
  assert.equal(p.settings.eu.rms, '');
  Object.assign(p.settings.eu, { rms: 'nl', cms: ['de', 'fr', 'ie'] });
  buildComplete(p); answerAll(p);
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

await t('mission 21: ASMF with AP and RP scores 100; restricted detail in the AP is caught', async () => {
  const p = await seedMission(21, 'standard', user);
  buildComplete(p); answerAll(p);
  const x = publishSequence(p, '0000').index;
  assert.match(x, /substance="lumiravostat AP"/);
  assert.match(x, /substance="lumiravostat RP"/);
  const bad = structuredClone(p);
  placeDoc(bad, '0000', 'ap-trap-s23', '3.2.S.2.3');
  assert.ok([...validate(bad, '0000').keys].some((k) => k.startsWith('EU-17')));
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, failed(ev).join(', '));
});

console.log(`\n${pass} phase 5 tests passed`);
