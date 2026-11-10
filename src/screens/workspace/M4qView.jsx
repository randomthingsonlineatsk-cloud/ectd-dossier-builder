import React, { useMemo, useState } from 'react';
import { download } from '../../engine/io.js';
import { displayCode as dc, slug } from '../../engine/tree.js';
import { PRODUCTS } from '../../engine/model.js';
import { analyseM4q, m4qCsv, r2Structure, starterDrafts, changeSummary, checkDrafts, draftsHtml, EC_CATEGORIES } from '../../engine/m4q.js';

const ACTION = { move: ['Move', 'ok'], split: ['Split', 'medium'], rewrite: ['Rewrite', 'high'], none: ['No place', 'high'] };
const sevPill = (s) => (s === 'High' ? 'high' : s === 'Medium' ? 'medium' : 'ok');

// An editable table: cols are [key, label, kind] with kind 'text' | 'area' | 'check' | 'select:<options>'.
function Grid({ rows, cols, onChange, onAdd, onRemove, addLabel, caption }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{cols.map(([k, l]) => <th key={k}>{l}</th>)}<th><span className="sr-only">Remove</span></th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(([k, l, kind, opts]) => (
                <td key={k}>
                  {kind === 'check' ? <input type="checkbox" aria-label={`${l}, row ${i + 1}`} checked={!!r[k]} onChange={(e) => onChange(i, k, e.target.checked)} />
                    : kind === 'select' ? <select aria-label={`${l}, row ${i + 1}`} value={r[k] ?? ''} onChange={(e) => onChange(i, k, e.target.value)}><option value="">Choose…</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>
                      : <textarea aria-label={`${l}, row ${i + 1}`} rows={kind === 'area' ? 2 : 1} value={r[k] ?? ''} onChange={(e) => onChange(i, k, e.target.value)} style={{ minWidth: '9rem', width: '100%', minHeight: kind === 'area' ? '3.4rem' : '2.2rem', height: 'auto', fontFamily: 'inherit', fontSize: '.9rem', resize: 'vertical' }} />}
                </td>
              ))}
              <td><button className="btn small" onClick={() => onRemove(i)} aria-label={`Remove row ${i + 1}`}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn small" onClick={onAdd}>{addLabel}</button>
    </div>
  );
}

