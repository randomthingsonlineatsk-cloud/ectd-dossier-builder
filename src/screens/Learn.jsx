import React from 'react';
import lessons from '../data/lessons.json' with { type: 'json' };
import { useApp } from '../ctx.js';

const LATER = [
  { id: 6, title: 'v3.2.2 vs v4.0', phase: 3 },
  { id: 7, title: 'Regional differences', phase: 2 },
];

export default function Learn() {
  const { lessonProgress } = useApp();
  return (
    <div className="page">
      <h1>Learn</h1>
      <p>Five short lessons, each ending with a quiz. Work through them in order before you build; they take about 45 minutes together.</p>
      <div className="lesson-grid" style={{ marginTop: '1.5rem' }}>
        {lessons.map((l) => {
          const pr = lessonProgress[l.id];
          return (
            <a key={l.id} className="lesson-card" href={`#/learn/${l.id}`}>
              <span className="n">{l.id}</span>
              <strong>{l.title}</strong>
              <span className="small muted">{l.summary}</span>
              <span className="row small" style={{ marginTop: 'auto' }}>
                <span className="muted">{l.minutes} min</span>
                {pr && <span className={`pill ${pr.best >= 80 ? 'ok' : 'medium'}`}>Best quiz score {pr.best}%</span>}
              </span>
            </a>
          );
        })}
        {LATER.map((l) => (
          <div key={l.id} className="lesson-card" aria-disabled="true" style={{ opacity: .55 }}>
            <span className="n">{l.id}</span><strong>{l.title}</strong><span className="small muted">Arrives in Phase {l.phase}.</span>
          </div>
        ))}
        <a className="lesson-card" href="#/glossary"><span className="n">8</span><strong>Glossary</strong><span className="small muted">Every term used in the app, searchable.</span></a>
      </div>
    </div>
  );
}
