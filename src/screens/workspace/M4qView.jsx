import React, { useMemo } from 'react';
import { download } from '../../engine/io.js';
import { displayCode as dc, slug } from '../../engine/tree.js';
import { analyseM4q, m4qCsv } from '../../engine/m4q.js';

const ACTION = { move: ['Move', 'ok'], split: ['Split', 'medium'], rewrite: ['Rewrite', 'high'], none: ['No place', 'high'] };

// The ICH M4Q(R2) what-if: the quality documents of this dossier laid out on the draft structure.
export default function M4qView({ project, focusNode, setTab }) {
  const a = useMemo(() => analyseM4q(project), [project]);
  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>M4Q(R2) what-if</h2>
        <p>{a.status.text}</p>
        <div className="row" style={{ gap: '1.5rem', flexWrap: 'wrap' }}>
          <div><span className="small muted">Quality documents</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.rows.length}</div></div>
          <div><span className="small muted">Move as they are</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.move}</div></div>
          <div><span className="small muted">Split between 2.3 and Module 3</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.split}</div></div>
          <div><span className="small muted">Rewrite</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.rewrite}</div></div>
          <div><span className="small muted">No place in the draft</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.none}</div></div>
        </div>
        <div className="row" style={{ marginTop: '1rem' }}>
          <button className="btn" disabled={!a.rows.length} onClick={() => download(`${slug(project.name)}-m4q-r2-what-if.csv`, m4qCsv(project, a), 'text/csv')}>Download the mapping (CSV)</button>
        </div>
      </section>

      <section className="panel">
        <h3>What changes in R2</h3>
        <ul className="small">
          <li>Module 2.3 stops being a summary of Module 3. It holds the core quality information (2.3.3) that the assessment and the lifecycle rest on, with the overall development and control strategy (2.3.2), the development summary and justifications (2.3.4) and product lifecycle management (2.3.5).</li>
          <li>Module 3 holds the supporting data, organised by material: drug substances, intermediates, starting and raw materials, excipients, reference standards, impurities, drug products, devices, analytical procedures and facilities.</li>
          <li>Most materials follow one pattern: Description, Manufacture, Control and Storage (D/M/C/S).</li>
          <li>There is no regional section: regional information goes into the relevant section only where a regional requirement cannot be avoided.</li>
          <li>The mapping here is this app's, drawn from the section descriptions in the Step 2 draft. For real work use ICH's own mapping of R1 to R2 and the final guideline.</li>
        </ul>
      </section>

      <section className="panel">
        <h3>New in R2: to be written</h3>
        <table className="data">
          <thead><tr><th>R2 section</th><th>What it holds</th><th>Draw on</th></tr></thead>
          <tbody>
            {a.gaps.map((g) => <tr key={g.code}><td>{g.label}</td><td className="small">{g.why}</td><td className="small">{g.sources.length ? g.sources.map(dc).join(', ') : <span className="muted">nothing in this dossier yet</span>}</td></tr>)}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Where each document would go</h3>
        {a.rows.length === 0 ? <p className="muted">No quality documents (2.3 or Module 3) placed yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead><tr><th>R1 heading</th><th>Document</th><th>Action</th><th>R2 Module 2.3</th><th>R2 Module 3</th><th></th></tr></thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={`${r.seq}:${r.leafId}`}>
                    <td className="small">{r.r1}</td>
                    <td>{r.title}<div className="small muted">{r.note}</div></td>
                    <td><span className={`pill ${ACTION[r.action][1]}`}>{ACTION[r.action][0]}</span></td>
                    <td className="small">{r.core.length ? r.core.join('; ') : '—'}</td>
                    <td className="small">{r.data || '—'}</td>
                    <td><button className="btn small" onClick={() => { focusNode(r.nodeCode, r.leafId); setTab('builder'); }}>Show</button></td>
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
