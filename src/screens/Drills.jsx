import React, { useState } from 'react';
import drills from '../data/drills.json' with { type: 'json' };

export default function Drills() {
  const [ans, setAns] = useState({});
  const right = drills.filter((d) => ans[d.id] === d.answer).length;
  const done = Object.keys(ans).length;
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <p className="small"><a href="#/learn">Learn</a> / Lifecycle drills</p>
      <h1>Lifecycle drills</h1>
      <p>Eight short situations built on the mistakes publishers make most often. Read the current view, pick the right move, and see why.</p>
      <p className="small muted" aria-live="polite">{done} of {drills.length} answered{done ? `, ${right} right` : ''}.</p>
      <div className="stack" style={{ marginTop: '1rem' }}>
        {drills.map((d, i) => {
          const a = ans[d.id];
          const answered = a !== undefined;
          return (
            <section key={d.id} className="quiz-q">
              <h2 style={{ fontSize: 'var(--step-1)' }}>{i + 1}. {d.title}</h2>
              <p>{d.situation}</p>
              <div className="panel" style={{ padding: '.6rem .8rem', marginBottom: '.6rem' }}>
                <span className="small muted">Current view</span>
                <ul className="small" style={{ margin: '.2rem 0 0', paddingLeft: '1.1rem' }}>{d.current.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
              <fieldset>
                <legend>{d.question}</legend>
                {d.options.map((o, j) => (
                  <label key={j} className={`quiz-opt ${answered && j === d.answer ? 'right' : answered && a === j ? 'wrong' : ''}`}>
                    <input type="radio" name={d.id} disabled={answered} checked={a === j} onChange={() => setAns({ ...ans, [d.id]: j })} />
                    <span>{o}</span>
                  </label>
                ))}
              </fieldset>
              {answered && <p className="small" style={{ margin: '.5rem 0 0' }}>{a === d.answer ? 'Correct. ' : 'Not quite. '}{d.why}</p>}
            </section>
          );
        })}
      </div>
      {done === drills.length && <p className="callout" style={{ marginTop: '1rem' }}>You got {right} of {drills.length}. <button className="btn small" onClick={() => setAns({})}>Start again</button></p>}
    </div>
  );
}
