// Phase 6A, the Module 2 Summary Writer: sources, the claim checker, placing a summary, the validator
// and the consistency matrix, and missions 26 and 27.
import assert from 'node:assert/strict';
import { seedMission, evaluateMission, missionById, qosFixes } from '../src/engine/missions.js';
import { sources, blankDoc, checkDoc, claimsIn, placeSummary, fieldToken, linksOf, statedFacts, getDoc } from '../src/engine/module2.js';
import { validate } from '../src/engine/validate.js';
import { consistencyMatrix } from '../src/engine/consistency.js';
import { publishWithFiles } from '../src/engine/ops.js';
import { certificateStatus } from '../src/engine/progress.js';
import { PRODUCTS } from '../src/engine/model.js';
import ex from '../src/data/m2-ostrevia.json' with { type: 'json' };

const user = { userId: 'u-m2', classId: null };
let n = 0; const t = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error(`FAIL ${name}`); throw e; } };
const fill = (p, code, src) => { const d = getDoc(p, code); for (const [k, v] of Object.entries(src)) d.sections[k].text = v; if (d.sections['2.3.A']) Object.assign(d.sections['2.3.A'], { na: true, reason: 'Not applicable: a chemically synthesised small molecule.' }); return d; };

await t('Ostrevia numbers are the shared ones: VERDANT-1 is a first cohort of 45 of 324 planned', async () => {
  assert.match(PRODUCTS['nce-tablet'].facts.patients, /VERDANT-1: 45 of 324 planned/);
});

await t('every source points at a Module 3 leaf and its keywords find it', async () => {
  const p = await seedMission(26, 'standard', user);
  const list = sources(p);
  assert.ok(list.length >= 30);
  for (const s of list) { assert.match(s.leaf, /^3\./, s.id); assert.ok(s.near.length, s.id); }
  assert.equal(fieldToken(list.find((s) => s.id === 'p-shelf')), '⟦p-shelf=36 months⟧');
});

await t('the worked QOS and introduction are clean; the planted QOS has exactly its 15 errors', async () => {
  const p = await seedMission(26, 'standard', user);
  assert.equal(checkDoc(p, fill(p, '2.3', ex.qosModel)).errors.length, 0);
  assert.equal(checkDoc(p, fill(p, '2.2', ex.introModel)).errors.length, 0);
  const bad = checkDoc(p, fill(p, '2.3', ex.qosPlanted));
  assert.deepEqual([...new Set(bad.errors.map((e) => e.source))].sort(), [...ex.plantedErrors].sort());
  assert.equal(bad.errors.length, 15);
});

await t('each check fires on its own: no source, condition, stale field, n/a reason, empty heading, web link', async () => {
  const p = await seedMission(26, 'standard', user);
  const d = fill(p, '2.3', ex.qosModel);
  d.sections['2.3.P.4'].text = 'Lactose is limited to 12 mg per tablet.';
  d.sections['2.3.P.8'].text = 'Store below 30°C.';
  d.sections['2.3.S.5'].text = '⟦p-shelf=24 months⟧ see https://example.org';
  d.sections['2.3.A'].reason = 'n/a';
  d.sections['2.3.S.6'].text = '';
  const codes = checkDoc(p, d).findings.map((f) => f.code);
  for (const c of ['C1', 'C3', 'C2', 'C12', 'C0', 'L2']) assert.ok(codes.includes(c), c);
  const typed = checkDoc(p, fill(p, '2.3', ex.qosPlanted)).warnings.filter((w) => w.code === 'W1');
  assert.ok(typed.length > 5, 'typed values that match are warnings to link');
});

await t('a claim is found by its words, in its own part of the QOS', async () => {
  const p = await seedMission(26, 'standard', user);
  const c = claimsIn(p, '2.3.S.4', 'The assay limit is 98.0–102.0%.');
  assert.equal(c.length, 1); assert.equal(c[0].source.id, 's-assay'); assert.ok(c[0].ok);
  assert.equal(claimsIn(p, '2.3.P.5', 'The assay limit is 98.0–102.0%.')[0].source.id, 'p-assay');
});

