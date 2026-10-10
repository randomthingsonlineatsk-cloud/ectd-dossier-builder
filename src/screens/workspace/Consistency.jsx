import React, { useMemo, useState } from 'react';
import { consistencyMatrix, correctFact } from '../../engine/consistency.js';
import { displayCode as dc } from '../../engine/tree.js';
import { modColor } from '../../ctx.js';

// Cross-module consistency QC: every fact as stated by each document in the current view.
// Reviewer's eye mode hides the highlights so the user hunts for contradictions first.
export default function Consistency({ project, seq, mutate, toast }) {
  const { rows, issues } = useMemo(() => consistencyMatrix(project, seq.number), [project, seq.number]);
  const [mode, setMode] = useState('matrix');
  const [picked, setPicked] = useState(() => new Set());
  const [revealed, setRevealed] = useState(false);

  const issueKeys = new Set(issues.map((i) => i.key));
  const togglePick = (k) => { if (revealed) return; setPicked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; }); };
  const reveal = () => {
    const hits = [...picked].filter((k) => issueKeys.has(k)).length;
    const falseAlarms = picked.size - hits;
    const score = issues.length ? Math.max(0, Math.round(((hits - falseAlarms * 0.5) / issues.length) * 100)) : (picked.size ? 0 : 100);
    setRevealed(true);
    mutate((p) => { p.reviewerEye = { score, hits, falseAlarms, total: issues.length, seq: seq.number, at: new Date().toISOString() }; });
    toast(`Reviewer's eye: ${hits} of ${issues.length} contradictions found${falseAlarms ? `, ${falseAlarms} false alarm${falseAlarms > 1 ? 's' : ''}` : ''}.`);
  };
  const restart = () => { setPicked(new Set()); setRevealed(false); };
  const hidden = mode === 'eye' && !revealed;

  const fix = (cell) => {
    let msg = '';
    if (mutate((p) => { msg = correctFact(p, seq.number, cell).message; })) toast(msg);
  };

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Cross-module consistency: current view after sequence {seq.number}</h2>
          <span className="small muted">Technically valid dossiers still fail review when modules contradict each other. Each document states structured facts; this compares them.</span>
        </div>
        <div className="seg" role="group" aria-label="Mode">
          <button aria-pressed={mode === 'matrix'} onClick={() => setMode('matrix')}>Matrix</button>
          <button aria-pressed={mode === 'eye'} onClick={() => { setMode('eye'); restart(); }}>Reviewer's eye</button>
        </div>
      </div>

      {mode === 'matrix' && (
        <p className={`verdict ${issues.length ? 'warn' : 'ok'}`} role="status">
          {issues.length ? `${issues.length} statement${issues.length > 1 ? 's' : ''} contradict${issues.length > 1 ? '' : 's'} the rest of the dossier.` : 'No contradictions: every fact reads the same wherever it is stated.'}
        </p>
      )}
      {mode === 'eye' && (
        <div className="callout">
          {!revealed ? <>Select every statement you think contradicts the rest, then reveal. False alarms cost half a point. <strong>{picked.size}</strong> selected. <button className="btn small primary" onClick={reveal}>Reveal contradictions</button></>
            : <>Score {project.reviewerEye?.score ?? 0}%: {project.reviewerEye?.hits} of {project.reviewerEye?.total} found. <button className="btn small" onClick={restart}>Try again</button></>}
        </div>
      )}

      {rows.length === 0 && <p className="muted">Place documents first: facts appear as soon as the documents that state them are in the dossier.</p>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th style={{ width: '16%' }}>Fact</th>{!hidden && <th style={{ width: '22%' }}>What most documents say</th>}<th>Statements</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.fact.key}>
                <th scope="row">{r.fact.label}{!hidden && r.mismatches > 0 && <span className="pill high" style={{ marginLeft: '.3rem' }}>{r.mismatches}</span>}</th>
                {!hidden && <td>{r.reference}</td>}
                <td>
                  <div style={{ display: 'grid', gap: '.35rem' }}>
                    {r.cells.map((c) => {
                      const bad = !c.ok;
                      const sel = picked.has(c.key);
                      const showBad = !hidden && bad;
                      const editable = seq.status !== 'published';
                      return (
                        <div key={c.key} className="row" style={{ gap: '.5rem', padding: '.3rem .45rem', borderRadius: 4, borderLeft: `3px solid ${modColor(c.leaf.nodeCode)}`,
                          background: showBad ? 'var(--high-bg)' : sel ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--surface-2)' }}>
                          {mode === 'eye' && <input type="checkbox" checked={sel} disabled={revealed} onChange={() => togglePick(c.key)} aria-label={`Flag ${c.doc?.title} as contradicting`} />}
                          <span className="small" style={{ minWidth: 0, flex: 1 }}>
                            <strong>{dc(c.leaf.nodeCode)}</strong> {c.leaf.title} <span className="muted">({c.seq})</span>
                            <span style={{ display: 'block' }}>{c.value}{showBad && <span style={{ color: 'var(--high)' }}> — differs</span>}{revealed && sel && !bad ? <span className="muted"> — false alarm</span> : null}</span>
                          </span>
                          {showBad && editable && <button className="btn small" onClick={() => fix(c)}>{c.seq === seq.number ? 'Correct the document' : 'Create corrected version'}</button>}
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Correcting a document in an unpublished sequence revises it in place. A document already published gets a corrected new version in the library: send it in this sequence with a replace operation.</p>
    </div>
  );
}
