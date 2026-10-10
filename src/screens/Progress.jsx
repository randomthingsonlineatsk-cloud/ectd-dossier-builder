import React, { useEffect, useMemo, useState } from 'react';
import { getMeta, setMeta } from '../engine/db.js';
import { download } from '../engine/io.js';
import lessons from '../data/lessons.json' with { type: 'json' };
import { useApp } from '../ctx.js';
import { progressSummary, LEVELS, BADGES, certificateStatus } from '../engine/progress.js';

const AXIS_LABEL = { technical: 'Technical validity', lifecycle: 'Lifecycle correctness', consistency: 'Cross-module consistency', time: 'Time' };

export default function Progress() {
  const { projects, attempts, lessonProgress, user, toast } = useApp();
  const sum = useMemo(() => progressSummary({ projects, attempts, lessonProgress, lessonCount: lessons.length }), [projects, attempts, lessonProgress]);
  const axes = Object.entries(sum.avg).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  const idx = LEVELS.findIndex((l) => l.id === sum.level.id);
  return (
    <div className="page">
      <h1>Progress</h1>
      <p>Everything here is worked out from the projects, missions and quizzes saved in this browser.</p>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: 'var(--step-1)' }}>Level: {sum.level.label}</h2>
        <ol className="lc-steps" style={{ listStyle: 'none', paddingLeft: 0 }}>
          {LEVELS.map((l, i) => (
            <li key={l.id} className="row" style={{ gap: '.6rem' }}>
              <span className={`tick ${i <= idx ? 'on' : ''}`} aria-hidden="true">{i <= idx ? '✓' : ''}</span>
              <strong style={{ minWidth: 150 }}>{l.label}</strong><span className="small muted">{l.rule}</span>
              <span className="sr-only">{i <= idx ? 'reached' : 'not reached'}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="section-head"><h2>Badges</h2><span className="small muted">{Object.values(sum.earned).filter(Boolean).length} of {BADGES.length} earned</span></div>
      <div className="lesson-grid">
        {BADGES.map((b) => (
          <div key={b.id} className="lesson-card" style={{ opacity: sum.earned[b.id] ? 1 : 0.55 }}>
            <strong>{b.label}</strong>
            <span className="small muted">{b.about}</span>
            <span className={`pill ${sum.earned[b.id] ? 'ok' : ''}`} style={{ alignSelf: 'flex-start' }}>{sum.earned[b.id] ? 'Earned' : 'Not yet'}</span>
          </div>
        ))}
      </div>

      <div className="section-head"><h2>Strengths and weak areas</h2></div>
      {axes.length === 0 ? <p className="muted">Submit a mission for scoring to see how you do on each axis.</p> : (
        <div className="grid-2">
          {axes.map(([k, v], i) => (
            <div key={k} className="panel">
              <div className="row" style={{ justifyContent: 'space-between' }}><strong>{AXIS_LABEL[k]}</strong><span className={`pill ${v >= 80 ? 'ok' : v >= 50 ? 'medium' : 'high'}`}>{v}%</span></div>
              <p className="small muted" style={{ margin: '.3rem 0 0' }}>{i === 0 ? 'Your strongest area.' : i === axes.length - 1 ? 'Your area to work on.' : 'Average across scored missions.'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="section-head"><h2>Missions</h2></div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Mission</th><th>Region</th><th>Release</th><th>Attempts</th><th>Best</th></tr></thead>
          <tbody>
            {sum.missions.sort((a, b) => a.id - b.id).map((m) => (
              <tr key={m.id}>
                <td>{m.id}. <a href="#/missions">{m.title}</a></td>
                <td>{m.region}</td>
                <td>Available</td>
                <td>{m.tries || '—'}</td>
                <td>{m.best ? <span className={`pill ${m.best.score >= 80 ? 'ok' : 'medium'}`}>{m.best.score}% ({m.best.difficulty})</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head"><h2>Lessons</h2></div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Lesson</th><th>Best quiz score</th></tr></thead>
          <tbody>{lessons.map((l) => <tr key={l.id}><td><a href={`#/learn/${l.id}`}>{l.id}. {l.title}</a></td><td>{lessonProgress[l.id] ? `${lessonProgress[l.id].best}%` : '—'}</td></tr>)}</tbody>
        </table>
      </div>
      <Certificate attempts={attempts} lessonProgress={lessonProgress} user={user} toast={toast} />
    </div>
  );
}

function Certificate({ attempts, lessonProgress, user, toast }) {
  const status = useMemo(() => certificateStatus({ attempts, lessonProgress, lessonCount: lessons.length }), [attempts, lessonProgress]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getMeta('certName', '').then((n) => setName(n || '')).catch(() => {}); }, []);
  const make = async (kind) => {
    if (!name.trim()) return toast('Enter the name to print first.', 'warn');
    setBusy(true);
    try {
      await setMeta('certName', name.trim());
      const { certificatePdf, progressStatementPdf } = await import('../engine/certpdf.js');
      const bytes = kind === 'cert' ? await certificatePdf({ name, userId: user?.userId, status }) : await progressStatementPdf({ name, status });
      download(kind === 'cert' ? 'ectd-dossier-builder-certificate.pdf' : 'ectd-dossier-builder-progress.pdf', bytes, 'application/pdf');
    } catch (e) { toast(`Could not make the PDF: ${e.message}`, 'error'); } finally { setBusy(false); }
  };
  return (
    <section className="panel" style={{ marginTop: '1.5rem' }} aria-labelledby="cert-h">
      <h2 id="cert-h" style={{ fontSize: 'var(--step-1)' }}>Completion certificate</h2>
      <p className="small">A portfolio exercise, not an accreditation or a professional qualification. It is made in your browser from the results saved here, with a verification code that ties it to them.</p>
      <ul className="cert-list">
        {status.criteria.map((c) => (
          <li key={c.id}><span className={`tick ${c.met ? 'on' : ''}`} aria-hidden="true">{c.met ? '✓' : ''}</span> {c.label}{c.detail ? <span className="small muted"> ({c.detail})</span> : null}<span className="sr-only">{c.met ? 'met' : 'not met'}</span></li>
        ))}
      </ul>
      <p className="small muted">With distinction when {8} or more missions score 80% at expert level ({status.expertCount} so far).</p>
      <div className="row" style={{ alignItems: 'end' }}>
        <label className="field" style={{ minWidth: 280 }}>Name to print<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" /></label>
        <button className="btn primary" disabled={!status.eligible || busy} onClick={() => make('cert')}>{busy ? 'Making…' : 'Download certificate (PDF)'}</button>
        <button className="btn" disabled={busy} onClick={() => make('progress')}>Download statement of progress</button>
      </div>
      {!status.eligible && <p className="small muted" style={{ marginBottom: 0 }}>The certificate unlocks when every criterion is met. The statement of progress is available any time and claims no completion.</p>}
    </section>
  );
}
