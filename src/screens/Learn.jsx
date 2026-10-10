import React from 'react';
import lessons from '../data/lessons.json' with { type: 'json' };
import { useApp } from '../ctx.js';

const LATER = [];

export default function Learn() {
  const { lessonProgress } = useApp();
  return (
    <div className="page">
      <h1>Learn</h1>
      <p>Seven short lessons, each ending with a quiz. Lessons 1–5 prepare you to build; 6 and 7 look ahead to v4.0 and other regions. Together they take about an hour.</p>
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
        <a className="lesson-card" href="#/drills"><span className="n">+</span><strong>Lifecycle drills</strong><span className="small muted">Eight quick situations built on the most common lifecycle mistakes.</span></a>
        <a className="lesson-card" href="#/compare"><span className="n">+</span><strong>Region comparison</strong><span className="small muted">Where the same document goes in the US, EU, Japan, India, Canada and Switzerland, and how a CTD becomes an ASEAN ACTD.</span></a>
        <a className="lesson-card" href="#/quiz"><span className="n">+</span><strong>Quiz bank</strong><span className="small muted">RAC-style questions tied to every lesson and mission: practise by topic or sit a timed exam.</span></a>
      </div>
    </div>
  );
}
