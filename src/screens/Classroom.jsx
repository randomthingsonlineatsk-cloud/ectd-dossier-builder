import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../ctx.js';
import { go } from '../App.jsx';
import { MISSIONS, LEVELS, missionById, seedMission } from '../engine/missions.js';
import { saveAttempt } from '../engine/db.js';
import { uid } from '../engine/model.js';
import { download, parseProjectFile } from '../engine/io.js';
import { loadSession, saveSession, api, submissionPayload, verifyProject, isLate, BUILT_IN_API } from '../engine/classroom.js';

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const mTitle = (id) => `${id}. ${missionById(id)?.title ?? 'Mission'}`;

export default function Classroom() {
  const { toast, updateUser } = useApp();
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadSession().then(setSession).catch(() => setSession({ api: BUILT_IN_API })); }, []);
  const persist = async (s) => { setSession(s); await saveSession(s); };

  const refresh = useCallback(async (s = session) => {
    if (!s?.token) return;
    setBusy(true);
    try { setData(await api(s, 'GET', '/me')); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }, [session, toast]);
  useEffect(() => { if (session?.token) refresh(session); }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    if (!window.confirm(session.role === 'instructor' ? 'Sign out of this class? Keep your class key: you need it to sign back in.' : 'Leave this class on this device? Your saved work stays in this browser.')) return;
    await persist({ api: session.api });
    await updateUser({ classId: null });
    setData(null);
  };

  if (!session) return <div className="page muted">Loading…</div>;
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <h1>Classroom</h1>
      <p>For courses and study groups. An instructor creates a class and shares its join code; students join, start the assigned missions here, and submit their project files. The instructor sees scores and validation results, re-checks each score in their own browser, and comments. Without classroom mode the app stays fully browser-only.</p>
      {!session.token && <Setup session={session} persist={persist} toast={toast} updateUser={updateUser} />}
      {session.token && data?.role === 'student' && <Student session={session} data={data} refresh={refresh} busy={busy} toast={toast} signOut={signOut} />}
      {session.token && data?.role === 'instructor' && <Instructor session={session} data={data} refresh={refresh} busy={busy} toast={toast} signOut={signOut} persist={persist} />}
      {session.token && !data && <p className="muted">{busy ? 'Loading the class…' : <>Could not load the class. <button className="btn small" onClick={() => refresh()}>Try again</button> <button className="btn small ghost" onClick={signOut}>Sign out</button></>}</p>}
    </div>
  );
}

