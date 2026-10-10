import React from 'react';
import { displayCode as dc } from '../../engine/tree.js';
import { sortedSequences } from '../../engine/model.js';
import { gatewaySubmit, reopenRejected, advanceClock, canAdvance, prepareResponseSequence, addResponseDoc, reviewSummary, REJECTION, RESPONSE_NODE, GATEWAY, ensureReview, isResponseSeq } from '../../engine/review.js';

const STATUS_PILL = { open: '', unresolved: 'high', resolved: 'ok' };

export default function ReviewView({ project, seq, mutate, toast, setSeqNumber, setTab, focusNode }) {
  const review = project.review ?? { submissions: {}, clock: { started: false, day: 0, idx: -1 }, questions: [], events: [] };
  const sum = reviewSummary(structuredClone(project));
  const v4 = project.ectdVersion === '4.0';
  const label = (n) => (v4 ? `Unit ${parseInt(n, 10)}` : `Sequence ${n}`);
  const sub = review.submissions[seq.number];
  const clock = sum.clock;
  const c = review.clock;
  const lastDay = clock.milestones[clock.milestones.length - 1].day;
  const adv = canAdvance(structuredClone(project));

  const send = () => {
    let rec;
    const ok = mutate((p) => { rec = gatewaySubmit(p, seq.number); });
    if (ok) toast(rec.outcome === 'accepted' ? `${label(seq.number)} accepted.` : `${label(seq.number)} rejected. See the acknowledgments.`, rec.outcome === 'accepted' ? 'ok' : 'warn');
  };
  const advance = () => {
    let res;
    if (mutate((p) => { res = advanceClock(p); })) toast(res.outcome ? res.outcome.text : `${res.milestone.label}${res.raised?.length ? `: ${res.raised.length} question${res.raised.length > 1 ? 's' : ''}` : ''}.`);
  };
  const prepare = () => {
    let s;
    if (mutate((p) => { s = prepareResponseSequence(p); })) { setSeqNumber(s.number); toast(`${label(s.number)} created with a cover letter and response document. Add the corrected documents, then publish and send it.`); }
  };

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <p className="small muted">A simulator, not a real gateway or agency. It shows what happens after you press send: acknowledgments, the review clock, questions raised from your own dossier, and whether your answers resolve them. {clock.label}.</p>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Mock gateway: {label(seq.number)}</h2>
        {seq.status !== 'published' && !sub && <p className="muted">Publish {label(seq.number).toLowerCase()} first. Only a published, frozen package can be sent.</p>}
        {seq.status === 'published' && !sub && (
          <div className="row"><button className="btn primary" onClick={send}>Send through the mock gateway</button>
            <span className="small muted">{(GATEWAY[project.region] ?? []).length} acknowledgments: {(GATEWAY[project.region] ?? []).map((g) => g.label.toLowerCase()).join(', ')}.</span></div>
        )}
        {sub && (
          <>
            <ol className="acks">
              {sub.stages.map((s) => (
                <li key={s.id} className={s.ok ? 'ok' : 'bad'}>
                  <span className={`pill ${s.ok ? 'ok' : 'high'}`}>{s.ok ? 'OK' : 'Failed'}</span> <strong>{s.label}</strong>
                  <div className="small muted">{s.detail}</div>
                </li>
              ))}
            </ol>
            <p className="small">Attempt {sub.attempt} · outcome <strong>{sub.outcome}</strong>{sub.response ? ' · response sequence' : ''}</p>
            {sub.outcome === 'rejected' && (
              <div className="callout warn small">
                <p style={{ marginTop: 0 }}>{REJECTION[project.region]}</p>
                {!sub.reopened
                  ? <button className="btn small" onClick={() => mutate((p) => reopenRejected(p, seq.number)) && toast(`${label(seq.number)} is a draft again. Fix it, publish and send it again.`)}>Reopen {label(seq.number).toLowerCase()} as a draft</button>
                  : seq.status === 'published' ? <button className="btn small primary" onClick={send}>Send again</button> : <span>Reopened. Fix the findings, publish and send again.</span>}
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Review clock</h2>
          <div className="row">
            {c.started && <span className="pill">{clock.unit === 'day' ? 'Day' : 'Working day'} {c.day}</span>}
            {c.stopped && <span className="pill medium">Clock stopped</span>}
            <button className="btn primary" disabled={!adv.ok} onClick={advance}>{sum.next && c.started ? `Advance to ${sum.next.label.toLowerCase()}` : 'Advance'}</button>
          </div>
        </div>
        {!adv.ok && <p className="small muted">{adv.why}</p>}
        <div className="clock-track" role="list" aria-label="Milestones">
          <div className="clock-fill" style={{ width: `${c.started ? Math.min(100, (c.day / lastDay) * 100) : 0}%` }} />
          {clock.milestones.map((m, i) => (
            <div key={m.id} role="listitem" className={`clock-ms ${c.started && i <= c.idx ? 'done' : ''} ${c.started && i === c.idx + 1 ? 'next' : ''}`} style={{ left: `${(m.day / lastDay) * 100}%` }} title={m.help}>
              <span className="dot" /><span className="lbl">{m.day}<br />{m.label}</span>
            </div>
          ))}
        </div>
        {c.outcome && <p className={`callout ${c.outcome.positive ? '' : 'bad'}`} style={{ marginBottom: 0 }}><strong>{c.outcome.positive ? 'Outcome:' : 'Outcome:'}</strong> {c.outcome.text}</p>}
        {c.started && !c.outcome && sum.next && <p className="small muted" style={{ marginBottom: 0 }}>Next: {sum.next.label}. {sum.next.help}</p>}
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Questions ({review.questions.length})</h2>
          <div className="row">
            <span className="small muted">{sum.open} open · {sum.unresolved} unresolved · {sum.resolved} resolved</span>
            {review.questions.some((q) => q.status !== 'resolved') && !c.outcome && <button className="btn small" onClick={prepare}>Start a response {v4 ? 'unit' : 'sequence'}</button>}
            {seq.status !== 'published' && isResponseSeq(project, seq) && review.questions.some((q) => q.status !== 'resolved') && (
              <button className="btn small" onClick={() => mutate((p) => addResponseDoc(p, seq.number)) && toast(`Response document added to ${dc(RESPONSE_NODE[project.region])}.`)}>Add response document to {label(seq.number).toLowerCase()}</button>
            )}
          </div>
        </div>
        {review.questions.length === 0 && <p className="muted small">No questions yet. They are raised at the question milestones on the clock, from missing sections, contradictions between documents and the product's scientific weaknesses.</p>}
        {review.questions.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>#</th><th>Area</th><th>Question</th><th>Where to answer</th><th>Status</th><th /></tr></thead>
              <tbody>
                {review.questions.map((q) => (
                  <tr key={q.id}>
                    <td>{q.n}</td>
                    <td>{q.module}{q.outstanding ? <div className="small muted">outstanding</div> : null}</td>
                    <td style={{ maxWidth: 440 }}>{q.text}{q.note && <div className="small muted">{q.note}</div>}</td>
                    <td className="small">{dc(q.section)}{q.fixDocId && project.documents[q.fixDocId] ? <div className="muted">New data in the library: "{project.documents[q.fixDocId].title}"</div> : null}<div className="muted">Response document: {dc(RESPONSE_NODE[project.region])}</div></td>
                    <td><span className={`pill ${STATUS_PILL[q.status]}`}>{q.status}</span></td>
                    <td><button className="btn small" onClick={() => { focusNode(q.section); setTab('builder'); }}>Open in builder</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>A question is resolved when a response {v4 ? 'unit' : 'sequence'} accepted by the gateway carries a response document and the current dossier answers it: the missing section is there, the contradiction is gone, or the new data are placed at the right heading (use replace for an updated document).</p>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Timeline</h2>
        {review.events.length === 0 ? <p className="muted small">Nothing yet.</p> : (
          <ol className="timeline">
            {review.events.map((e) => (
              <li key={e.id} className={e.kind}><span className="mono small">{e.day == null ? '—' : `${clock.unit === 'day' ? 'D' : 'WD'}${e.day}`}</span> {e.text}</li>
            ))}
          </ol>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>Sequences sent: {sortedSequences(project).filter((s) => review.submissions[s.number]).map((s) => `${label(s.number)} (${review.submissions[s.number].outcome})`).join(', ') || 'none'}.</p>
      </section>
    </div>
  );
}
