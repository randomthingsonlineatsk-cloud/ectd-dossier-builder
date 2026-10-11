import React, { useMemo, useState } from 'react';
import { INDEX, REGION_PACKS, displayCode as dc } from '../../engine/tree.js';
import { historyOf, lifecycleState, nextSequenceNumber, sortedSequences, isRetireOp } from '../../engine/model.js';
import { validate } from '../../engine/validate.js';
import { createSequence, deleteSequence, publishWithFiles } from '../../engine/ops.js';
import { parseChangePackage, importChangePackage, todoStatus } from '../../engine/changepkg.js';
import { parseLabellingPackage, importLabellingPackage } from '../../engine/labelpkg.js';

export default function Sequences({ project, seq, setSeqNumber, mutate, mutateAsync, toast, onPublished }) {
  const seqs = sortedSequences(project);
  const eu = project.region === 'EU';
  const pack = REGION_PACKS[project.region];
  const [form, setForm] = useState(eu
    ? { submissionType: 'maa', subType: 'response', relatedSequence: '0000', submissionMode: 'single', description: '' }
    : { submissionType: 'original-application', subType: 'amendment', description: '' });
  const [change, setChange] = useState({ type: 'Type II', scope: '' });
  const [view, setView] = useState('current');
  const [hist, setHist] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const state = useMemo(() => lifecycleState(project), [project]);
  const rows = [...state.entries.values()]
    .filter((e) => !isRetireOp(e.leaf.operation) || view === 'cumulative')
    .filter((e) => view === 'cumulative' || e.status === 'current')
    .sort((a, b) => INDEX.order.indexOf(a.leaf.nodeCode) - INDEX.order.indexOf(b.leaf.nodeCode) || a.seq.localeCompare(b.seq));
  const nextNum = nextSequenceNumber(project);
  const drafts = seqs.filter((s) => s.status === 'draft');
  const importPkg = async (file) => {
    try {
      const pkg = parseChangePackage(await file.text());
      let num; let warns = [];
      mutate((p) => { const r = importChangePackage(p, pkg); num = r.seq.number; warns = r.warnings; });
      setSeqNumber(num);
      toast(`Sequence ${num} started from the change package (${pkg.submission.categoryLabel}). Add the leaves on its to-do list.${warns.length ? ` ${warns.join(' ')}` : ''}`, warns.length ? 'warn' : 'info');
    } catch (err) { toast(err.message, 'error'); }
  };

  const importLabels = async (file) => {
    try {
      const pkg = parseLabellingPackage(await file.text());
      let num; let res;
      mutate((p) => { res = importLabellingPackage(p, pkg, { seqNumber: seq?.number }); num = res.seq.number; });
      setSeqNumber(num);
      toast(`${res.placed.length} label document(s) placed in sequence ${num} (Module 1.14).${res.warnings.length ? ` ${res.warnings.join(' ')}` : ''}`, res.warnings.length ? 'warn' : 'info');
    } catch (err) { toast(err.message, 'error'); }
  };

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
                  <td>{s.submissionType} / {s.subType}{eu && s.relatedSequence ? <span className="small muted"> · related {s.relatedSequence}</span> : null}{eu && s.submissionMode !== 'single' ? <span className="small muted"> · {s.submissionMode}</span> : null}</td>
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

      {eu && seq.status === 'draft' && seq.submissionMode !== 'single' && (
        <section className="panel">
          <h2 style={{ fontSize: 'var(--step-1)' }}>Changes in sequence {seq.number} ({seq.submissionMode})</h2>
          <p className="small muted">{seq.submissionMode === 'grouping' ? 'A grouping covers several variations of one product in one submission.' : 'Worksharing covers one change across several products of the same holder.'} List each change; the cover letter picks them up.</p>
          <ol className="small">{(seq.changes ?? []).map((c, i) => <li key={i}>{c.type}: {c.scope} <button className="btn small ghost" onClick={() => mutate((p) => { const q = p.sequences.find((x) => x.id === seq.id); q.changes.splice(i, 1); })}>Remove</button></li>)}</ol>
          <div className="row">
            <select value={change.type} onChange={(e) => setChange({ ...change, type: e.target.value })} style={{ maxWidth: 160 }} aria-label="Variation type">
              {['Type IA', 'Type IAIN', 'Type IB', 'Type II'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input type="text" value={change.scope} onChange={(e) => setChange({ ...change, scope: e.target.value })} placeholder="Scope, e.g. B.II.b.1.c - addition of a manufacturing site" style={{ maxWidth: 420 }} aria-label="Change scope" />
            <button className="btn small" disabled={!change.scope.trim()} onClick={() => { mutate((p) => { const q = p.sequences.find((x) => x.id === seq.id); q.changes = [...(q.changes ?? []), { ...change, scope: change.scope.trim() }]; }); setChange({ ...change, scope: '' }); }}>Add change</button>
          </div>
        </section>
      )}

      {seq.changePackage && (
        <section className="panel">
          <h2 style={{ fontSize: 'var(--step-1)' }}>Sequence {seq.number}: from the Variations Classifier</h2>
          <p className="small">{seq.changePackage.categoryLabel}{seq.changePackage.implementation ? ` · ${seq.changePackage.implementation.badge}` : ''}{seq.changePackage.earliestUse ? ` · earliest use ${seq.changePackage.earliestUse}` : ''}. The cover letter for this sequence uses the letter from the package.</p>
          <ul className="small">{seq.changePackage.changes.map((c) => <li key={c.id}>{c.title}{c.note ? `: ${c.note}` : ''} ({{ CBE30: "CBE-30", CBE0: "CBE-0" }[c.category] ?? c.category}; {c.entry?.at})</li>)}</ul>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Section</th><th>Document</th><th>Operation</th><th>In this sequence</th></tr></thead>
              <tbody>
                {todoStatus(seq).map((t) => (
                  <tr key={t.code}>
                    <td><strong>{t.code}</strong></td>
                    <td>{t.label}<div className="small muted">{t.why.join('; ')}</div></td>
                    <td><span className={`op ${t.operation}`}>{t.operation}</span></td>
                    <td>{t.placed ? <span className="pill ok">Placed</span> : <span className="pill">To do</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">"replace" and "append" need the earlier leaf as target; place them in the builder from the current view.</p>
        </section>
      )}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Start a sequence from a change package</h2>
        <p className="small muted">Classified a change in the Variations Classifier? Import its change package to start a draft sequence of the right type, with the cover letter and a to-do list of leaves.</p>
        <label className="btn" style={{ width: 'fit-content' }}>Import change package
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { if (e.target.files[0]) importPkg(e.target.files[0]); e.target.value = ''; }} />
        </label>
      </section>

      {project.region === 'US' && (
        <section className="panel">
          <h2 style={{ fontSize: 'var(--step-1)' }}>Import labelling package</h2>
          <p className="small muted">Labels written in the <a href="https://randomthingsonlineatsk-cloud.github.io/labelling-workbench/" target="_blank" rel="noreferrer">Labelling Workbench</a> go into Module 1.14: draft labels to 1.14.1, approved ones to 1.14.2. They are added to the selected draft sequence, or to a new labeling supplement if the selected sequence is published.</p>
          <label className="btn" style={{ width: 'fit-content' }}>Import labelling package
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { if (e.target.files[0]) importLabels(e.target.files[0]); e.target.value = ''; }} />
          </label>
        </section>
      )}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Create sequence {nextNum}</h2>
        {drafts.length > 0 && <p className="callout warn small">Sequence {drafts.map((d) => d.number).join(', ')} is still a draft. Lifecycle targets must come from published sequences, so publish it first unless you are working ahead.</p>}
        <form onSubmit={create} className="grid-2">
          <label className="field">Submission type
            <select value={form.submissionType} onChange={(e) => setForm({ ...form, submissionType: e.target.value })}>
              {pack.submissionTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">Sub-type
            <select value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })}>
              {pack.submissionSubTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          {eu && (
            <>
              <label className="field">Related sequence <small>the sequence that started the procedure</small>
                <select value={form.relatedSequence} onChange={(e) => setForm({ ...form, relatedSequence: e.target.value })}>
                  <option value="">None (initial or reformat)</option>
                  {seqs.map((x) => <option key={x.id} value={x.number}>{x.number}</option>)}
                </select>
              </label>
              <label className="field">Submission mode
                <select value={form.submissionMode} onChange={(e) => setForm({ ...form, submissionMode: e.target.value })}>
                  {pack.submissionModes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </>
          )}
          <label className="field" style={{ gridColumn: '1 / -1' }}>Description
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={eu ? 'e.g. Responses to the Day 120 list of questions' : 'e.g. Response to information request dated Day 74'} />
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
                  <td><strong>{dc(e.leaf.nodeCode)}</strong></td>
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
                  <span><span className={`op ${e.leaf.operation}`}>{e.leaf.operation}</span> {e.leaf.title || '(no title)'} <span className="small muted">({dc(e.leaf.nodeCode)}, {e.status})</span></span>
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
