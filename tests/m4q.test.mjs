// The ICH M4Q(R2) what-if: where the quality documents of a dossier would go under the Step 2 draft.
import assert from 'node:assert/strict';
import { INDEX } from '../src/engine/tree.js';
import { seedMission, buildComplete } from '../src/engine/missions.js';
import { analyseM4q, m4qCsv, MAP, R2, M4Q_STATUS, mapFor } from '../src/engine/m4q.js';

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

console.log(`M4Q(R2) what-if: ${n} tests passed`);
