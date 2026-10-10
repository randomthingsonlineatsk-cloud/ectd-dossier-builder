import React, { useMemo } from 'react';
import lessons from '../data/lessons.json' with { type: 'json' };
import { useApp } from '../ctx.js';
import { progressSummary, LEVELS, BADGES } from '../engine/progress.js';

const AXIS_LABEL = { technical: 'Technical validity', lifecycle: 'Lifecycle correctness', consistency: 'Cross-module consistency', time: 'Time' };

export default function Progress() {
  const { projects, attempts, lessonProgress } = useApp();
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
                <td>{m.id}. {m.phase <= 2 ? <a href="#/missions">{m.title}</a> : m.title}</td>
                <td>{m.region}</td>
                <td>{m.phase <= 2 ? 'Available' : `Phase ${m.phase}`}</td>
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
      <p className="small muted" style={{ marginTop: '1.5rem' }}>A completion certificate, clearly labelled as a portfolio exercise and not an accreditation, arrives in a later release.</p>
    </div>
  );
}
