import React, { useState } from 'react';
import rulesData from '../../data/rules.json' with { type: 'json' };
import { RULES, profileLabel } from '../../engine/validate.js';
import { displayCode as dc } from '../../engine/tree.js';
import { download } from '../../engine/io.js';
import { slug } from '../../engine/tree.js';

export default function ValidateView({ project, seq, validation, focusNode, setTab, onRerun }) {
  const [sev, setSev] = useState('All');
  const [showRules, setShowRules] = useState(false);
  const list = validation.findings.filter((f) => sev === 'All' || f.severity === sev);
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Validation report: sequence {seq.number}</h2>
          <span className="small muted">Profile: {profileLabel(project)} · {rulesData.rules.length} core rules · runs live as you edit</span>
        </div>
        <div className="row">
          <button className="btn" onClick={onRerun}>Run validation again</button>
          <button className="btn" onClick={async () => download(`${slug(project.name)}-${seq.number}-validation.pdf`, await (await import('../../engine/report.js')).validationPdf(project, seq, validation), 'application/pdf')}>Download report (PDF)</button>
          <button className="btn" onClick={async () => download(`${slug(project.name)}-${seq.number}-validation.csv`, await (await import('../../engine/report.js')).validationCsv(project, seq, validation), 'text/csv')}>Download CSV</button>
        </div>
      </div>
      <p className={`verdict ${validation.verdict.level}`} role="status">{validation.verdict.text}</p>
      <div className="row">
        <div className="seg" role="group" aria-label="Filter by severity">
          {['All', 'High', 'Medium', 'Low'].map((s) => (
            <button key={s} aria-pressed={sev === s} onClick={() => setSev(s)}>{s}{s !== 'All' ? ` (${validation.counts[s]})` : ` (${validation.findings.length})`}</button>
          ))}
        </div>
      </div>
      <div className="findings">
        {list.map((f) => (
          <article key={f.key} className={`finding ${f.severity}`}>
            <span className={`pill ${f.severity.toLowerCase()}`}>{f.severity}</span>
            <div>
              <h4>{f.ruleId} · {f.title}</h4>
              <p className="small" style={{ margin: '0 0 .3rem' }}>{f.message}</p>
              <p className="small muted" style={{ margin: 0 }}>{RULES[f.ruleId].explain} <strong>Fix:</strong> {RULES[f.ruleId].fix}</p>
            </div>
            {f.nodeCode && <button className="btn small" onClick={() => { focusNode(f.nodeCode, f.leafId); setTab(['BB-06', 'EU-11'].includes(f.ruleId) ? 'm1' : f.ruleId === 'EU-12' ? 'sequences' : f.ruleId === 'BB-07' ? 'settings' : 'builder'); }}>Go to {['BB-06', 'EU-11', 'EU-12'].includes(f.ruleId) ? 'metadata' : f.ruleId === 'BB-07' ? 'settings' : dc(f.nodeCode)}</button>}
          </article>
        ))}
        {!list.length && <p className="muted">No findings{sev !== 'All' ? ` at ${sev} severity` : ''}.</p>}
      </div>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Rule library</h3>
          <button className="btn small" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}>{showRules ? 'Hide rules' : 'Browse all rules'}</button>
        </div>
        <p className="small muted" style={{ marginTop: '.4rem' }}>{rulesData._about}</p>
        {showRules && (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>ID</th><th>Family</th><th>Severity</th><th>Rule</th><th>Why it matters</th></tr></thead>
              <tbody>{rulesData.rules.map((r) => <tr key={r.id}><td><strong>{r.id}</strong></td><td>{r.family}</td><td><span className={`pill ${r.severity.toLowerCase()}`}>{r.severity}</span></td><td>{r.title}</td><td>{r.explain}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
