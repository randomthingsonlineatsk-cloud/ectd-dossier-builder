import React, { useState } from 'react';
import { useApp } from '../ctx.js';
import { go } from '../App.jsx';
import { MISSIONS, LEVELS, seedMission } from '../engine/missions.js';
import { saveAttempt } from '../engine/db.js';
import { uid } from '../engine/model.js';

function MissionCard({ m }) {
  const { user, attempts, saveProject, toast } = useApp();
  const [level, setLevel] = useState('guided');
  const [busy, setBusy] = useState(false);
  const mine = attempts.filter((a) => a.missionId === m.id && a.kind === 'mission');
  const best = mine.reduce((b, a) => Math.max(b, a.score ?? 0), 0);
  const start = async () => {
    setBusy(true);
    try {
      const p = await seedMission(m.id, level, user);
      const attempt = { id: uid('a'), kind: 'mission', userId: user.userId, classId: user.classId ?? null, missionId: m.id, projectId: p.id, difficulty: level, startedAt: new Date().toISOString(), finishedAt: null, score: null };
      p.mission.attemptId = attempt.id;
      await saveAttempt(attempt);
      await saveProject(p);
      go(`/project/${p.id}`);
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };
  const mins = m.minutes?.[level];
  return (
    <article className="panel" aria-labelledby={`m${m.id}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id={`m${m.id}`} style={{ fontSize: 'var(--step-1)', margin: 0 }}>Mission {m.id}: {m.title}</h2>
        <span className="row small">
          <span className="pill">{m.region}, {m.version === 'CTD' ? 'CTD (portal)' : `eCTD v${m.version}`}</span>
          {m.phase === 5 && <span className="pill">New</span>}
          {mine.length > 0 && <span className={`pill ${best >= 80 ? 'ok' : 'medium'}`}>Best {best}%</span>}
        </span>
      </div>
      <p style={{ marginTop: '.6rem' }}>{m.brief}</p>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: '.75rem' }}>
        <div className="seg" role="group" aria-label="Difficulty">
          {LEVELS.map((l) => (
            <button key={l.id} aria-pressed={level === l.id} title={l.about} onClick={() => setLevel(l.id)}>{l.label}</button>
          ))}
        </div>
        <span className="small muted">{LEVELS.find((l) => l.id === level).about}{mins ? ` Clock: ${mins} minutes.` : ''}</span>
        <button className="btn primary" onClick={start} disabled={busy}>{busy ? 'Preparing the dossier…' : `Start mission ${m.id}`}</button>
      </div>
    </article>
  );
}

export default function Missions() {
  const available = MISSIONS.filter((m) => m.phase <= 5).sort((a, b) => a.id - b.id);
  const later = MISSIONS.filter((m) => m.phase > 5).sort((a, b) => a.id - b.id);
  return (
    <div className="page">
      <h1>Missions</h1>
      <p>Each mission sets a product, a region and a goal, then grades your dossier on four axes: technical validity, lifecycle correctness, cross-module consistency and time. Starting a mission creates its own project, so you can retry as often as you like. For quick lifecycle practice, try the <a href="#/drills">lifecycle drills</a>.</p>
      <div className="stack" style={{ marginTop: '1.5rem' }}>
        {available.map((m) => <MissionCard key={m.id} m={m} />)}
      </div>
      {later.length > 0 && <><div className="section-head"><h2>Coming in later releases</h2></div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Mission</th><th>Region</th><th>Release</th></tr></thead>
          <tbody>{later.map((m) => <tr key={m.id}><td>{m.id}. {m.title}</td><td>{m.region}</td><td>Phase {m.phase}</td></tr>)}</tbody>
        </table>
      </div></>}
    </div>
  );
}