await t('placing the QOS: a new version replaces the placeholder leaf, with links, and the validator reads it', async () => {
  const p = await seedMission(27, 'standard', user);
  const r = placeSummary(p, '0000', '2.3');
  assert.equal(r.errors, 15);
  const leaf = p.sequences[0].leaves.filter((l) => l.nodeCode === '2.3');
  assert.equal(leaf.length, 1); assert.equal(leaf[0].docId, 'm2-23-v1');
  const v = validate(p, '0000');
  assert.equal(v.findings.filter((f) => f.ruleId === 'M2-01').length, 15);
  assert.ok(p.documents['m2-23-v1'].links.includes('3.2.P.5.1'));
  // the consistency matrix now sees the wrong shelf life, assay and dissolution in 2.3
  const facts = statedFacts(p, p.module2.docs['2.3']);
  assert.equal(facts.shelfLife, '48 months'); assert.equal(facts.assay, '90.0-110.0% of label claim');
  const keys = consistencyMatrix(p, '0000').issues.map((i) => i.fact.key);
  for (const k of ['shelfLife', 'assay', 'dissolution', 'storage', 'batches', 'strengths', 'dsManufacturer']) assert.ok(keys.includes(k), k);
});

await t('mission 27: fixing every error, linking and publishing scores 100; the bar shows 15 of 15', async () => {
  const p = await seedMission(27, 'standard', user);
  assert.equal(qosFixes(p).fixed.length, 0);
  fill(p, '2.3', ex.qosModel);
  assert.equal(qosFixes(p).fixed.length, 15);
  placeSummary(p, '0000', '2.3');
  for (const q of missionById(27).quiz) p.mission.answers[q.id] = q.answer;
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.deepEqual(ev.checks.filter((c) => !c.ok).map((c) => c.id), []);
  assert.equal(ev.score, 100); assert.equal(ev.fixed, 15);
});

await t('mission 27 partial: typed corrections count as fixed but not as linked', async () => {
  const p = await seedMission(27, 'standard', user);
  const d = p.module2.docs['2.3'];
  d.sections['2.3.P.8'].text = d.sections['2.3.P.8'].text.replace('48 months', '36 months').replace('below 30°C', 'at 20°C to 25°C');
  assert.equal(qosFixes(p).fixed.length, 2);
  placeSummary(p, '0000', '2.3');
  const ev = evaluateMission(p);
  assert.equal(ev.fixed, 2); assert.ok(ev.score < 50);
});

await t('mission 26: a linked one-page introduction, placed and published, passes', async () => {
  const p = await seedMission(26, 'standard', user);
  fill(p, '2.2', ex.introModel);
  placeSummary(p, '0000', '2.2');
  for (const q of missionById(26).quiz) p.mission.answers[q.id] = q.answer;
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.deepEqual(ev.checks.filter((c) => !c.ok).map((c) => c.id), []);
});

await t('a published summary is replaced in the next sequence, not edited', async () => {
  const p = await seedMission(26, 'standard', user);
  fill(p, '2.2', ex.introModel); placeSummary(p, '0000', '2.2');
  await publishWithFiles(p, '0000');
  assert.throws(() => placeSummary(p, '0000', '2.2'), /published/);
  const { createSequence } = await import('../src/engine/ops.js');
  createSequence(p);
  const next = p.sequences.at(-1).number;
  placeSummary(p, next, '2.2');
  const l = p.sequences.at(-1).leaves.find((x) => x.nodeCode === '2.2');
  assert.equal(l.operation, 'replace'); assert.equal(l.target.seq, '0000'); assert.equal(l.docId, 'm2-22-v2');
});

await t('the certificate still asks for missions 1 to 25 and lessons 1 to 10', async () => {
  const s = certificateStatus({ attempts: [], lessonProgress: {}, lessonCount: 10 });
  assert.equal(s.missionScores.length, 25);
  assert.ok(s.missionScores.every((m) => m.id <= 25));
});

await t('blank documents carry the user and class', async () => {
  const p = await seedMission(26, 'standard', user);
  const d = blankDoc(p, '2.3');
  assert.equal(d.userId, p.userId); assert.ok('classId' in d);
  assert.deepEqual(linksOf(p, fill(p, '2.3', ex.qosModel)).filter((x) => !x.startsWith('3.')), []);
});

console.log(`Module 2 Summary Writer: ${n} tests passed`);
