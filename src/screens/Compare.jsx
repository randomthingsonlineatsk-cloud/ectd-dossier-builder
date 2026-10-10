import React, { useMemo, useState } from 'react';
import { useApp } from '../ctx.js';
import { COMPARE, NONE, NONE_LABEL, headingLabel, headingsFor, whereQuiz, scoreWhere, checkItemRow, scoreActd } from '../engine/compare.js';

const VIEWS = [['matrix', 'Side by side'], ['where', 'Where does it go?'], ['row', 'One document, six regions'], ['actd', 'CTD to ASEAN ACTD']];

export default function Compare() {
  const [view, setView] = useState('matrix');
  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <p className="small"><a href="#/learn">Learn</a> / Region comparison</p>
      <h1>Region comparison</h1>
      <p>Modules 2 to 5 travel; Module 1 does not. These exercises take the same documents and ask where each region wants them, then convert a CTD into the ASEAN format. Every region here is one of this app's packs, so you can also build a dossier for it.</p>
      <div className="seg" role="tablist" aria-label="Exercises" style={{ margin: '1rem 0' }}>
        {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
      {view === 'matrix' && <Matrix />}
      {view === 'where' && <Where />}
      {view === 'row' && <Row />}
      {view === 'actd' && <Actd />}
      <p className="small muted" style={{ marginTop: '1.5rem' }}>Sources: the FDA comprehensive table of contents, the EU Module 1 specification, the PMDA and JGA Module 1 structures, the CDSCO CTD guidance, Health Canada's guidance on organization and document placement for Canadian Module 1, the Swiss Module 1 specification for eCTD v1.6, and the ASEAN Common Technical Dossier organization of the dossier. Training only.</p>
    </div>
  );
}

