// Classroom mode API for the eCTD Dossier Builder: a Cloudflare Worker with a D1 database.
// Instructors create a class and get a join code; students join with the code and their
// name, start assigned missions in the app, and submit their project file. Instructors see
// scores and validation summaries, verify scores in their own browser, and comment.
// Optional email reminders go out through Brevo on a schedule.
//
// All routes live under PREFIX (default /ectd/v1) so the Worker can be shared with other apps.
// Auth: a random bearer token per instructor (the class key) and per student; only SHA-256
// hashes of tokens are stored.

const MAX_PROJECT_BYTES = 1_500_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DIFFICULTIES = ['guided', 'standard', 'expert'];

const now = () => new Date().toISOString();
const randomId = (prefix) => `${prefix}_${[...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const joinCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const parseJSON = (s, fallback = null) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') ?? '';
  const allowed = String(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return ok ? { 'access-control-allow-origin': origin || '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'access-control-max-age': '86400', vary: 'origin' } : {};
}

async function body(request) {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > MAX_PROJECT_BYTES + 200_000) throw new HttpError(413, 'The request is too large.');
  try { return await request.json(); } catch { throw new HttpError(400, 'The request body must be JSON.'); }
}

function bearer(request) {
  const h = request.headers.get('authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new HttpError(401, 'Sign in to the class first.');
  return m[1].trim();
}

// Resolves the caller: { role: 'instructor', cls } or { role: 'student', member, cls }.
async function who(request, env) {
  const hash = await sha256Hex(bearer(request));
  const cls = await env.DB.prepare('SELECT * FROM ectd_classes WHERE instructor_key_hash = ?').bind(hash).first();
  if (cls) return { role: 'instructor', cls };
  const member = await env.DB.prepare('SELECT * FROM ectd_members WHERE token_hash = ?').bind(hash).first();
  if (member) {
    const c = await env.DB.prepare('SELECT * FROM ectd_classes WHERE id = ?').bind(member.class_id).first();
    return { role: 'student', member, cls: c };
  }
  throw new HttpError(401, 'That key is not recognised. It may belong to a deleted class.');
}

const publicClass = (c) => ({ id: c.id, name: c.name, code: c.code, instructorName: c.instructor_name, createdAt: c.created_at });
const publicAssignment = (a) => ({ id: a.id, missionId: a.mission_id, difficulty: a.difficulty, dueAt: a.due_at, note: a.note ?? '', createdAt: a.created_at });
const publicSubmission = (s, withProject = false) => ({
  id: s.id, assignmentId: s.assignment_id, memberId: s.member_id, submittedAt: s.submitted_at, score: s.score, verifiedScore: s.verified_score,
  axes: parseJSON(s.axes), counts: parseJSON(s.counts), checks: parseJSON(s.checks), size: s.size, ...(withProject ? { project: parseJSON(s.project) } : {}),
});

async function leaderboard(env, classId) {
  // Best score per member per assignment (verified score wins over the reported one), summed.
  const rows = await env.DB.prepare(`
    SELECT m.id AS member_id, m.name AS name, s.assignment_id AS assignment_id,
           MAX(COALESCE(s.verified_score, s.score)) AS best
    FROM ectd_members m
    LEFT JOIN ectd_submissions s ON s.member_id = m.id
    WHERE m.class_id = ?
    GROUP BY m.id, s.assignment_id`).bind(classId).all();
  const byMember = new Map();
  for (const r of rows.results ?? []) {
    const e = byMember.get(r.member_id) ?? { memberId: r.member_id, name: r.name, total: 0, completed: 0 };
    if (r.assignment_id) { e.total += r.best ?? 0; e.completed += (r.best ?? 0) >= 80 ? 1 : 0; }
    byMember.set(r.member_id, e);
  }
  return [...byMember.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).map((e, i) => ({ rank: i + 1, ...e }));
}

async function submissionAccess(env, me, submissionId) {
  const s = await env.DB.prepare(`SELECT s.*, a.class_id FROM ectd_submissions s JOIN ectd_assignments a ON a.id = s.assignment_id WHERE s.id = ?`).bind(submissionId).first();
  if (!s || s.class_id !== me.cls.id) throw new HttpError(404, 'Submission not found.');
  if (me.role === 'student' && s.member_id !== me.member.id) throw new HttpError(403, 'You can only see your own submissions.');
  return s;
}

async function route(request, env, path) {
  const method = request.method;
  const seg = path.split('/').filter(Boolean);

  if (method === 'GET' && seg.length === 1 && seg[0] === 'health') return json({ ok: true, service: 'ectd-classroom', time: now() });

  // Instructor creates a class.
  if (method === 'POST' && seg[0] === 'classes' && seg.length === 1) {
    const b = await body(request);
    const name = clean(b.name, 120);
    const instructorName = clean(b.instructorName, 120);
    if (!name || !instructorName) throw new HttpError(400, 'Give the class a name and your name.');
    const key = randomToken();
    const cls = { id: randomId('cls'), name, code: joinCode(), instructor_name: instructorName, instructor_email: clean(b.instructorEmail, 200) || null, instructor_key_hash: await sha256Hex(key), created_at: now() };
    for (let i = 0; i < 5; i++) {
      try {
        await env.DB.prepare('INSERT INTO ectd_classes (id, name, code, instructor_name, instructor_email, instructor_key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(cls.id, cls.name, cls.code, cls.instructor_name, cls.instructor_email, cls.instructor_key_hash, cls.created_at).run();
        return json({ class: publicClass(cls), instructorKey: key }, 201);
      } catch (e) {
        if (!String(e.message).includes('UNIQUE')) throw e;
        cls.code = joinCode();
      }
    }
    throw new HttpError(500, 'Could not make a unique join code. Try again.');
  }

  // Student joins with a code.
  if (method === 'POST' && seg[0] === 'join' && seg.length === 1) {
    const b = await body(request);
    const code = clean(b.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const name = clean(b.name, 120);
    if (!code || !name) throw new HttpError(400, 'Enter the join code and your name.');
    const cls = await env.DB.prepare('SELECT * FROM ectd_classes WHERE code = ?').bind(code).first();
    if (!cls) throw new HttpError(404, 'No class has that join code.');
    const token = randomToken();
    const member = { id: randomId('mem'), class_id: cls.id, name, email: clean(b.email, 200) || null, user_id: clean(b.userId, 80) || null, token_hash: await sha256Hex(token), joined_at: now() };
    await env.DB.prepare('INSERT INTO ectd_members (id, class_id, name, email, user_id, token_hash, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(member.id, member.class_id, member.name, member.email, member.user_id, member.token_hash, member.joined_at).run();
    return json({ class: publicClass(cls), member: { id: member.id, name: member.name }, token }, 201);
  }

  const me = await who(request, env);

  // The caller's view of the class.
  if (method === 'GET' && seg[0] === 'me' && seg.length === 1) {
    const assignments = (await env.DB.prepare('SELECT * FROM ectd_assignments WHERE class_id = ? ORDER BY due_at').bind(me.cls.id).all()).results.map(publicAssignment);
    const board = await leaderboard(env, me.cls.id);
    if (me.role === 'instructor') {
      const members = (await env.DB.prepare('SELECT id, name, email, joined_at FROM ectd_members WHERE class_id = ? ORDER BY name').bind(me.cls.id).all()).results
        .map((m) => ({ id: m.id, name: m.name, email: m.email, joinedAt: m.joined_at }));
      const subs = (await env.DB.prepare(`SELECT s.id, s.assignment_id, s.member_id, s.submitted_at, s.score, s.verified_score, s.axes, s.counts, s.checks, s.size
        FROM ectd_submissions s JOIN ectd_assignments a ON a.id = s.assignment_id WHERE a.class_id = ? ORDER BY s.submitted_at DESC`).bind(me.cls.id).all()).results.map((s) => publicSubmission(s));
      return json({ role: 'instructor', class: publicClass(me.cls), members, assignments, submissions: subs, leaderboard: board, reminders: !!env.BREVO_API_KEY });
    }
    const subs = (await env.DB.prepare('SELECT * FROM ectd_submissions WHERE member_id = ? ORDER BY submitted_at DESC').bind(me.member.id).all()).results.map((s) => publicSubmission(s));
    const ids = subs.map((s) => s.id);
    const comments = ids.length ? (await env.DB.prepare(`SELECT * FROM ectd_comments WHERE submission_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at`).bind(...ids).all()).results : [];
    return json({ role: 'student', class: publicClass(me.cls), member: { id: me.member.id, name: me.member.name }, assignments, submissions: subs,
      comments: comments.map((c) => ({ id: c.id, submissionId: c.submission_id, author: c.author, authorName: c.author_name, body: c.body, createdAt: c.created_at })), leaderboard: board });
  }

  // Instructor: assignments.
  if (seg[0] === 'assignments' && seg.length === 1 && method === 'POST') {
    if (me.role !== 'instructor') throw new HttpError(403, 'Only the instructor can set assignments.');
    const b = await body(request);
    const missionId = Number(b.missionId);
    if (!Number.isInteger(missionId) || missionId < 1 || missionId > 99) throw new HttpError(400, 'Choose a mission.');
    const difficulty = DIFFICULTIES.includes(b.difficulty) ? b.difficulty : 'standard';
    const due = new Date(b.dueAt);
    if (Number.isNaN(due.getTime())) throw new HttpError(400, 'Give a valid due date.');
    const a = { id: randomId('asg'), class_id: me.cls.id, mission_id: missionId, difficulty, due_at: due.toISOString(), note: clean(b.note, 500), created_at: now() };
    await env.DB.prepare('INSERT INTO ectd_assignments (id, class_id, mission_id, difficulty, due_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(a.id, a.class_id, a.mission_id, a.difficulty, a.due_at, a.note, a.created_at).run();
    return json({ assignment: publicAssignment(a) }, 201);
  }
  if (seg[0] === 'assignments' && seg.length === 2 && method === 'DELETE') {
    if (me.role !== 'instructor') throw new HttpError(403, 'Only the instructor can remove assignments.');
    const r = await env.DB.prepare('DELETE FROM ectd_assignments WHERE id = ? AND class_id = ?').bind(seg[1], me.cls.id).run();
    if (!r.meta?.changes) throw new HttpError(404, 'Assignment not found.');
    await env.DB.prepare('DELETE FROM ectd_submissions WHERE assignment_id = ?').bind(seg[1]).run();
    return json({ ok: true });
  }

  // Student: submit a project for an assignment.
  if (seg[0] === 'assignments' && seg.length === 3 && seg[2] === 'submissions' && method === 'POST') {
    if (me.role !== 'student') throw new HttpError(403, 'Only students submit work.');
    const a = await env.DB.prepare('SELECT * FROM ectd_assignments WHERE id = ? AND class_id = ?').bind(seg[1], me.cls.id).first();
    if (!a) throw new HttpError(404, 'Assignment not found.');
    const b = await body(request);
    const project = JSON.stringify(b.project ?? null);
    if (!b.project || project.length > MAX_PROJECT_BYTES) throw new HttpError(413, `Project files are limited to ${Math.round(MAX_PROJECT_BYTES / 1000)} KB.`);
    const missionId = b.project?.project?.mission?.id ?? b.project?.project?.missionId;
    if (Number(missionId) !== a.mission_id) throw new HttpError(400, `That project is not mission ${a.mission_id}.`);
    const score = Math.max(0, Math.min(100, Math.round(Number(b.score) || 0)));
    const s = { id: randomId('sub'), assignment_id: a.id, member_id: me.member.id, submitted_at: now(), score, axes: JSON.stringify(b.axes ?? null), counts: JSON.stringify(b.counts ?? null), checks: JSON.stringify(b.checks ?? null), project, size: project.length };
    await env.DB.prepare('INSERT INTO ectd_submissions (id, assignment_id, member_id, submitted_at, score, axes, counts, checks, project, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, s.assignment_id, s.member_id, s.submitted_at, s.score, s.axes, s.counts, s.checks, s.project, s.size).run();
    return json({ submission: publicSubmission(s), late: s.submitted_at > a.due_at }, 201);
  }

  // One submission (with the project file), its verified score, and comments.
  if (seg[0] === 'submissions' && seg.length === 2 && method === 'GET') {
    const s = await submissionAccess(env, me, seg[1]);
    const comments = (await env.DB.prepare('SELECT * FROM ectd_comments WHERE submission_id = ? ORDER BY created_at').bind(s.id).all()).results;
    return json({ submission: publicSubmission(s, true), comments: comments.map((c) => ({ id: c.id, author: c.author, authorName: c.author_name, body: c.body, createdAt: c.created_at })) });
  }
  if (seg[0] === 'submissions' && seg.length === 2 && method === 'PATCH') {
    if (me.role !== 'instructor') throw new HttpError(403, 'Only the instructor verifies scores.');
    const s = await submissionAccess(env, me, seg[1]);
    const b = await body(request);
    const v = Math.max(0, Math.min(100, Math.round(Number(b.verifiedScore))));
    if (Number.isNaN(v)) throw new HttpError(400, 'Give a score from 0 to 100.');
    await env.DB.prepare('UPDATE ectd_submissions SET verified_score = ? WHERE id = ?').bind(v, s.id).run();
    return json({ ok: true, verifiedScore: v });
  }
  if (seg[0] === 'submissions' && seg.length === 3 && seg[2] === 'comments' && method === 'POST') {
    const s = await submissionAccess(env, me, seg[1]);
    const b = await body(request);
    const text = clean(b.body, 2000);
    if (!text) throw new HttpError(400, 'Write a comment first.');
    const c = { id: randomId('cmt'), submission_id: s.id, author: me.role, author_name: me.role === 'instructor' ? me.cls.instructor_name : me.member.name, body: text, created_at: now() };
    await env.DB.prepare('INSERT INTO ectd_comments (id, submission_id, author, author_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(c.id, c.submission_id, c.author, c.author_name, c.body, c.created_at).run();
    return json({ comment: { id: c.id, author: c.author, authorName: c.author_name, body: c.body, createdAt: c.created_at } }, 201);
  }

  // Instructor removes a student, or deletes the class.
  if (seg[0] === 'members' && seg.length === 2 && method === 'DELETE') {
    if (me.role !== 'instructor') throw new HttpError(403, 'Only the instructor can remove students.');
    const r = await env.DB.prepare('DELETE FROM ectd_members WHERE id = ? AND class_id = ?').bind(seg[1], me.cls.id).run();
    if (!r.meta?.changes) throw new HttpError(404, 'Student not found.');
    await env.DB.prepare('DELETE FROM ectd_submissions WHERE member_id = ?').bind(seg[1]).run();
    return json({ ok: true });
  }
  if (seg[0] === 'class' && seg.length === 1 && method === 'DELETE') {
    if (me.role !== 'instructor') throw new HttpError(403, 'Only the instructor can delete the class.');
    const id = me.cls.id;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ectd_comments WHERE submission_id IN (SELECT s.id FROM ectd_submissions s JOIN ectd_assignments a ON a.id = s.assignment_id WHERE a.class_id = ?)').bind(id),
      env.DB.prepare('DELETE FROM ectd_submissions WHERE assignment_id IN (SELECT id FROM ectd_assignments WHERE class_id = ?)').bind(id),
      env.DB.prepare('DELETE FROM ectd_reminders WHERE assignment_id IN (SELECT id FROM ectd_assignments WHERE class_id = ?)').bind(id),
      env.DB.prepare('DELETE FROM ectd_assignments WHERE class_id = ?').bind(id),
      env.DB.prepare('DELETE FROM ectd_members WHERE class_id = ?').bind(id),
      env.DB.prepare('DELETE FROM ectd_classes WHERE id = ?').bind(id),
    ]);
    return json({ ok: true });
  }

  throw new HttpError(404, 'Not found.');
}

// Reminders: students with an email address and no submission, for assignments due within
// REMINDER_HOURS (default 48). One reminder per student per assignment.
export async function sendReminders(env, at = new Date()) {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) return { sent: 0, skipped: 'Brevo is not configured.' };
  const hours = Number(env.REMINDER_HOURS ?? 48);
  const until = new Date(at.getTime() + hours * 3600_000).toISOString();
  const rows = (await env.DB.prepare(`
    SELECT a.id AS assignment_id, a.mission_id, a.due_at, c.name AS class_name, m.id AS member_id, m.name, m.email
    FROM ectd_assignments a
    JOIN ectd_classes c ON c.id = a.class_id
    JOIN ectd_members m ON m.class_id = a.class_id
    WHERE a.due_at > ? AND a.due_at <= ? AND m.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ectd_submissions s WHERE s.assignment_id = a.id AND s.member_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM ectd_reminders r WHERE r.assignment_id = a.id AND r.member_id = m.id)
    LIMIT 200`).bind(at.toISOString(), until).all()).results ?? [];
  let sent = 0;
  for (const r of rows) {
    const appUrl = env.APP_URL ?? 'https://randomthingsonlineatsk-cloud.github.io/ectd-dossier-builder/';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME ?? 'eCTD Dossier Builder' },
        to: [{ email: r.email, name: r.name }],
        subject: `Reminder: mission ${r.mission_id} for ${r.class_name} is due soon`,
        textContent: `Hello ${r.name},\n\nMission ${r.mission_id} for ${r.class_name} is due on ${r.due_at.slice(0, 16).replace('T', ' ')} UTC and we have no submission from you yet.\n\nOpen the app, go to Classroom, and submit your project when you are ready: ${appUrl}#/classroom\n\nThis is a training exercise. All products and documents are fictional.`,
      }),
    });
    if (res.ok) {
      await env.DB.prepare('INSERT OR IGNORE INTO ectd_reminders (assignment_id, member_id, sent_at) VALUES (?, ?, ?)').bind(r.assignment_id, r.member_id, now()).run();
      sent++;
    }
  }
  return { sent, candidates: rows.length };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const prefix = env.PREFIX ?? '/ectd/v1';
    if (!url.pathname.startsWith(prefix)) return json({ error: 'Not found.' }, 404, cors);
    try {
      const res = await route(request, env, url.pathname.slice(prefix.length));
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json({ error: status === 500 ? 'Something went wrong on the classroom server.' : e.message }, status, cors);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReminders(env, new Date(event.scheduledTime)));
  },
};
