import React, { useMemo, useState } from 'react';
import usM1 from '../../data/us-m1.json' with { type: 'json' };
import { INDEX } from '../../engine/tree.js';
import { historyOf, lifecycleState, nextSequenceNumber, sortedSequences } from '../../engine/model.js';
import { validate } from '../../engine/validate.js';
import { createSequence, deleteSequence, publishWithFiles } from '../../engine/ops.js';

export default function Sequences({ project, seq, setSeqNumber, mutate, mutateAsync, toast, onPublished }) {
  const seqs = sortedSequences(project);
  const [form, setForm] = useState({ submissionType: 'original-application', subType: 'amendment', description: '' });
  const [view, setView] = useState('current');
  const [hist, setHist] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const state = useMemo(() => lifecycleState(project), [project]);
  const rows = [...state.entries.values()]
    .filter((e) => e.leaf.operation !== 'delete' || view === 'cumulative')
    .filter((e) => view === 'cumulative' || e.status === 'current')
    .sort((a, b) => INDEX.order.indexOf(a.leaf.nodeCode) - INDEX.order.indexOf(b.leaf.nodeCode) || a.seq.localeCompare(b.seq));
  const nextNum = nextSequenceNumber(project);
  const drafts = seqs.filter((s) => s.status === 'draft');

  const create = (e) => {
    e.preventDefault();
    let num;
    mutate((p) => { num = createSequence(p, form).number; });
    setSeqNumber(num);
    toast(`Sequence ${num} created. Build it in the builder, then publish it here.`);
  };
  const [busy, setBusy] = useState(false);
  const doPublish = async (number) => {
    let res;
    setBusy(true);
    await mutateAsync(async (p) => { res = await publishWithFiles(p, number); });
    setBusy(false);
    setConfirming(null);
    if (res) toast(`Sequence ${number} published. ${res.result.verdict.text}`, res.result.counts.High ? 'warn' : 'info');
    onPublished?.(number);
  };

  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Sequences</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Sequence</th><th>Type</th><th>Description</th><th>Leaves</th><th>Status</th><th /></tr></thead>
            <tbody>
              {seqs.map((s) => (
                <tr key={s.id} style={s.number === seq.number ? { background: 'var(--surface-2)' } : undefined}>
                  <td><span className="seq-chip">{s.number}</span></td>
                  <td>{s.submissionType} / {s.subType}</td>
                  <td>{s.description || <span className="muted">—</span>}</td>
                  <td>{s.leaves.length}</td>
                  <td>{s.status === 'published'
                    ? <span className={`pill ${s.publishSummary?.counts.High ? 'high' : 'ok'}`}>Published {new Date(s.publishedAt).toLocaleDateString()}{s.publishSummary?.counts.High ? `, ${s.publishSummary.counts.High} high` : ''}</span>
                    : <span className="pill">Draft</span>}</td>
                  <td className="row">
                    <button className="btn small" onClick={() => setSeqNumber(s.number)} disabled={s.number === seq.number}>{s.number === seq.number ? 'Selected' : 'Select'}</button>
                    {s.status === 'draft' && <button className="btn small primary" onClick={() => setConfirming({ number: s.number, v: validate(project, s.number) })}>Publish</button>}
                    {s.status === 'draft' && seqs.length > 1 && <button className="btn small danger" onClick={() => { mutate((p) => deleteSequence(p, s.number)); setSeqNumber(seqs.find((x) => x.number !== s.number).number); }}>Delete draft</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Publishing freezes a sequence, as in real life. Any later change needs a new sequence.</p>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Create sequence {nextNum}</h2>
        {drafts.length > 0 && <p className="callout warn small">Sequence {drafts.map((d) => d.number).join(', ')} is still a draft. Lifecycle targets must come from published sequences, so publish it first unless you are working ahead.</p>}
        <form onSubmit={create} className="grid-2">
          <label className="field">Submission type
            <select value={form.submissionType} onChange={(e) => setForm({ ...form, submissionType: e.target.value })}>
              {usM1.submissionTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">Sub-type
            <select value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })}>
              {usM1.submissionSubTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>Description
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Response to information request dated Day 74" />
          </label>
          <div><button className="btn primary" type="submit">Create sequence {nextNum}</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>{view === 'current' ? 'Current view' : 'Cumulative view'}</h2>
          <div className="seg" role="group" aria-label="Lifecycle view">
            <button aria-pressed={view === 'current'} onClick={() => setView('current')}>Current</button>
            <button aria-pressed={view === 'cumulative'} onClick={() => setView('cumulative')}>Cumulative</button>
          </div>
        </div>
        <p className="small muted">{view === 'current' ? 'What a reviewer sees today, across every sequence including drafts.' : 'Every leaf ever placed, with what happened to it.'} Select a leaf to see its history.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Heading</th><th>Leaf title</th><th>Sequence</th><th>Operation</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.key}>
                  <td><strong>{e.leaf.nodeCode}</strong></td>
                  <td><button className="btn ghost small" style={{ padding: 0, textAlign: 'left' }} onClick={() => setHist(e.key)}>{e.leaf.title || '(no title)'}</button></td>
                  <td>{e.seq}</td>
                  <td><span className={`op ${e.leaf.operation}`}>{e.leaf.operation}</span></td>
                  <td>{e.status === 'delete-op' ? 'delete instruction' : e.status}{e.by ? ` by ${e.by.split(':')[0]}` : ''}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="muted">Nothing placed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {hist && (
        <div className="modal-back" onClick={() => setHist(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="hist-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="hist-title">Document history</h2>
            <ol className="lc-steps" style={{ paddingLeft: 0, listStyle: 'none' }}>
              {historyOf(project, hist).map((e) => (
                <li key={e.key} className="lc-seq">
                  <span className="num">{e.seq}</span>
                  <span><span className={`op ${e.leaf.operation}`}>{e.leaf.operation}</span> {e.leaf.title || '(no title)'} <span className="small muted">({e.leaf.nodeCode}, {e.status})</span></span>
                </li>
              ))}
            </ol>
            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => setHist(null)}>Close</button></div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="modal-back" onClick={() => setConfirming(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pub-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="pub-title">Publish sequence {confirming.number}?</h2>
            <p className={`verdict ${confirming.v.verdict.level}`}>{confirming.v.verdict.text}</p>
            <p className="small">High {confirming.v.counts.High} · Medium {confirming.v.counts.Medium} · Low {confirming.v.counts.Low}</p>
            <p className="small muted">Publishing generates every PDF in the sequence, records its MD5 checksum and freezes the sequence. You can publish with findings, as a real team sometimes does by mistake, but high findings mean an agency would likely reject it.</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirming(null)}>Keep editing</button>
              <button className="btn primary" disabled={busy} onClick={() => doPublish(confirming.number)}>{busy ? 'Generating files and checksums…' : `Publish sequence ${confirming.number}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