function Setup({ session, persist, toast, updateUser }) {
  const { user } = useApp();
  const [apiUrl, setApiUrl] = useState(session.api ?? '');
  const [join, setJoin] = useState({ code: '', name: user?.displayName ?? '', email: '' });
  const [make, setMake] = useState({ name: '', instructorName: '', instructorEmail: '' });
  const [key, setKey] = useState('');
  const [created, setCreated] = useState(null);
  const s = { ...session, api: apiUrl.trim() };

  const check = async () => {
    try { await api(s, 'GET', '/health'); await persist({ ...session, api: s.api }); toast('Classroom server reached.'); } catch (e) { toast(e.message, 'error'); }
  };
  const doJoin = async (e) => {
    e.preventDefault();
    try {
      const r = await api(s, 'POST', '/join', { ...join, userId: user?.userId });
      await updateUser({ classId: r.class.id, displayName: join.name });
      await persist({ api: s.api, role: 'student', token: r.token, classId: r.class.id, className: r.class.name, name: join.name });
      toast(`Joined ${r.class.name}.`);
    } catch (err) { toast(err.message, 'error'); }
  };
  const doCreate = async (e) => {
    e.preventDefault();
    try {
      const r = await api(s, 'POST', '/classes', make);
      setCreated(r);
    } catch (err) { toast(err.message, 'error'); }
  };
  const keyFile = (r) => JSON.stringify({ kind: 'ectd-dossier-builder/class-key', api: s.api, classId: r.class.id, className: r.class.name, code: r.class.code, instructorKey: r.instructorKey, note: 'Keep this file private. Anyone with this key can manage the class.' }, null, 2);
  const enterCreated = async () => {
    await persist({ api: s.api, role: 'instructor', token: created.instructorKey, classId: created.class.id, className: created.class.name, name: make.instructorName });
  };
  const signInWithKey = async (e) => {
    e.preventDefault();
    let k = key.trim();
    let apiFromFile = null;
    try { const f = JSON.parse(k); if (f.kind === 'ectd-dossier-builder/class-key') { k = f.instructorKey; apiFromFile = f.api; } } catch { /* plain key */ }
    const ss = { api: apiFromFile || s.api, token: k };
    try {
      const me = await api(ss, 'GET', '/me');
      if (me.role === 'student') await updateUser({ classId: me.class.id });
      await persist({ ...ss, role: me.role, classId: me.class.id, className: me.class.name, name: me.member?.name ?? me.class.instructorName });
    } catch (err) { toast(err.message, 'error'); }
  };

  if (created) {
    return (
      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: 'var(--step-1)' }}>Class created: {created.class.name}</h2>
        <p>Join code for students: <strong className="join-code">{created.class.code}</strong></p>
        <p className="callout warn">Your class key is shown once. Download it and keep it private: it is the only way to manage the class from another device.</p>
        <pre className="xml" style={{ whiteSpace: 'pre-wrap' }}>{created.instructorKey}</pre>
        <div className="row">
          <button className="btn" onClick={() => download(`class-key-${created.class.code}.json`, keyFile(created))}>Download the class key</button>
          <button className="btn primary" onClick={enterCreated}>Open the class</button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack" style={{ marginTop: '1rem' }}>
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Classroom server</h2>
        {BUILT_IN_API ? <p className="small">This copy of the app is set up with a classroom server.</p> : <p className="small">Classroom mode needs a small server: a Cloudflare Worker with a D1 database. Your instructor gives you its address, or you deploy your own from the <span className="mono">worker/</span> folder of the source (see its README).</p>}
        <div className="row" style={{ alignItems: 'end' }}>
          <label className="field" style={{ flex: 1, minWidth: 260 }}>Server address<input type="url" value={apiUrl} placeholder="https://ectd-classroom.example.workers.dev/ectd/v1" onChange={(e) => setApiUrl(e.target.value)} /></label>
          <button className="btn" disabled={!apiUrl.trim()} onClick={check}>Check and save</button>
        </div>
      </section>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <form className="panel" onSubmit={doJoin}>
          <h2 style={{ fontSize: 'var(--step-1)' }}>Join a class</h2>
          <label className="field">Join code<input type="text" required value={join.code} onChange={(e) => setJoin({ ...join, code: e.target.value.toUpperCase() })} placeholder="e.g. K7Q2PM" autoCapitalize="characters" /></label>
          <label className="field">Your name<input type="text" required value={join.name} onChange={(e) => setJoin({ ...join, name: e.target.value })} /></label>
          <label className="field">Email <small>optional, only for deadline reminders</small><input type="email" value={join.email} onChange={(e) => setJoin({ ...join, email: e.target.value })} /></label>
          <button className="btn primary" type="submit" disabled={!apiUrl.trim()} style={{ marginTop: '.5rem' }}>Join</button>
        </form>
        <form className="panel" onSubmit={doCreate}>
          <h2 style={{ fontSize: 'var(--step-1)' }}>Teach a class</h2>
          <label className="field">Class name<input type="text" required value={make.name} onChange={(e) => setMake({ ...make, name: e.target.value })} placeholder="e.g. Regulatory publishing, autumn cohort" /></label>
          <label className="field">Your name<input type="text" required value={make.instructorName} onChange={(e) => setMake({ ...make, instructorName: e.target.value })} /></label>
          <label className="field">Your email <small>optional</small><input type="email" value={make.instructorEmail} onChange={(e) => setMake({ ...make, instructorEmail: e.target.value })} /></label>
          <button className="btn primary" type="submit" disabled={!apiUrl.trim()} style={{ marginTop: '.5rem' }}>Create the class</button>
        </form>
      </div>
      <form className="panel" onSubmit={signInWithKey}>
        <h2 style={{ fontSize: 'var(--step-1)' }}>Sign in with a key</h2>
        <p className="small muted">On another device: paste your class key (instructors) or your student key, or the contents of a downloaded class key file.</p>
        <div className="row" style={{ alignItems: 'end' }}>
          <label className="field" style={{ flex: 1 }}>Key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
          <button className="btn" type="submit" disabled={!key.trim()}>Sign in</button>
        </div>
      </form>
    </div>
  );
}

