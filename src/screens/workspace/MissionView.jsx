import React from 'react';
import { missionById } from '../../engine/missions.js';

const AXES = [['technical', 'Technical validity'], ['lifecycle', 'Lifecycle correctness'], ['consistency', 'Cross-module consistency'], ['time', 'Time']];

export default function MissionView({ project, evaluation, onSubmit, mutate }) {
  const m = missionById(project.mission.id);
  const level = project.mission.difficulty;
  const guided = level === 'guided';
  const submitted = project.mission.submitted;
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Mission {m.id}: {m.title}</h2>
        <p>{m.brief}</p>
        <h3>Steps</h3>
        <ol>{m.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        {guided && m.hints?.length > 0 && (
          <div className="callout"><strong>Hints</strong><ul style={{ margin: '.3rem 0 0', paddingLeft: '1.1rem' }}>{m.hints.map((h) => <li key={h}>{h}</li>)}</ul></div>
        )}
      </section>

      {m.quiz?.length > 0 && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Decide before you build</h3>
          <p className="small muted">Your first answer counts toward the score.</p>
          {m.quiz.map((q) => {
            const ans = project.mission.answers?.[q.id];
            const answered = ans !== undefined;
            return (
              <div className="quiz-q" key={q.id}>
                <fieldset>
                  <legend>{q.q}</legend>
                  {q.options.map((o, j) => (
                    <label key={j} className={`quiz-opt ${answered && j === q.answer ? 'right' : answered && ans === j ? 'wrong' : ''}`}>
                      <input type="radio" name={`mq-${q.id}`} checked={ans === j} disabled={answered}
                        onChange={() => mutate((p) => { p.mission.answers = { ...(p.mission.answers ?? {}), [q.id]: j }; })} />
                      <span>{o}</span>
                    </label>
                  ))}
                  {answered && <p className="small" style={{ margin: '.5rem 0 0' }}>{ans === q.answer ? 'Correct. ' : 'Not quite. '}{q.why}</p>}
                </fieldset>
              </div>
            );
          })}
        </section>
      )}

      {project.mission.letter && (
        <section>
          <h3>{m.region === 'EU' ? 'List of questions' : 'Information request'}</h3>
          <div className="letter">
            <p><strong>From:</strong> {project.mission.letter.from}<br /><strong>Date:</strong> {project.mission.letter.date}<br /><strong>Subject:</strong> {project.mission.letter.subject}</p>
            {project.mission.letter.body.map((b) => <p key={b}>{b}</p>)}
            <p className="small muted">Fictional correspondence for training.</p>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{m.id === 11 ? `Defects fixed: ${evaluation.fixed} of ${evaluation.total}` : 'Scoring checklist'}</h3>
          <span className={`pill ${evaluation.score >= 80 ? 'ok' : evaluation.score >= 50 ? 'medium' : 'high'}`}>Score now {evaluation.score}%</span>
        </div>
        {m.id !== 11 && (
          <ul className="checks" style={{ marginTop: '.75rem' }}>
            {evaluation.checks.map((c) => <li key={c.id}><span className={`tick ${c.ok ? 'on' : ''}`} aria-hidden="true">{c.ok ? '✓' : ''}</span>{c.label}<span className="sr-only">{c.ok ? ' — done' : ' — not yet'}</span></li>)}
          </ul>
        )}
        {m.id === 11 && (
          <>
            {level !== 'guided' && !submitted && <p className="small muted">In {level} mode the defect list stays hidden until you submit. Use the validator and your own eye.</p>}
            {(guided || submitted) && (
              <ul className="checks" style={{ marginTop: '.75rem' }}>
                {evaluation.defects.map((d) => (
                  <li key={d.id}><span className={`tick ${d.fixed ? 'on' : ''}`} aria-hidden="true">{d.fixed ? '✓' : ''}</span>
                    <span>{d.fixed || submitted ? d.label : <span className="muted">{d.hint}</span>}<span className="sr-only">{d.fixed ? ' — fixed' : ' — not fixed'}</span></span></li>
                ))}
              </ul>
            )}
            {evaluation.introduced.length > 0 && <p className="callout warn small">You introduced {evaluation.introduced.length} new finding{evaluation.introduced.length > 1 ? 's' : ''} that were not in the handover (2 points each): {evaluation.introduced.slice(0, 4).map((f) => f.ruleId).join(', ')}{evaluation.introduced.length > 4 ? '…' : ''}</p>}
          </>
        )}
        {evaluation.axes && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: '0 0 .4rem' }}>Scoring axes</h4>
            <div className="grid-2" style={{ gap: '.5rem 1rem' }}>
              {AXES.map(([k, label]) => {
                const v = (submitted?.axes ?? evaluation.axes)[k];
                return (
                  <div key={k}>
                    <div className="row small" style={{ justifyContent: 'space-between' }}><span>{label}</span><strong>{v}%</strong></div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)' }} role="meter" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
                      <div style={{ width: `${v}%`, height: '100%', borderRadius: 3, background: v >= 80 ? 'var(--ok)' : v >= 50 ? 'var(--medium)' : 'var(--high)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="small muted" style={{ marginTop: '.4rem' }}>Technical: validator findings. Lifecycle: lifecycle-rule findings across sequences. Consistency: contradictions in the current view. Time: against the mission clock (45 minutes when untimed).</p>
          </div>
        )}
        <div className="row" style={{ marginTop: '1rem' }}>
          {!submitted ? <button className="btn primary" onClick={onSubmit}>Submit for scoring</button>
            : <span className="pill ok">Submitted {new Date(submitted.at).toLocaleString()} with {submitted.score}%{submitted.seconds != null ? ` in ${Math.floor(submitted.seconds / 60)} min ${submitted.seconds % 60} s` : ''}</span>}
          <span className="small muted">Scoring records your attempt in this browser. You can keep working afterwards, but the submitted score stays.</span>
        </div>
      </section>
    </div>
  );
}
