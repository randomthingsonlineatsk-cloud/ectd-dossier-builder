// eCTD v4.0 for the US and EU, and the v4.0 Migration Lab (forward compatibility from v3.2.2).
import assert from 'node:assert/strict';
import { createProject, seqByNumber } from '../src/engine/model.js';
import { seedMission, buildComplete } from '../src/engine/missions.js';
import { publish, createSequence, placeDoc, addCoverLetter } from '../src/engine/ops.js';
import { validate } from '../src/engine/validate.js';
import { publishSequence } from '../src/engine/backbone.js';
import { analyseMigration, convertToV4, migrationCsv } from '../src/engine/migrate.js';

const user = { userId: 'u-m', classId: null };
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await t('a US NDA and an EU centralised MAA publish as v4.0 submission units', async () => {
  for (const [region, mission] of [['US', 1], ['EU', 2]]) {
    const m = await seedMission(mission, 'standard', user); buildComplete(m);
    const p = createProject({ name: 'v4', productId: m.productId, region, ectdVersion: '4.0', user });
    p.documents = m.documents; p.settings = { ...m.settings, sequenceStart: '0001' }; p.sequences[0].leaves = m.sequences[0].leaves.map((l) => ({ ...l }));
    assert.equal(validate(p, '0001').counts.High, 0, region);
    const pkg = publishSequence(p, '0001');
    assert.ok(pkg.v4); assert.ok(pkg.index.includes('<sequenceNumber value="1"/>'));
    if (region === 'EU') {
      assert.ok(pkg.index.includes('code="100000155047"'), 'EU initial unit code'); assert.ok(pkg.index.includes('code="100000155689"'), 'EU initial MAA');
      assert.ok(pkg.index.includes('code="100000155059"'), 'centralised procedure');
      assert.ok(pkg.unit.files.filter((f) => f.path.startsWith('m1/')).every((f) => f.path.split('/').length === 2), 'EU Module 1 in one folder');
    } else {
      assert.ok(pkg.index.includes('TRAINING-FDA-SUBMISSION-TYPE')); assert.ok(pkg.index.includes('extension="NDA '));
    }
  }
});

await t('Migration Lab: a two-sequence US lifecycle moves to v4.0 as unit 2, replacing a v3.2.2 leaf by reference', async () => {
  const p = await seedMission(4, 'standard', user);
  createSequence(p, { submissionType: 'original-application', subType: 'amendment', description: 'Response to IR' });
  const s0 = seqByNumber(p, '0000'); const old = (id) => s0.leaves.find((l) => l.docId === id);
  placeDoc(p, '0001', 'd-356h', '1.1'); addCoverLetter(p, '0001'); placeDoc(p, '0001', 'd-ir-resp', '1.11.1');
  placeDoc(p, '0001', 'd-p51-v2', '3.2.P.5.1', 'replace', { seq: '0000', leafId: old('d-p51').id });
  publish(p, '0001');
  const a = analyseMigration(p);
  assert.equal(a.lastSequence, '0001'); assert.equal(a.firstUnit, 2);
  assert.ok(a.rows.length > 20);
  assert.ok(a.rows.every((r) => r.cou), 'every current leaf gets a context of use');
  assert.ok(!a.rows.some((r) => r.leafId === old('d-p51').id), 'the replaced leaf stays in the v3.2.2 history');
  assert.ok(a.issues.some((i) => i.rule === 'MIG-07'));
  const study = a.rows.find((r) => r.keywords.some((k) => k.type === 'study'));
  if (study) assert.ok(study.keywords.some((k) => k.type === 'document type'), 'file tag becomes a document type keyword');
  assert.ok(a.rows.some((r) => r.keywords.some((k) => k.type.startsWith('sender-defined'))), 'heading attributes become sender-defined keywords');
  assert.ok(migrationCsv(p, a).split('\n').length > a.rows.length);
  assert.equal(a.ready, a.high === 0);
  assert.ok(a.ready, JSON.stringify(a.issues.filter((i) => i.sev === 'High')));
  const v4 = convertToV4(p);
  assert.equal(v4.ectdVersion, '4.0'); assert.ok(v4.sequences.filter((s) => s.legacy).length === 2);
  const unit = v4.sequences.find((s) => !s.legacy); assert.equal(unit.number, '0002'); assert.equal(unit.forwardFrom, '0001');
  // replace the v3.2.2 stability leaf from the first v4.0 unit
  const s0b = seqByNumber(v4, '0000');
  placeDoc(v4, '0002', 'd-p83-v2', '3.2.P.8.3', 'replace', { seq: '0000', leafId: s0b.leaves.find((l) => l.docId === 'd-p83').id });
  const pkg = publishSequence(v4, '0002');
  assert.ok(pkg.v4);
  assert.ok(pkg.index.includes('forward compatibility: first v4.0 unit after v3.2.2 sequence 0001'));
  assert.ok(pkg.index.includes('leaf reference: v3.2.2 sequence 0000'));
  assert.ok(pkg.index.includes('<sequenceNumber value="2"/>'));
  assert.ok(!publishSequence(v4, '0000').v4, 'v3.2.2 history still shows its own backbone');
  assert.ok(validate(v4, '0002').findings.every((f) => f.ruleId !== 'V4-01'));
  assert.ok(validate(v4, '0002').findings.every((f) => f.ruleId !== 'V4-03'), 'the first unit is numbered and carries the v3.2.2 number');
  assert.ok(validate(v4, '0000').findings.every((f) => !f.ruleId.startsWith('V4-')), 'v3.2.2 history is validated as v3.2.2');
  const bad = structuredClone(v4); const u = bad.sequences.find((s) => !s.legacy); u.forwardFrom = null; u.number = '0005';
  assert.ok(validate(bad, '0005').findings.some((f) => f.ruleId === 'V4-03'));
  assert.ok(analyseMigration(v4).issues.some((i) => i.rule === 'MIG-06'), 'a v4.0 project cannot be migrated again');
});

await t('Migration Lab flags what blocks a move', async () => {
  const fresh = createProject({ name: 'f', region: 'US', user });
  assert.ok(analyseMigration(fresh).issues.some((i) => i.rule === 'MIG-06'));
  assert.throws(() => convertToV4(fresh));
  const p = await seedMission(4, 'standard', user);
  createSequence(p, { submissionType: 'original-application', subType: 'amendment' }); placeDoc(p, '0001', 'd-356h', '1.1');
  assert.ok(analyseMigration(p).issues.some((i) => i.rule === 'MIG-05'));
  const eu = await seedMission(2, 'standard', user); buildComplete(eu); publish(eu, '0000');
  const ae = analyseMigration(eu);
  assert.ok(ae.issues.some((i) => i.rule === 'MIG-08'));
  assert.ok(ae.rows.filter((r) => r.nodeCode.startsWith('eu:')).every((r) => r.v4Path.split('/').length === 2));
});
console.log(`migrate: ${n} tests passed`);
