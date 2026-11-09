// Skills Passport record: the seal and the verification code can be recomputed from the record,
// and any edit breaks them.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { ectdRecord, sealOf, PASSPORT_KIND } from '../src/engine/passport.js';
import { verificationCode } from '../src/engine/certpdf.js';
import { sha256 } from '../src/engine/sha256.js';

const status = { missionScores: [{ id: 'm1', score: 92 }, { id: 'm2', score: 81 }], exam: { score: 88 }, criteria: [{ label: 'Every mission passed', met: true }, { label: 'Final exam 80% or more', met: true }], distinction: false, eligible: true };
const r = ectdRecord({ name: ' Asha Rao ', userId: 'u-123', status, date: '2026-11-09' });
assert.equal(r.kind, PASSPORT_KIND);
assert.equal(r.name, 'Asha Rao');
assert.equal(r.code, verificationCode({ name: 'Asha Rao', userId: 'u-123', status, date: '2026-11-09' }));
const h = sha256(r.basis).toUpperCase();
assert.equal(r.code, `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`);
assert.equal(r.seal, sealOf(r));
assert.notEqual(sealOf({ ...r, name: 'Someone Else' }), r.seal);
assert.equal(JSON.parse(r.basis).name, 'Asha Rao');
if (process.env.PASSPORT_FIXTURES) writeFileSync(`${process.env.PASSPORT_FIXTURES}/ectd.json`, JSON.stringify(r, null, 2));
console.log('passport: 7 checks passed');