function Matrix() {
  const [reveal, setReveal] = useState(true);
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>The same item in each region</h2>
        <label className="small row"><input type="checkbox" checked={!reveal} onChange={(e) => setReveal(!e.target.checked)} /> Hide the answers and test yourself</label>
      </div>
      <div className="table-wrap" style={{ marginTop: '.75rem' }}>
        <table className="data compare">
          <thead><tr><th>Item</th>{COMPARE.regions.map((r) => <th key={r.id}>{r.label}</th>)}</tr></thead>
          <tbody>
            {COMPARE.items.map((it) => (
              <tr key={it.id}>
                <td><strong>{it.label}</strong><div className="small muted">{it.note}</div></td>
                {COMPARE.regions.map((r) => (
                  <td key={r.id} className={it.map[r.id] ? '' : 'none'}>
                    {reveal ? (it.map[r.id] ? headingLabel(r.id, it.map[r.id]) : <span className="muted">—</span>) : <span className="muted">?</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>A dash means the region has no heading for it.</p>
    </section>
  );
}

function Where() {
  const { saveExercise, toast } = useApp();
  const [seed, setSeed] = useState(() => Date.now());
  const qs = useMemo(() => whereQuiz(10, seed), [seed]);
  const [ans, setAns] = useState({});
  const done = Object.keys(ans).length === qs.length;
  const right = scoreWhere(qs, ans);
  const finish = async () => {
    const score = Math.round((right / qs.length) * 100);
    await saveExercise('compare', { exercise: 'where', score, right, total: qs.length });
    toast(`Region comparison: ${right} of ${qs.length}.`);
  };
  return (
    <div>
      <p className="small muted">Ten random pairs of item and region. Some regions have no heading for the item: then "{NONE_LABEL}" is the answer.</p>
      {qs.map((q, i) => {
        const a = ans[q.id];
        const answered = a !== undefined;
        return (
          <section key={q.id} className="quiz-q">
            <fieldset>
              <legend>{i + 1}. {q.region.label}: where does the <strong>{q.item.label.toLowerCase()}</strong> go?</legend>
              {q.options.map((o) => (
                <label key={o.code} className={`quiz-opt ${answered && o.code === q.answer ? 'right' : answered && a === o.code ? 'wrong' : ''}`}>
                  <input type="radio" name={q.id} disabled={answered} checked={a === o.code} onChange={() => setAns({ ...ans, [q.id]: o.code })} />
                  <span>{o.label}</span>
                </label>
              ))}
            </fieldset>
            {answered && <p className="small" style={{ margin: '.4rem 0 0' }}>{a === q.answer ? 'Correct. ' : `Not quite: ${headingLabel(q.region.id, q.answer)}. `}{q.item.note}</p>}
          </section>
        );
      })}
      <div className="row">
        <span aria-live="polite">{Object.keys(ans).length} of {qs.length} answered{Object.keys(ans).length ? `, ${right} right` : ''}.</span>
        {done && <button className="btn primary" onClick={finish}>Save score</button>}
        <button className="btn" onClick={() => { setSeed(Date.now()); setAns({}); }}>New set</button>
      </div>
    </div>
  );
}

function Row() {
  const { saveExercise, toast } = useApp();
  const [itemId, setItemId] = useState(COMPARE.items[0].id);
  const [picks, setPicks] = useState({});
  const [checked, setChecked] = useState(null);
  const it = COMPARE.items.find((x) => x.id === itemId);
  const opts = useMemo(() => Object.fromEntries(COMPARE.regions.map((r) => [r.id, headingsFor(r.id)])), []);
  const check = async () => {
    const res = checkItemRow(itemId, picks);
    setChecked(res);
    const right = Object.values(res).filter(Boolean).length;
    await saveExercise('compare', { exercise: `row:${itemId}`, score: Math.round((right / COMPARE.regions.length) * 100), right, total: COMPARE.regions.length });
    toast(`${it.label}: ${right} of ${COMPARE.regions.length} regions right.`);
  };
  return (
    <section className="panel">
      <label className="field" style={{ maxWidth: 420 }}>Item
        <select value={itemId} onChange={(e) => { setItemId(e.target.value); setPicks({}); setChecked(null); }}>
          {COMPARE.items.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
      <p className="small muted">Pick the heading in every region, then check. Choose "{NONE_LABEL}" where the region has none.</p>
      <div className="grid-2">
        {COMPARE.regions.map((r) => (
          <label key={r.id} className="field">{r.label}
            <select value={picks[r.id] ?? ''} onChange={(e) => { setPicks({ ...picks, [r.id]: e.target.value }); setChecked(null); }}
              aria-invalid={checked ? !checked[r.id] : undefined}>
              <option value="">Choose…</option>
              <option value={NONE}>{NONE_LABEL}</option>
              {opts[r.id].map((c) => <option key={c} value={c}>{headingLabel(r.id, c)}</option>)}
            </select>
            {checked && <small style={{ color: checked[r.id] ? 'var(--ok)' : 'var(--high)' }}>{checked[r.id] ? 'Right' : `Answer: ${headingLabel(r.id, it.map[r.id] ?? NONE)}`}</small>}
          </label>
        ))}
      </div>
      <div className="row" style={{ marginTop: '.75rem' }}>
        <button className="btn primary" disabled={COMPARE.regions.some((r) => !picks[r.id])} onClick={check}>Check</button>
        {checked && <span className="small">{it.note}</span>}
      </div>
    </section>
  );
}

function Actd() {
  const { saveExercise, toast } = useApp();
  const [ans, setAns] = useState({});
  const [res, setRes] = useState(null);
  const A = COMPARE.actd;
  const check = async () => {
    const r = scoreActd(ans);
    setRes(r);
    await saveExercise('compare', { exercise: 'actd', score: Math.round((r.right / r.total) * 100), right: r.right, total: r.total });
    toast(`CTD to ACTD: ${r.right} of ${r.total}.`);
  };
  return (
    <section className="panel">
      <h2 style={{ fontSize: 'var(--step-1)' }}>Convert a CTD into the ASEAN Common Technical Dossier</h2>
      <ul className="small">{A.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>ICH CTD</th><th>ACTD destination</th><th /></tr></thead>
          <tbody>
            {A.pairs.map((p, i) => (
              <tr key={p.ctd}>
                <td>{p.ctd}</td>
                <td>
                  <select aria-label={`ACTD destination for ${p.ctd}`} value={ans[i] ?? ''} onChange={(e) => { setAns({ ...ans, [i]: Number(e.target.value) }); setRes(null); }}>
                    <option value="">Choose…</option>
                    {A.targets.map((t, j) => <option key={t} value={j}>{t}</option>)}
                  </select>
                </td>
                <td className="small">{res && (res.res[i] ? <span className="pill ok">Right</span> : <span className="pill high">{A.targets[p.answer]}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: '.75rem' }}>
        <button className="btn primary" disabled={Object.keys(ans).length < A.pairs.length} onClick={check}>Check</button>
        {res && <span>{res.right} of {res.total} right.</span>}
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>{A._source}</p>
    </section>
  );
}