// The ICH M4Q(R2) what-if: the quality documents of this dossier laid out on the draft structure,
// and the new R2 content (QTPP, control strategy, lifecycle) drafted for this product.
export default function M4qView({ project, mutate, focusNode, setTab, toast }) {
  const a = useMemo(() => analyseM4q(project), [project]);
  const structure = useMemo(() => r2Structure(a), [a]);
  const product = PRODUCTS[project.productId];
  const d = project.m4q ?? null;
  const findings = useMemo(() => checkDrafts(d), [d]);
  const changes = useMemo(() => changeSummary(project), [project]);
  const [openMat, setOpenMat] = useState('DS');
  const [showPreview, setShowPreview] = useState(true);
  const shown = showPreview ? a.rows : a.rows.filter((r) => r.placed);

  const edit = (list, i, k, v) => mutate((p) => { p.m4q[list][i][k] = v; if (list === 'qtpp' && k === 'attribute') { const old = project.m4q.qtpp[i].attribute; for (const c of p.m4q.cs) if (c.cqa === old) c.cqa = v; } });
  const addRow = (list, row) => mutate((p) => { p.m4q[list].push(row); });
  const removeRow = (list, i) => mutate((p) => { p.m4q[list].splice(i, 1); });
  const start = () => { if (d && !window.confirm('Replace your drafts with a fresh start from the product?')) return; mutate((p) => { p.m4q = starterDrafts(p, product); }); toast('Drafts started from the product facts. Edit every row: they are suggestions, not answers.'); };
  const syncCs = () => mutate((p) => { for (const q of p.m4q.qtpp.filter((r) => r.cqa)) if (!p.m4q.cs.some((c) => c.cqa === q.attribute)) p.m4q.cs.push({ cqa: q.attribute, materials: '', process: '', inProcess: '', specification: q.target, source: '' }); });

  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>M4Q(R2) what-if</h2>
        <p>{a.status.text}</p>
        <div className="row" style={{ gap: '1.5rem', flexWrap: 'wrap' }}>
          <div><span className="small muted">In the dossier</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.placedCount}</div></div>
          <div><span className="small muted">Library, not placed yet</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.previewCount}</div></div>
          <div><span className="small muted">Move as they are</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.move}</div></div>
          <div><span className="small muted">Split between 2.3 and Module 3</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.split}</div></div>
          <div><span className="small muted">Rewrite</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.rewrite}</div></div>
          <div><span className="small muted">No place in the draft</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.none}</div></div>
          <div><span className="small muted">New R2 sections drafted</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.gaps.filter((g) => g.drafted).length} of {a.gaps.length}</div></div>
        </div>
        <p className="small muted" style={{ marginTop: '.5rem' }}>Counts cover the documents in the dossier and, as a preview, the product's library documents you have not placed yet.</p>
        {a.previewHidden > 0 && <p className="small callout">The preview of the {a.previewHidden} library documents you have not placed yet opens when you submit this mission, so it does not give away where each one goes. Place documents in the Builder to see them here now.</p>}
        <div className="row" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => download(`${slug(project.name)}-m4q-r2-what-if.csv`, m4qCsv(project, a), 'text/csv')}>Download the mapping and drafts (CSV)</button>
          <button className="btn" disabled={!d} onClick={() => download(`${slug(project.name)}-m4q-r2-drafts.html`, draftsHtml(project, d, product), 'text/html')}>Download the drafts (printable HTML)</button>
        </div>
      </section>

      <section className="panel">
        <h3>New in R2: write it</h3>
        <p className="small">These R2 sections have no R1 heading of their own. Start from the product's facts, then make every row your own: the starting rows are suggestions for practice, not the answer.</p>
        <table className="data">
          <thead><tr><th>R2 section</th><th>What it holds</th><th>Draw on</th><th>Status</th></tr></thead>
          <tbody>
            {a.gaps.map((g) => <tr key={g.code}><td>{g.label}</td><td className="small">{g.why}</td><td className="small">{g.sources.length ? g.sources.map(dc).join(', ') : <span className="muted">nothing in this dossier yet</span>}</td><td>{g.drafted ? <span className="pill ok">Drafted</span> : <span className="pill medium">To write</span>}</td></tr>)}
          </tbody>
        </table>
        <div className="row"><button className="btn primary" onClick={start}>{d ? 'Start again from the product' : 'Start from the product'}</button></div>
      </section>

      {d && (<>
        <section className="panel">
          <h3>2.3.2.1 Quality Target Product Profile</h3>
          <p className="small">The quality the product must have to be safe and effective, stated once. Tick the attributes that are critical quality attributes (CQAs).</p>
          <Grid caption="Quality target product profile" rows={d.qtpp} cols={[['attribute', 'Attribute', 'text'], ['target', 'Target', 'area'], ['justification', 'Justification', 'area'], ['cqa', 'CQA', 'check']]}
            onChange={(i, k, v) => edit('qtpp', i, k, v)} onAdd={() => addRow('qtpp', { attribute: '', target: '', justification: '', cqa: false })} onRemove={(i) => removeRow('qtpp', i)} addLabel="+ Add an attribute" />
        </section>

        <section className="panel">
          <h3>2.3.2.3 Overall Control Strategy Representation</h3>
          <p className="small">For each CQA: how materials, the process and in-process tests control it, and the specification that confirms it. A CQA controlled only by end-product testing is flagged.</p>
          <Grid caption="Control strategy" rows={d.cs} cols={[['cqa', 'CQA', 'text'], ['materials', 'Material controls', 'area'], ['process', 'Process controls', 'area'], ['inProcess', 'In-process controls', 'area'], ['specification', 'Specification', 'area'], ['source', 'Supporting data (R1)', 'text']]}
            onChange={(i, k, v) => edit('cs', i, k, v)} onAdd={() => addRow('cs', { cqa: '', materials: '', process: '', inProcess: '', specification: '', source: '' })} onRemove={(i) => removeRow('cs', i)} addLabel="+ Add a row" />
          <button className="btn small" onClick={syncCs}>Add a row for every CQA without one</button>
        </section>

        <section className="panel">
          <h3>2.3.5.1 Change Summary and Justifications</h3>
          <p className="small">Built from this dossier's sequences: each submission with the quality documents it sent.</p>
          {changes.length === 0 ? <p className="muted">No quality documents in any sequence yet.</p> : (
            <table className="data"><thead><tr><th>Sequence</th><th>Submission</th><th>Quality documents</th></tr></thead>
              <tbody>{changes.map((c) => <tr key={c.seq}><td>{c.seq}</td><td className="small">{c.what} ({c.status})</td><td className="small">{c.quality.join('; ')}</td></tr>)}</tbody></table>
          )}
        </section>

        <section className="panel">
          <h3>2.3.5.2 Product Lifecycle Management (established conditions)</h3>
          <p className="small">Optional: list the elements you propose as established conditions (ICH Q12) and the reporting category for changing each.</p>
          <Grid caption="Established conditions" rows={d.ec} cols={[['element', 'Element', 'text'], ['category', 'Reporting category', 'select', EC_CATEGORIES], ['justification', 'Justification', 'area']]}
            onChange={(i, k, v) => edit('ec', i, k, v)} onAdd={() => addRow('ec', { element: '', isEc: true, category: '', justification: '' })} onRemove={(i) => removeRow('ec', i)} addLabel="+ Add an established condition" />
        </section>

        <section className="panel">
          <h3>2.3.5.3 Content of Post-Approval Change Management Protocols</h3>
          <p className="small">Optional: a planned change, the studies you will run and the acceptance criteria that let it be filed in a lower category.</p>
          <Grid caption="Change management protocols" rows={d.pacmp} cols={[['change', 'Planned change', 'area'], ['studies', 'Studies', 'area'], ['criteria', 'Acceptance criteria', 'area'], ['category', 'Proposed category', 'text']]}
            onChange={(i, k, v) => edit('pacmp', i, k, v)} onAdd={() => addRow('pacmp', { change: '', studies: '', criteria: '', category: '' })} onRemove={(i) => removeRow('pacmp', i)} addLabel="+ Add a protocol" />
        </section>

        <section className="panel">
          <h3>Checks on the drafts</h3>
          {findings.length === 0 ? <p className="muted">No findings: every CQA has a control and a specification.</p> : (
            <table className="data"><thead><tr><th>Severity</th><th>Section</th><th>Finding</th></tr></thead>
              <tbody>{findings.map((f, i) => <tr key={i}><td><span className={`pill ${sevPill(f.sev)}`}>{f.sev}</span></td><td>{f.where}</td><td>{f.msg}</td></tr>)}</tbody></table>
          )}
        </section>
      </>)}

      <section className="panel">
        <h3>The R2 structure, material by material</h3>
        <p className="small">Module 2.3.3 holds the core quality information and Module 3 the supporting data, both organised by material. Most materials follow Description, Manufacture, Control and Storage (D/M/C/S). Open a material to see what goes in each part and which of this dossier's documents feed it.</p>
        <div className="row" style={{ flexWrap: 'wrap', gap: '.4rem', marginBottom: '.75rem' }} role="tablist" aria-label="R2 materials">
          {structure.map((m) => <button key={m.id} role="tab" aria-selected={openMat === m.id} className={`btn small${openMat === m.id ? ' primary' : ''}`} onClick={() => setOpenMat(m.id)}>{m.id} {m.label} ({m.count})</button>)}
        </div>
        {structure.filter((m) => m.id === openMat).map((m) => (
          <div key={m.id}>
            <p className="small"><b>2.3.3.{m.id}</b> (core quality information) and <b>3.2.{m.id}</b> (supporting data){m.optional ? ', if applicable' : ''}{m.module3Only ? '. Impurities have a Module 3 section; their summary sits in 2.3.4' : ''}.{m.dmcs ? '' : ' This material is one section, not split into D/M/C/S.'}</p>
            <table className="data">
              <thead><tr><th>Part</th><th>What goes there</th><th>This dossier's documents</th></tr></thead>
              <tbody>
                {m.parts.map((p) => (
                  <tr key={p.label}>
                    <td>{p.part ? `${p.part}: ${p.label}` : p.label}</td>
                    <td className="small">{p.holds}</td>
                    <td className="small">{p.docs.filter((r) => showPreview || r.placed).length ? p.docs.filter((r) => showPreview || r.placed).map((r) => <div key={`${r.seq}:${r.leafId}`}>{dc(r.nodeCode)} {r.title}{!r.placed && <span className="muted"> (not placed yet)</span>}</div>) : <span className="muted">none yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <ul className="small">
          <li>Module 2.3 also has 2.3.1 General Information, 2.3.2 the overall development and control strategy, 2.3.4 the development summary and justifications (for drug substances, drug products and analytical procedures, plus an integrated part), 2.3.5 product lifecycle management and an optional 2.3.6 product quality benefit risk.</li>
          <li>There is no regional section: regional information goes into the relevant section only where a regional requirement cannot be avoided.</li>
          <li>The mapping here is this app's, drawn from the section descriptions in the Step 2 draft. For real work use ICH's own mapping of R1 to R2 and the final guideline.</li>
        </ul>
      </section>

      <section className="panel">
        <h3>Where each document would go</h3>
        <label className="row small" style={{ margin: '.25rem 0 .75rem' }}><input type="checkbox" checked={showPreview} onChange={(e) => setShowPreview(e.target.checked)} /> Include library documents not placed yet (preview)</label>
        {shown.length === 0 ? <p className="muted">No quality documents (2.3 or Module 3) placed yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead><tr><th>R1 heading</th><th>Document</th><th>Action</th><th>R2 Module 2.3</th><th>R2 Module 3</th><th></th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={`${r.seq}:${r.leafId}`} style={r.placed ? undefined : { opacity: 0.85 }}>
                    <td className="small">{r.r1}</td>
                    <td>{r.title}{!r.placed && <> <span className="pill">Not placed yet</span></>}<div className="small muted">{r.note}</div></td>
                    <td><span className={`pill ${ACTION[r.action][1]}`}>{ACTION[r.action][0]}</span></td>
                    <td className="small">{r.core.length ? r.core.join('; ') : '—'}</td>
                    <td className="small">{r.data || '—'}</td>
                    <td><button className="btn small" onClick={() => { focusNode(r.nodeCode, r.placed ? r.leafId : null); setTab('builder'); }}>{r.placed ? 'Show' : 'Place it'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
