import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../ctx.js';
import { TOPICS, allQuestions, countByTopic, buildSet, scoreSet, EXAM } from '../engine/quiz.js';

export default function QuizBank() {
  const { attempts, saveExercise, toast } = useApp();
  const counts = useMemo(countByTopic, []);
  const [topics, setTopics] = useState([]);
  const [n, setN] = useState(10);
  const [run, setRun] = useState(null); // { mode, set, startedAt }
  const history = attempts.filter((a) => a.kind === 'quiz').sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 10);

  const start = (mode) => {
    const set = mode === 'exam' ? buildSet({ n: EXAM.n }) : buildSet({ topics, n });
    if (!set.length) return toast('No questions match those topics.', 'warn');
    setRun({ mode, set, startedAt: Date.now() });
  };

  if (run) return <Run run={run} onDone={async (res) => {
    await saveExercise('quiz', { mode: run.mode, topics: run.mode === 'exam' ? [] : topics, score: res.score, right: res.right, total: res.total, byTopic: res.byTopic, seconds: Math.round((Date.now() - run.startedAt) / 1000) });
    toast(`Quiz saved: ${res.right} of ${res.total}.`);
  }} onExit={() => setRun(null)} />;

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <p className="small"><a href="#/learn">Learn</a> / Quiz bank</p>
      <h1>Quiz bank</h1>
      <p>{allQuestions().length} RAC-style questions: the written bank plus every lesson quiz, mission quiz and lifecycle drill. Practise by topic, or sit a timed mock exam. Every answer explains why.</p>
      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: 'var(--step-1)' }}>Practice</h2>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="small muted">Topics (none ticked means all)</legend>
          <div className="topic-grid">
            {Object.entries(TOPICS).map(([k, label]) => (
              <label key={k} className="small row" style={{ gap: '.4rem' }}>
                <input type="checkbox" checked={topics.includes(k)} onChange={(e) => setTopics(e.target.checked ? [...topics, k] : topics.filter((t) => t !== k))} />
                {label} <span className="muted">({counts[k] ?? 0})</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row" style={{ marginTop: '.75rem' }}>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>Questions
            <select value={n} onChange={(e) => setN(Number(e.target.value))}>{[5, 10, 20, 40].map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <button className="btn primary" onClick={() => start('practice')}>Start practice</button>
        </div>
      </section>
      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: 'var(--step-1)' }}>Mock exam</h2>
        <p>{EXAM.n} questions from every topic, {EXAM.minutes} minutes, answers shown only at the end. {EXAM.pass}% is a pass in this app. It is practice in the style of a certification exam, not a copy of one.</p>
        <button className="btn primary" onClick={() => start('exam')}>Start the mock exam</button>
      </section>
      {history.length > 0 && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: 'var(--step-1)' }}>Recent results</h2>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Date</th><th>Mode</th><th>Topics</th><th>Score</th></tr></thead>
            <tbody>{history.map((a) => <tr key={a.id}><td>{a.finishedAt.slice(0, 10)}</td><td>{a.mode}</td><td className="small">{a.topics?.length ? a.topics.map((t) => TOPICS[t]).join(', ') : 'all'}</td><td>{a.score}% ({a.right}/{a.total})</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}

function Run({ run, onDone, onExit }) {
  const exam = run.mode === 'exam';
  const [ans, setAns] = useState({});
  const [finished, setFinished] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!exam || finished) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [exam, finished]);
  const left = exam ? Math.max(0, EXAM.minutes * 60 - Math.floor((now - run.startedAt) / 1000)) : null;
  const finish = async () => { const res = scoreSet(run.set, ans); setFinished(res); await onDone(res); window.scrollTo(0, 0); };
  useEffect(() => { if (exam && left === 0 && !finished) finish(); }); // time up
  const show = (q) => finished || (!exam && ans[q.id] !== undefined);
  const answered = Object.keys(ans).length;
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <p className="small"><button className="btn small ghost" onClick={onExit}>← Quiz bank</button></p>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>{exam ? 'Mock exam' : 'Practice'}</h1>
        {exam && !finished && <span className={`timer ${left < 300 ? 'late' : ''}`} role="timer">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>}
      </div>
      {finished && (
        <div className={`callout ${exam && finished.score < EXAM.pass ? 'warn' : ''}`} style={{ margin: '1rem 0' }}>
          <strong>{finished.right} of {finished.total} ({finished.score}%).</strong>{exam ? (finished.score >= EXAM.pass ? ' A pass.' : ` Below the ${EXAM.pass}% pass mark.`) : ''}
          <div className="small" style={{ marginTop: '.4rem' }}>{Object.entries(finished.byTopic).map(([t, v]) => `${TOPICS[t]} ${v.right}/${v.total}`).join(' · ')}</div>
        </div>
      )}
      {run.set.map((q, i) => {
        const a = ans[q.id];
        return (
          <section key={q.id} className="quiz-q">
            <p className="small muted" style={{ margin: '0 0 .3rem' }}>{TOPICS[q.topic]} · {q.source}</p>
            {q.context && <ul className="small" style={{ marginTop: 0 }}>{q.context.map((c) => <li key={c}>{c}</li>)}</ul>}
            <fieldset>
              <legend>{i + 1}. {q.q}</legend>
              {q.options.map((o, j) => (
                <label key={j} className={`quiz-opt ${show(q) && j === q.answer ? 'right' : show(q) && a === j ? 'wrong' : ''}`}>
                  <input type="radio" name={q.id} disabled={!!finished || (!exam && a !== undefined)} checked={a === j} onChange={() => setAns({ ...ans, [q.id]: j })} />
                  <span>{o}</span>
                </label>
              ))}
            </fieldset>
            {show(q) && <p className="small" style={{ margin: '.4rem 0 0' }}>{a === q.answer ? 'Correct. ' : a === undefined ? 'Not answered. ' : 'Not quite. '}{q.why}{q.links?.[0] && <> <a href={q.links[0].startsWith('lesson') ? `#/learn/${q.links[0].split(':')[1]}` : '#/missions'}>{q.links[0].startsWith('lesson') ? `Lesson ${q.links[0].split(':')[1]}` : `Mission ${q.links[0].split(':')[1]}`}</a></>}</p>}
          </section>
        );
      })}
      {!finished && <div className="row"><span className="small muted">{answered} of {run.set.length} answered.</span><button className="btn primary" onClick={finish}>{exam ? 'Submit the exam' : 'Finish and save'}</button></div>}
      {finished && <button className="btn" onClick={onExit}>Back to the quiz bank</button>}
    </div>
  );
}
