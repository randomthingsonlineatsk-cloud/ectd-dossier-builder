// The ICH M4Q(R2) what-if: where the quality documents of a dossier would go under the Step 2 draft.
import assert from 'node:assert/strict';
import { INDEX } from '../src/engine/tree.js';
import { seedMission, buildComplete } from '../src/engine/missions.js';
import { analyseM4q, m4qCsv, MAP, R2, M4Q_STATUS, mapFor, starterDrafts, checkDrafts, draftsHtml, r2Structure, changeSummary, partOf } from '../src/engine/m4q.js';
import { PRODUCTS, createProject } from '../src/engine/model.js';

const user = { userId: 'u-q', classId: null };
let n = 0; const t = async (name, fn) => { await fn(); n++; };

await t('every R1 quality heading in the tree has a mapping, and every R2 target is a heading of the draft', async () => {
  for (const code of INDEX.order.filter((c) => c === '2.3' || c.startsWith('3.2.') || c === '3.3')) assert.ok(mapFor(code), code);
  for (const m of Object.values(MAP)) for (const c of [...m.core, ...(m.data ? [m.data] : [])]) assert.ok(R2[c], c);
  assert.equal(M4Q_STATUS.step4Target, '2027-06');
});

await t('a complete NDA: every quality leaf is placed or flagged, the QOS and 3.2.P.2 are rewrites, 3.2.R has no place', async () => {
  const m = await seedMission(1, 'standard', user); buildComplete(m);
  const a = analyseM4q(m);
  assert.ok(a.rows.length >= 20, `${a.rows.length} quality leaves`);
  assert.ok(a.rows.every((r) => r.nodeCode === '2.3' || r.nodeCode.startsWith('3.')));
  const by = (c) => a.rows.find((r) => r.nodeCode === c);
  if (by('2.3')) assert.equal(by('2.3').action, 'rewrite');
  if (by('3.2.P.2')) { assert.equal(by('3.2.P.2').action, 'rewrite'); assert.ok(by('3.2.P.2').core.some((x) => x.startsWith('2.3.2.1'))); }
  if (by('3.2.S.4.2')) assert.match(by('3.2.S.4.2').data, /^3\.2\.AP/);
  if (by('3.2.R')) assert.equal(by('3.2.R').action, 'none');
  assert.ok(a.coverage > 80);
  assert.equal(a.gaps.length, 5);
  const csv = m4qCsv(m, a);
  assert.match(csv, /R2 Module 2\.3/); assert.match(csv, /Step 2 draft/);
});

await t('drafting: QTPP and control strategy start from the product, checks catch gaps, exports carry them', async () => {
  const m = await seedMission(1, 'standard', user); buildComplete(m);
  assert.deepEqual(checkDrafts(null).map((f) => f.sev), ['High']);
  const d = starterDrafts(m, PRODUCTS[m.productId]);
  assert.ok(d.qtpp.length >= 8); assert.ok(d.qtpp.some((r) => r.attribute === 'Dissolution' && /Q = 70%/.test(r.target)));
  assert.equal(d.cs.length, d.qtpp.filter((r) => r.cqa).length);
  const bio = starterDrafts({ productId: 'mab-infusion' }, PRODUCTS['mab-infusion']);
  assert.ok(bio.qtpp.some((r) => r.attribute === 'Potency')); assert.ok(bio.qtpp.some((r) => /Sterility/.test(r.attribute)));
  const f0 = checkDrafts(d);
  assert.ok(f0.some((f) => f.sev === 'High' && /no material, process or in-process control/.test(f.msg)), 'starter rows without controls are flagged');
  for (const c of d.cs) c.process = 'Validated process step';
  d.ec.push({ element: 'Compression force range', isEc: true, category: '', justification: '' });
  const f1 = checkDrafts(d);
  assert.ok(!f1.some((f) => f.sev === 'High'));
  assert.ok(f1.some((f) => f.where === '2.3.5.2' && /reporting category/.test(f.msg)));
  m.m4q = d;
  const a = analyseM4q(m);
  assert.ok(a.gaps.find((g) => g.code === '2.3.2.1').drafted); assert.ok(!a.gaps.find((g) => g.code === '2.3.5.3').drafted);
  const csv = m4qCsv(m, a);
  assert.match(csv, /2\.3\.2\.1 Quality Target Product Profile/); assert.match(csv, /Compression force range/); assert.match(csv, /D\/M\/C\/S part/);
  const html = draftsHtml(m, d, PRODUCTS[m.productId]);
  assert.match(html, /<h2>2\.3\.2\.3 Overall Control Strategy Representation<\/h2>/); assert.match(html, /Not for submission/);
  assert.ok(changeSummary(m).length >= 1);
});

await t('structure view: materials with D/M/C/S parts and the documents that feed them', async () => {
  const m = await seedMission(1, 'standard', user); buildComplete(m);
  const st = r2Structure(analyseM4q(m));
  assert.equal(st.length, 12);
  const ds = st.find((x) => x.id === 'DS');
  assert.deepEqual(ds.parts.slice(0, 4).map((p) => p.part), ['D', 'M', 'C', 'S']);
  assert.ok(ds.count > 0);
  assert.equal(partOf('3.2.P.5.1'), 'C'); assert.equal(partOf('3.2.S.7.3'), 'S'); assert.equal(partOf('3.2.P.2'), null);
  assert.ok(st.find((x) => x.id === 'AP').parts[0].docs.length > 0, 'analytical procedures collected from 3.2.S.4.2 and 3.2.P.5.2');
});

await t('library preview: a new project shows where unplaced documents would go; missions keep it closed until submitted', async () => {
  const p = createProject({ name: 'blank', productId: 'nce-tablet', region: 'US', user });
  const a = analyseM4q(p);
  assert.equal(a.placedCount, 0); assert.ok(a.previewCount >= 20, `${a.previewCount}`);
  assert.ok(a.rows.every((r) => !r.placed)); assert.ok(!a.rows.some((r) => /single file|only/i.test(r.title) && /Dissolution test only/.test(r.title)), 'decoys left out');
  assert.ok(r2Structure(a).find((x) => x.id === 'DP').count > 0);
  assert.match(m4qCsv(p, a), /Library preview \(not placed\)/);
  const std = await seedMission(1, 'standard', user);
  const s1 = analyseM4q(std);
  assert.equal(s1.previewCount, 0); assert.ok(s1.previewHidden > 0);
  std.mission.submitted = new Date().toISOString();
  assert.ok(analyseM4q(std).previewCount > 0);
  const g = await seedMission(1, 'guided', user);
  assert.ok(analyseM4q(g).previewCount > 0);
  const full = await seedMission(1, 'standard', user); buildComplete(full);
  const af = analyseM4q(full);
  assert.ok(af.placedCount >= 20); assert.equal(af.rows.filter((r) => r.placed).length, af.placedCount);
});

console.log(`M4Q(R2) what-if: ${n} tests passed`);