function Leaderboard({ rows, highlight }) {
  if (!rows?.length) return null;
  return (
    <section className="panel">
      <h2 style={{ fontSize: 'var(--step-1)' }}>Leaderboard</h2>
      <p className="small muted">Best score on each assignment, added up; an instructor-verified score counts instead of the reported one.</p>
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Rank</th><th>Name</th><th>Total</th><th>Assignments at 80% or more</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.memberId} className={r.memberId === highlight ? 'me' : ''}><td>{r.rank}</td><td>{r.name}{r.memberId === highlight ? ' (you)' : ''}</td><td>{r.total}</td><td>{r.completed}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

function Student({ session, data, refresh, busy, toast, signOut }) {
  const { projects, attempts, user, saveProject } = useApp();
  const [pick, setPick] = useState({});
  const [comment, setComment] = useState({});
  const subsFor = (aid) => data.submissions.filter((s) => s.assignmentId === aid);

  const start = async (a) => {
    try {
      const p = await seedMission(a.missionId, a.difficulty, user);
      p.assignment = { id: a.id, classId: data.class.id };
      const attempt = { id: uid('a'), kind: 'mission', userId: user.userId, classId: data.class.id, missionId: a.missionId, projectId: p.id, difficulty: a.difficulty, startedAt: new Date().toISOString(), finishedAt: null, score: null, assignmentId: a.id };
      p.mission.attemptId = attempt.id;
      await saveAttempt(attempt);
      await saveProject(p);
      go(`/project/${p.id}`);
    } catch (e) { toast(e.message, 'error'); }
  };
  const submit = async (a) => {
    const p = projects.find((x) => x.id === pick[a.id]);
    if (!p) return toast('Choose the project to submit.', 'warn');
    try {
      const r = await api(session, 'POST', `/assignments/${a.id}/submissions`, submissionPayload(p, attempts));
      toast(`Submitted with ${r.submission.score}%${r.late ? ' (after the due date)' : ''}.`);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  };
  const addComment = async (sid) => {
    try { await api(session, 'POST', `/submissions/${sid}/comments`, { body: comment[sid] }); setComment({ ...comment, [sid]: '' }); refresh(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="stack" style={{ marginTop: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h2 style={{ margin: 0 }}>{data.class.name}</h2><span className="small muted">Instructor: {data.class.instructorName} · you are {data.member.name}</span></div>
        <div className="row"><button className="btn small" disabled={busy} onClick={() => refresh()}>{busy ? 'Refreshing…' : 'Refresh'}</button><button className="btn small ghost" onClick={signOut}>Leave on this device</button></div>
      </div>
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Assignments</h2>
        {data.assignments.length === 0 && <p className="muted">No assignments yet.</p>}
        {data.assignments.map((a) => {
          const mine = projects.filter((p) => p.mission?.id === a.missionId);
          const subs = subsFor(a.id);
          const best = subs.reduce((b, s) => Math.max(b, s.verifiedScore ?? s.score), -1);
          const overdue = new Date(a.dueAt) < new Date();
          return (
            <article key={a.id} className="assignment">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>Mission {mTitle(a.missionId)}</strong>
                <span className="row small"><span className="pill">{a.difficulty}</span><span className={`pill ${overdue && !subs.length ? 'high' : ''}`}>Due {when(a.dueAt)}</span>{best >= 0 && <span className={`pill ${best >= 80 ? 'ok' : 'medium'}`}>Best {best}%</span>}</span>
              </div>
              {a.note && <p className="small" style={{ margin: '.3rem 0' }}>{a.note}</p>}
              <div className="row" style={{ marginTop: '.4rem' }}>
                <button className="btn small" onClick={() => start(a)}>Start at {a.difficulty} level</button>
                {mine.length > 0 && (
                  <>
                    <select aria-label="Project to submit" value={pick[a.id] ?? ''} onChange={(e) => setPick({ ...pick, [a.id]: e.target.value })}>
                      <option value="">Choose a project…</option>
                      {mine.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mission.difficulty}{p.mission.submitted ? ` · scored ${p.mission.submitted.score}%` : ' · not yet scored'}</option>)}
                    </select>
                    <button className="btn small primary" disabled={!pick[a.id]} onClick={() => submit(a)}>Submit</button>
                  </>
                )}
              </div>
              {subs.map((s) => (
                <div key={s.id} className="sub-row small">
                  Submitted {when(s.submittedAt)}{isLate(a, s.submittedAt) ? ' (late)' : ''}: {s.score}%{s.verifiedScore != null ? `, verified ${s.verifiedScore}%` : ''}
                  {data.comments.filter((c) => c.submissionId === s.id).map((c) => <div key={c.id} className="comment"><strong>{c.authorName}</strong>: {c.body}</div>)}
                  <div className="row" style={{ marginTop: '.3rem' }}>
                    <input type="text" aria-label="Reply" placeholder="Reply to your instructor" value={comment[s.id] ?? ''} onChange={(e) => setComment({ ...comment, [s.id]: e.target.value })} style={{ flex: 1 }} />
                    <button className="btn small" disabled={!comment[s.id]?.trim()} onClick={() => addComment(s.id)}>Send</button>
                  </div>
                </div>
              ))}
            </article>
          );
        })}
      </section>
      <Leaderboard rows={data.leaderboard} highlight={data.member.id} />
    </div>
  );
}

function Instructor({ session, data, refresh, busy, toast, signOut, persist }) {
  const { saveProject, projects, user } = useApp();
  const [form, setForm] = useState({ missionId: 1, difficulty: 'standard', dueAt: '', note: '' });
  const [open, setOpen] = useState(null); // { submission, comments, verify }
  const [comment, setComment] = useState('');
  const memberName = useMemo(() => Object.fromEntries(data.members.map((m) => [m.id, m.name])), [data.members]);

  const addAssignment = async (e) => {
    e.preventDefault();
    try { await api(session, 'POST', '/assignments', { ...form, dueAt: new Date(form.dueAt).toISOString() }); setForm({ ...form, note: '' }); toast('Assignment set.'); refresh(); } catch (err) { toast(err.message, 'error'); }
  };
  const del = async (path, msg) => { if (!window.confirm(msg)) return; try { await api(session, 'DELETE', path); refresh(); } catch (e) { toast(e.message, 'error'); } };
  const openSub = async (id) => {
    try { const r = await api(session, 'GET', `/submissions/${id}`); setOpen({ ...r, verify: null }); setComment(''); } catch (e) { toast(e.message, 'error'); }
  };
  const verify = async () => {
    try {
      const v = verifyProject(open.submission.project);
      await api(session, 'PATCH', `/submissions/${open.submission.id}`, { verifiedScore: v.score });
      setOpen({ ...open, verify: v, submission: { ...open.submission, verifiedScore: v.score } });
      toast(`Re-scored in this browser: ${v.score}% (reported ${open.submission.score}%).`);
      refresh();
    } catch (e) { toast(`Could not re-score: ${e.message}`, 'error'); }
  };
  const importIt = async () => {
    try {
      const p = parseProjectFile(JSON.stringify(open.submission.project), user, new Set(projects.map((x) => x.id)));
      p.name = `${memberName[open.submission.memberId] ?? 'Student'}: ${p.name}`;
      await saveProject(p);
      toast(`Imported "${p.name}" into your projects.`);
    } catch (e) { toast(e.message, 'error'); }
  };
  const sendComment = async () => {
    try { const r = await api(session, 'POST', `/submissions/${open.submission.id}/comments`, { body: comment }); setOpen({ ...open, comments: [...open.comments, r.comment] }); setComment(''); } catch (e) { toast(e.message, 'error'); }
  };
  const deleteClass = async () => {
    if (!window.confirm(`Delete ${data.class.name}, its students, assignments and submissions? This cannot be undone.`)) return;
    try { await api(session, 'DELETE', '/class'); await persist({ api: session.api }); toast('Class deleted.'); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="stack" style={{ marginTop: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h2 style={{ margin: 0 }}>{data.class.name}</h2><span className="small muted">Join code <strong className="join-code">{data.class.code}</strong> · {data.members.length} student{data.members.length === 1 ? '' : 's'} · email reminders {data.reminders ? 'on' : 'off (Brevo not configured on the server)'}</span></div>
        <div className="row"><button className="btn small" disabled={busy} onClick={() => refresh()}>{busy ? 'Refreshing…' : 'Refresh'}</button><button className="btn small ghost" onClick={signOut}>Sign out</button></div>
      </div>

      <form className="panel" onSubmit={addAssignment}>
        <h2 style={{ fontSize: 'var(--step-1)' }}>Set an assignment</h2>
        <div className="grid-2">
          <label className="field">Mission<select value={form.missionId} onChange={(e) => setForm({ ...form, missionId: Number(e.target.value) })}>{[...MISSIONS].sort((a, b) => a.id - b.id).map((m) => <option key={m.id} value={m.id}>{m.id}. {m.title} ({m.region})</option>)}</select></label>
          <label className="field">Level<select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
          <label className="field">Due<input type="datetime-local" required value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></label>
          <label className="field">Note for students <small>optional</small><input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <button className="btn primary" type="submit" style={{ marginTop: '.6rem' }}>Set assignment</button>
      </form>

      {data.assignments.map((a) => {
        const subs = data.submissions.filter((s) => s.assignmentId === a.id);
        const missing = data.members.filter((m) => !subs.some((s) => s.memberId === m.id));
        return (
          <section key={a.id} className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Mission {mTitle(a.missionId)} <span className="pill">{a.difficulty}</span></h2>
              <span className="row small">Due {when(a.dueAt)}<button className="btn small ghost danger" onClick={() => del(`/assignments/${a.id}`, 'Remove this assignment and its submissions?')}>Remove</button></span>
            </div>
            {subs.length === 0 ? <p className="muted small">No submissions yet.</p> : (
              <div className="table-wrap"><table className="data">
                <thead><tr><th>Student</th><th>Submitted</th><th>Reported</th><th>Verified</th><th>Findings</th><th>Axes</th><th /></tr></thead>
                <tbody>{subs.map((s) => (
                  <tr key={s.id}>
                    <td>{memberName[s.memberId] ?? '—'}</td>
                    <td className="small">{when(s.submittedAt)}{isLate(a, s.submittedAt) ? <span className="pill high" style={{ marginLeft: '.3rem' }}>late</span> : null}</td>
                    <td>{s.score}%</td>
                    <td>{s.verifiedScore != null ? <span className={`pill ${s.verifiedScore === s.score ? 'ok' : 'medium'}`}>{s.verifiedScore}%</span> : '—'}</td>
                    <td className="small">{s.counts ? `${s.counts.High} high, ${s.counts.Medium} medium (seq ${s.counts.sequence})` : '—'}</td>
                    <td className="small">{s.axes ? Object.entries(s.axes).map(([k, v]) => `${k[0].toUpperCase()}${v}`).join(' ') : '—'}</td>
                    <td><button className="btn small" onClick={() => openSub(s.id)}>Open</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
            {missing.length > 0 && <p className="small muted" style={{ marginBottom: 0 }}>Not submitted: {missing.map((m) => m.name).join(', ')}</p>}
          </section>
        );
      })}

      <Leaderboard rows={data.leaderboard} />

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Students</h2>
        {data.members.length === 0 ? <p className="muted small">Share the join code {data.class.code} with your students.</p> : (
          <ul className="small" style={{ paddingLeft: '1.1rem' }}>{data.members.map((m) => <li key={m.id}>{m.name}{m.email ? ` (${m.email})` : ''}, joined {when(m.joinedAt)} <button className="btn small ghost" onClick={() => del(`/members/${m.id}`, `Remove ${m.name} and their submissions?`)}>Remove</button></li>)}</ul>
        )}
        <button className="btn small danger" onClick={deleteClass}>Delete the class</button>
      </section>

      {open && (
        <div className="modal-back" onClick={() => setOpen(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sub-h" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <h2 id="sub-h">{memberName[open.submission.memberId]}: mission {open.submission.project?.project?.mission?.id}</h2>
            <p className="small muted">Submitted {when(open.submission.submittedAt)} · reported {open.submission.score}%{open.submission.verifiedScore != null ? ` · verified ${open.submission.verifiedScore}%` : ''} · {Math.round(open.submission.size / 1024)} KB</p>
            {(open.verify?.checks ?? open.submission.checks)?.length > 0 && (
              <ul className="cert-list small">{(open.verify?.checks ?? open.submission.checks).map((c) => <li key={c.id}><span className={`tick ${c.ok ? 'on' : ''}`} aria-hidden="true">{c.ok ? '✓' : ''}</span>{c.label}<span className="sr-only">{c.ok ? 'met' : 'not met'}</span></li>)}</ul>
            )}
            {open.submission.counts?.verdict && <p className="small">{open.submission.counts.verdict}</p>}
            <div className="row">
              <button className="btn primary" onClick={verify}>Re-score in this browser</button>
              <button className="btn" onClick={importIt}>Open a copy in my projects</button>
              <button className="btn" onClick={() => download(`submission-${open.submission.id}.ectd-project.json`, JSON.stringify(open.submission.project, null, 2))}>Download the project file</button>
            </div>
            <h3 style={{ marginTop: '1rem' }}>Comments</h3>
            {open.comments.length === 0 && <p className="small muted">None yet.</p>}
            {open.comments.map((c) => <div key={c.id} className="comment small"><strong>{c.authorName}</strong> ({when(c.createdAt)}): {c.body}</div>)}
            <div className="row" style={{ marginTop: '.4rem' }}>
              <input type="text" aria-label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Feedback for the student" style={{ flex: 1 }} />
              <button className="btn" disabled={!comment.trim()} onClick={sendComment}>Send</button>
              <button className="btn ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
