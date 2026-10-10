// Runs against a local `wrangler dev` (BASE defaults to http://localhost:8787/ectd/v1).
import assert from 'node:assert/strict';
const BASE = process.env.BASE ?? 'http://localhost:8787/ectd/v1';
const call = async (method, path, { token, body, origin } = {}) => {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
};
let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('ok -', name); };

let inst, stu, cls, asg, sub;
await t('health', async () => { assert.equal((await call('GET', '/health')).data.ok, true); });
await t('instructor creates a class and gets a join code', async () => {
  const r = await call('POST', '/classes', { body: { name: 'RA Publishing 101', instructorName: 'Dr Test' } });
  assert.equal(r.status, 201); assert.match(r.data.class.code, /^[A-Z2-9]{6}$/);
  inst = r.data.instructorKey; cls = r.data.class;
});
await t('a wrong join code is refused', async () => { assert.equal((await call('POST', '/join', { body: { code: 'ZZZZZZ', name: 'X' } })).status, 404); });
await t('student joins with the code', async () => {
  const r = await call('POST', '/join', { body: { code: cls.code.toLowerCase(), name: 'Asha', email: 'asha@example.org', userId: 'u-1' } });
  assert.equal(r.status, 201); stu = r.data.token;
});
await t('only the instructor sets assignments', async () => {
  assert.equal((await call('POST', '/assignments', { token: stu, body: { missionId: 1, dueAt: '2030-01-01' } })).status, 403);
  const r = await call('POST', '/assignments', { token: inst, body: { missionId: 1, difficulty: 'expert', dueAt: '2030-01-01T10:00:00Z', note: 'First NDA' } });
  assert.equal(r.status, 201); asg = r.data.assignment;
});
await t('a project for the wrong mission is refused', async () => {
  const r = await call('POST', `/assignments/${asg.id}/submissions`, { token: stu, body: { project: { project: { mission: { id: 2 } } }, score: 90 } });
  assert.equal(r.status, 400);
});
await t('student submits; instructor sees it, verifies the score and comments', async () => {
  const r = await call('POST', `/assignments/${asg.id}/submissions`, { token: stu, body: { project: { kind: 'x', project: { id: 'p1', mission: { id: 1 } } }, score: 95, axes: { technical: 100 }, counts: { High: 0 }, checks: [{ id: 'meta', ok: true }] } });
  assert.equal(r.status, 201); sub = r.data.submission;
  const me = await call('GET', '/me', { token: inst });
  assert.equal(me.data.role, 'instructor'); assert.equal(me.data.submissions.length, 1); assert.equal(me.data.members[0].name, 'Asha');
  const full = await call('GET', `/submissions/${sub.id}`, { token: inst });
  assert.equal(full.data.submission.project.project.id, 'p1');
  assert.equal((await call('PATCH', `/submissions/${sub.id}`, { token: inst, body: { verifiedScore: 90 } })).data.verifiedScore, 90);
  assert.equal((await call('POST', `/submissions/${sub.id}/comments`, { token: inst, body: { body: 'Good work; check 1.3.3.' } })).status, 201);
});
await t('student sees comments and the leaderboard uses the verified score', async () => {
  const me = await call('GET', '/me', { token: stu });
  assert.equal(me.data.role, 'student'); assert.equal(me.data.comments[0].authorName, 'Dr Test');
  assert.equal(me.data.leaderboard[0].total, 90);
});
await t('another student cannot read the submission', async () => {
  const other = (await call('POST', '/join', { body: { code: cls.code, name: 'Ben' } })).data.token;
  assert.equal((await call('GET', `/submissions/${sub.id}`, { token: other })).status, 403);
});
await t('CORS allows the app origin and localhost only', async () => {
  assert.equal((await call('GET', '/health', { origin: 'https://randomthingsonlineatsk-cloud.github.io' })).headers.get('access-control-allow-origin'), 'https://randomthingsonlineatsk-cloud.github.io');
  assert.equal((await call('GET', '/health', { origin: 'https://evil.example' })).headers.get('access-control-allow-origin'), null);
});
await t('a bad key is refused, and deleting the class removes access', async () => {
  assert.equal((await call('GET', '/me', { token: 'nope' })).status, 401);
  assert.equal((await call('DELETE', '/class', { token: inst })).data.ok, true);
  assert.equal((await call('GET', '/me', { token: stu })).status, 401);
});
console.log(`\n${pass} classroom API tests passed`);
