import React, { useMemo, useState } from 'react';
import { useApp } from '../../ctx.js';
import { saveProject } from '../../engine/db.js';
import { download } from '../../engine/io.js';
import { displayCode as dc, REGION_LABEL } from '../../engine/tree.js';
import { productOptions } from '../../engine/model.js';
import {
  ensurePlan, contentPlan, setPlanRow, setPlanTarget, schedule, defaultTasks, addRow, updateRow, removeRow, correspondenceLog, reuseForCountry, csv,
  FUNCTIONS, PLAN_STATUS, REG_STATUS,
} from '../../engine/planning.js';

const VIEWS = [['content', 'Content plan'], ['timeline', 'Timeline'], ['registrations', 'Registrations'], ['commitments', 'Commitments'], ['correspondence', 'Correspondence'], ['reuse', 'Reuse for another country']];

export default function PlanningView({ project, seq, mutate, toast, focusNode, setTab }) {
  const [view, setView] = useState('content');
  const { user, reload } = useApp();
  const p = useMemo(() => { const c = structuredClone(project); ensurePlan(c); return c; }, [project]);
  const plan = p.plan;
  const name = project.ectdVersion === '4.0' ? `unit ${parseInt(seq.number, 10)}` : `sequence ${seq.number}`;

  return (
    <div className="stack">
      <div className="seg" role="tablist" aria-label="Planning views">
        {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
      {view === 'content' && <Content p={p} seq={seq} name={name} mutate={mutate} focusNode={focusNode} setTab={setTab} />}
      {view === 'timeline' && <Timeline p={p} mutate={mutate} />}
      {view === 'registrations' && <Registrations p={p} plan={plan} mutate={mutate} />}
      {view === 'commitments' && <Commitments p={p} plan={plan} mutate={mutate} />}
      {view === 'correspondence' && <Correspondence p={p} mutate={mutate} />}
      {view === 'reuse' && <Reuse project={project} user={user} reload={reload} toast={toast} mutate={mutate} />}
    </div>
  );
}

function Content({ p, seq, name, mutate, focusNode, setTab }) {
  const cp = contentPlan(p, seq.number);
  const late = cp.rows.filter((r) => r.late).length;
  const exportCsv = () => download(`${seq.number}-content-plan.csv`, csv(cp.rows, [['code', 'Section'], ['title', 'Title'], ['owner', 'Owner'], ['due', 'Due'], ['status', 'Status'], [(r) => (r.late ? 'late' : ''), 'Flag']]), 'text/csv');
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Content plan for {name}</h2>
        <div className="row">
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>Target date
            <input type="date" value={cp.target} onChange={(e) => mutate((x) => setPlanTarget(x, seq.number, e.target.value))} />
          </label>
          <button className="btn small" onClick={exportCsv}>Download CSV</button>
        </div>
      </div>
      <p className="small muted">Every heading the submission type requires, every mandatory Module 1 item, and everything already placed. A row turns to "placed" when a document is in the builder. {cp.done} of {cp.rows.length} placed{late ? `; ${late} past due` : ''}.</p>
      <div className="progress-bar" aria-label={`${cp.done} of ${cp.rows.length} placed`}><span style={{ width: `${(cp.done / Math.max(1, cp.rows.length)) * 100}%` }} /></div>
      <div className="table-wrap" style={{ marginTop: '.75rem' }}>
        <table className="data">
          <thead><tr><th>Section</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
          <tbody>
            {cp.rows.map((r) => (
              <tr key={r.code} className={r.late ? 'late' : ''}>
                <td><strong>{dc(r.code)}</strong> {r.title}</td>
                <td><select value={r.owner} onChange={(e) => mutate((x) => setPlanRow(x, seq.number, r.code, { owner: e.target.value }))}>{FUNCTIONS.map((f) => <option key={f}>{f}</option>)}</select></td>
                <td><input type="date" value={r.due} onChange={(e) => mutate((x) => setPlanRow(x, seq.number, r.code, { due: e.target.value }))} />{r.late && <div className="small" style={{ color: 'var(--high)' }}>past due</div>}</td>
                <td>{r.placed ? <span className="pill ok">placed</span> : (
                  <select value={r.status} onChange={(e) => mutate((x) => setPlanRow(x, seq.number, r.code, { status: e.target.value }))}>{PLAN_STATUS.filter((s) => s !== 'placed').map((s) => <option key={s}>{s}</option>)}</select>
                )}</td>
                <td><button className="btn small" onClick={() => { focusNode(r.code); setTab('builder'); }}>Builder</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Timeline({ p, mutate }) {
  const plan = p.plan;
  let sch = null, err = null;
  try { sch = schedule(plan.tasks, plan.start); } catch (e) { err = e.message; }
  const set = (id, patch) => mutate((x) => { const t = ensurePlan(x).tasks.find((y) => y.id === id); Object.assign(t, patch); });
  const total = Math.max(1, sch?.end ?? 1);
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Dossier timeline and critical path</h2>
        <div className="row">
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>Start
            <input type="date" value={plan.start} onChange={(e) => mutate((x) => { ensurePlan(x).start = e.target.value; })} />
          </label>
          <button className="btn small" onClick={() => mutate((x) => { ensurePlan(x).tasks = defaultTasks(); })}>Reset tasks</button>
          {sch && <button className="btn small" onClick={() => download('dossier-timeline.csv', csv(sch.rows, [['name', 'Task'], ['owner', 'Owner'], ['days', 'Days'], ['startDate', 'Start'], ['endDate', 'End'], ['slack', 'Slack (days)'], [(r) => (r.critical ? 'yes' : ''), 'Critical']]), 'text/csv')}>Download CSV</button>}
        </div>
      </div>
      {err && <p className="callout bad">{err}</p>}
      {sch && (
        <>
          <p className="small muted">Ready to dispatch on <strong>{sch.endDate}</strong> ({sch.end} days). The critical path (dark bars) has no slack: a day lost there moves dispatch. Change a duration to see the path shift.</p>
          <div className="gantt" role="table" aria-label="Timeline">
            {sch.rows.map((r) => (
              <div key={r.id} className="g-row" role="row">
                <div className="g-name" role="cell">
                  <span>{r.name}</span>
                  <span className="small muted">{r.owner} · <input type="number" min="0" max="365" value={r.days} aria-label={`Days for ${r.name}`} onChange={(e) => set(r.id, { days: Math.max(0, Number(e.target.value) || 0) })} style={{ width: '4.2em' }} /> d{r.slack > 0 ? ` · slack ${r.slack}` : ''}</span>
                </div>
                <div className="g-track" role="cell">
                  <span className={`g-bar ${r.critical ? 'crit' : ''}`} style={{ left: `${(r.es / total) * 100}%`, width: `${Math.max(0.8, (r.days / total) * 100)}%` }} title={`${r.startDate} to ${r.endDate}`} />
                  {r.slack > 0 && <span className="g-slack" style={{ left: `${(r.ef / total) * 100}%`, width: `${(r.slack / total) * 100}%` }} />}
                </div>
              </div>
            ))}
          </div>
          <p className="small muted">Dependencies: {sch.rows.filter((r) => r.deps.length).map((r) => `${r.name} after ${r.deps.map((d) => plan.tasks.find((t) => t.id === d)?.name).join(' and ')}`).slice(0, 4).join('; ')}…</p>
        </>
      )}
    </section>
  );
}

function Registrations({ p, plan, mutate }) {
  const rows = plan.registrations;
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Registration tracker</h2>
        <div className="row">
          <button className="btn small" onClick={() => mutate((x) => addRow(x, 'registrations', { country: '', procedure: '', status: 'planned', submitted: '', approved: '', note: '' }))}>Add country</button>
          <button className="btn small" onClick={() => download('registrations.csv', csv(rows, [['country', 'Country or region'], ['procedure', 'Procedure'], ['status', 'Status'], ['submitted', 'Submitted'], ['approved', 'Approved'], ['note', 'Note']]), 'text/csv')}>Download CSV</button>
        </div>
      </div>
      <p className="small muted">Where the product is filed and where each filing stands. Countries reused from this project link to their own projects.</p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Country or region</th><th>Procedure</th><th>Status</th><th>Submitted</th><th>Approved</th><th>Note</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><input type="text" value={r.country} onChange={(e) => mutate((x) => updateRow(x, 'registrations', r.id, { country: e.target.value }))} />{r.projectId && r.projectId !== p.id && <div className="small"><a href={`#/project/${r.projectId}`}>Open project</a></div>}</td>
              <td><input type="text" value={r.procedure} onChange={(e) => mutate((x) => updateRow(x, 'registrations', r.id, { procedure: e.target.value }))} /></td>
              <td><select value={r.status} onChange={(e) => mutate((x) => updateRow(x, 'registrations', r.id, { status: e.target.value }))}>{REG_STATUS.map((s) => <option key={s}>{s}</option>)}</select></td>
              <td><input type="date" value={r.submitted} onChange={(e) => mutate((x) => updateRow(x, 'registrations', r.id, { submitted: e.target.value }))} /></td>
              <td><input type="date" value={r.approved} onChange={(e) => mutate((x) => updateRow(x, 'registrations', r.id, { approved: e.target.value }))} /></td>
              <td><input type="text" value={r.note} onChange={(e) => mutate((x) => updateRow(x, 'registrations', r.id, { note: e.target.value }))} /></td>
              <td><button className="btn small ghost" aria-label="Remove row" onClick={() => mutate((x) => removeRow(x, 'registrations', r.id))}>✕</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Commitments({ p, plan, mutate }) {
  const rows = plan.commitments;
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Commitments</h2>
        <div className="row">
          <button className="btn small" onClick={() => mutate((x) => addRow(x, 'commitments', { text: '', due: '', status: 'open', changeControl: '' }))}>Add commitment</button>
          <button className="btn small" onClick={() => download('commitments.csv', csv(rows, [['text', 'Commitment'], ['due', 'Due'], ['status', 'Status'], ['changeControl', 'Change control']]), 'text/csv')}>Download CSV</button>
        </div>
      </div>
      <p className="small muted">Promises made to an agency: post-approval studies, stability updates, process validation reports. The change control field is a placeholder; it will link to the Variations Classifier, a planned companion app.</p>
      {rows.length === 0 && <p className="muted small">None yet. For example: "Submit 24-month long-term stability data for the three registration batches", due a year after approval.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Commitment</th><th>Due</th><th>Status</th><th>Change control</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><input type="text" value={r.text} style={{ minWidth: 280 }} onChange={(e) => mutate((x) => updateRow(x, 'commitments', r.id, { text: e.target.value }))} /></td>
                <td><input type="date" value={r.due} onChange={(e) => mutate((x) => updateRow(x, 'commitments', r.id, { due: e.target.value }))} /></td>
                <td><select value={r.status} onChange={(e) => mutate((x) => updateRow(x, 'commitments', r.id, { status: e.target.value }))}>{['open', 'submitted', 'fulfilled', 'released'].map((s) => <option key={s}>{s}</option>)}</select></td>
                <td><input type="text" placeholder="e.g. CC-2026-014" value={r.changeControl} onChange={(e) => mutate((x) => updateRow(x, 'commitments', r.id, { changeControl: e.target.value }))} /></td>
                <td><button className="btn small ghost" aria-label="Remove row" onClick={() => mutate((x) => removeRow(x, 'commitments', r.id))}>✕</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Correspondence({ p, mutate }) {
  const rows = correspondenceLog(p);
  const [draft, setDraft] = useState({ date: new Date().toISOString().slice(0, 10), direction: 'to agency', subject: '' });
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Correspondence log</h2>
        <button className="btn small" onClick={() => download('correspondence.csv', csv(rows, [['date', 'Date'], ['direction', 'Direction'], ['subject', 'Subject'], [(r) => (r.auto ? 'review simulator' : 'manual'), 'Source']]), 'text/csv')}>Download CSV</button>
      </div>
      <p className="small muted">Entries from the review simulator (acknowledgments, questions, outcomes) appear here on their own. Add meetings, calls and letters by hand.</p>
      <div className="row" style={{ alignItems: 'end', margin: '.5rem 0' }}>
        <label className="field">Date<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
        <label className="field">Direction<select value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value })}>{['to agency', 'from agency', 'meeting', 'note'].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>Subject<input type="text" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
        <button className="btn" disabled={!draft.subject.trim()} onClick={() => { mutate((x) => addRow(x, 'correspondence', { ...draft })); setDraft({ ...draft, subject: '' }); }}>Add</button>
      </div>
      {rows.length === 0 ? <p className="muted small">Nothing logged yet.</p> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Date</th><th>Direction</th><th>Subject</th><th>Source</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}><td>{r.date}</td><td>{r.direction}</td><td>{r.subject}</td><td className="small muted">{r.auto ? `review simulator${r.day != null ? `, day ${r.day}` : ''}` : 'manual'}</td>
                <td>{!r.auto && <button className="btn small ghost" aria-label="Remove row" onClick={() => mutate((x) => removeRow(x, 'correspondence', r.id))}>✕</button>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Reuse({ project, user, reload, toast, mutate }) {
  const opts = productOptions(project.productId).filter((o) => o.region !== project.region);
  const [region, setRegion] = useState(opts[0]?.region ?? '');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      let res;
      const ok = mutate((x) => { res = reuseForCountry(x, region, user); });
      if (!ok) return;
      await saveProject(res.project);
      await reload();
      toast(`Created "${res.project.name}" with ${res.count} Module 2-5 documents placed. Module 1 is empty: build it for ${REGION_LABEL[region]}.`);
      window.location.hash = `#/project/${res.project.id}`;
    } finally { setBusy(false); }
  };
  return (
    <section className="panel" style={{ maxWidth: 760 }}>
      <h2 style={{ fontSize: 'var(--step-1)' }}>Reuse for another country</h2>
      <p>Modules 2 to 5 are harmonised, so the current documents can be filed again elsewhere. This creates a new project for the chosen region with every current Module 2-5 document placed as "new" in its first sequence, including corrected versions. Module 1 starts empty.</p>
      <p className="small muted">Check before you file: in Japan Module 2 is expected in Japanese, India needs its own Module 1 forms and fee, and a v4.0 region uses keywords instead of study tagging files.</p>
      {opts.length === 0 ? <p className="muted">This product has no other region in this app.</p> : (
        <div className="row">
          <label className="field">Region<select value={region} onChange={(e) => setRegion(e.target.value)}>{opts.map((o) => <option key={o.region} value={o.region}>{REGION_LABEL[o.region]} ({o.appType.toUpperCase()})</option>)}</select></label>
          <button className="btn primary" disabled={busy} onClick={go}>{busy ? 'Creating…' : 'Create the new project'}</button>
        </div>
      )}
    </section>
  );
}
