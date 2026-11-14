// China (NMPA) eCTD region: folders, envelope, validator rules, mission 25, and the change package
// from the Variations Classifier's China pack.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setFontLoader } from '../src/engine/pdfgen.js';
import { createProject, seqByNumber, leafPath } from '../src/engine/model.js';
import { validate } from '../src/engine/validate.js';
import { buildComplete, seedMission, evaluateMission, missionById } from '../src/engine/missions.js';
import { publishSequence } from '../src/engine/backbone.js';
import { publishWithFiles, createSequence, addCoverLetter, placeDoc } from '../src/engine/ops.js';
import { parseChangePackage, importChangePackage } from '../src/engine/changepkg.js';
import { REGION_PACKS } from '../src/engine/tree.js';
setFontLoader(async () => fs.readFileSync(new URL('../src/assets/fonts/public-sans-latin-400.ttf', import.meta.url)));
const user = { userId: 'u-test', classId: null };
let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('ok -', name); };

await t('a complete China sequence is clean; folders and envelope follow the specification', async () => {
  const p = createProject({ name: 'cn', region: 'CN', user });
  buildComplete(p);
  const v = validate(p, '0000');
  assert.equal(v.findings.length, 0, v.findings.map((f) => f.ruleId).join(','));
  const cover = seqByNumber(p, '0000').leaves.find((l) => l.nodeCode === 'cn:1.0');
  assert.equal(leafPath(p, cover), 'm1/cn/00/cover-letter.pdf');
  const x = publishSequence(p, '0000').regional;
  assert.match(x, /<cn_ectd /);
  assert.match(x, /application-id="x202612345"/);
  assert.match(x, /<regulatory-activity type="initial" related-sequence="0000">/);
  assert.match(x, /xlink:href="03\/package-insert.pdf"[^>]*xml:lang="zh"/);
});

await t('the validator catches China-specific problems', async () => {
  const p = createProject({ name: 'cn', region: 'CN', user });
  buildComplete(p);
  const k = () => validate(p, '0000').keys;
  p.settings.cn.applicationNumber = 'y202612345'; assert.ok(k().has('CN-07:letter'));
  p.settings.cn.applicationNumber = '202612345'; assert.ok(k().has('CN-07:format'));
  p.settings.cn.applicationNumber = 'x202612345';
  p.sequences[0].subType = 'reformat'; assert.ok(k().has('CN-08:combo')); assert.ok(k().has('CN-09:first'));
  p.sequences[0].subType = 'initial';
  p.sequences[0].description = 'x'.repeat(121); assert.ok(k().has('CN-12:desc'));
  p.sequences[0].description = 'Initial';
  placeDoc(p, '0000', 'cn-3', 'cn:1.3.1'); assert.ok([...k()].some((x) => x.startsWith('CN-10')));
  const q = createProject({ name: 'cn2', region: 'CN', user });
  buildComplete(q, { exclude: (d) => d.section === 'cn:1.10.3' });
  assert.ok(validate(q, '0000').keys.has('CN-06:cn:1.10.3'));
});

await t('mission 25 scores 100', async () => {
  const p = await seedMission(25, 'standard', user);
  buildComplete(p);
  for (const q of missionById(25).quiz) p.mission.answers[q.id] = q.answer;
  await publishWithFiles(p, '0000');
  const ev = evaluateMission(p);
  assert.equal(ev.score, 100, ev.checks.filter((c) => !c.ok).map((c) => c.id).join(', '));
});

await t('a China change package starts a supplementary sequence 0001 that validates', async () => {
  const pkg = parseChangePackage(fs.readFileSync(new URL('./fixtures/change-package-cn.json', import.meta.url), 'utf8'));
  assert.equal(pkg.region, 'CN');
  const p = createProject({ name: 'cn', region: 'CN', user });
  buildComplete(p);
  await publishWithFiles(p, '0000');
  const { seq, warnings } = importChangePackage(p, pkg);
  assert.equal(seq.submissionType, 'supplemental');
  assert.equal(seq.number, '0001');
  assert.ok(REGION_PACKS.CN.submissionTypes.some((x) => x.value === seq.submissionType));
  assert.deepEqual(warnings.filter((w) => /not in this app/.test(w)), []);
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'cn-12', 'cn:1.2');
  placeDoc(p, '0001', 'cn-13', 'cn:1.4.1');
  const v = validate(p, '0001');
  assert.equal(v.counts.High, 0, v.findings.map((f) => `${f.ruleId} ${f.message}`).join('\n'));
  assert.match(publishSequence(p, '0001').regional, /<regulatory-activity type="supplemental" related-sequence="0001">/);
  const p2 = createProject({ name: 'gap', region: 'CN', user });
  buildComplete(p2); await publishWithFiles(p2, '0000');
  createSequence(p2, { submissionType: 'supplemental', subType: 'initial', number: '0002' });
  assert.ok(validate(p2, '0002').keys.has('CN-14:gap'));
});
console.log(`china tests: ${pass} passed`);
