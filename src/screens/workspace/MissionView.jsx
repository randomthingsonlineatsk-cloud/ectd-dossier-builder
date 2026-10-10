import React from 'react';
import { missionById } from '../../engine/missions.js';

export default function MissionView({ project, evaluation, onSubmit }) {
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

      {project.mission.letter && (
        <section>
          <h3>Information request</h3>
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
        <div className="row" style={{ marginTop: '1rem' }}>
          {!submitted ? <button className="btn primary" onClick={onSubmit}>Submit for scoring</button>
            : <span className="pill ok">Submitted {new Date(submitted.at).toLocaleString()} with {submitted.score}%{submitted.seconds != null ? ` in ${Math.floor(submitted.seconds / 60)} min ${submitted.seconds % 60} s` : ''}</span>}
          <span className="small muted">Scoring records your attempt in this browser. You can keep working afterwards, but the submitted score stays.</span>
        </div>
      </section>
    </div>
  );
}
