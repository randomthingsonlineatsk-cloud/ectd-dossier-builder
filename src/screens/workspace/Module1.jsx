import React from 'react';
import usM1 from '../../data/us-m1.json' with { type: 'json' };
import { coverLetterText, docForLeaf, PRODUCTS } from '../../engine/model.js';
import { m1Checklist } from '../../engine/validate.js';
import { addCoverLetter } from '../../engine/ops.js';

const F356 = [
  { k: 'applicantName', label: 'Applicant name', help: 'Legal name of the applicant company as it will appear on the approval letter.' },
  { k: 'applicantAddress', label: 'Applicant address', help: 'Street address; a US agent is needed if the applicant is outside the US.' },
  { k: 'applicationNumber', label: 'Application number', help: 'Assigned before filing; six digits in this app.' },
  { k: 'establishedName', label: 'Established name', help: 'The non-proprietary name (here, the fictional INN).' },
  { k: 'proprietaryName', label: 'Proprietary name', help: 'The proposed brand name, reviewed separately (Module 1.18).' },
  { k: 'dosageForm', label: 'Dosage form', help: 'Must match 3.2.P and the labeling.' },
  { k: 'strengths', label: 'Strengths', help: 'Every strength in the application, matching 3.2.P.1 and the labeling.' },
  { k: 'route', label: 'Route of administration', help: '' },
  { k: 'indication', label: 'Proposed indication', help: 'Same wording as the clinical overview and draft labeling.' },
  { k: 'applicationType', label: 'Application type', help: 'For a new chemical entity with full reports of safety and effectiveness: NDA under 505(b)(1).' },
  { k: 'submissionType', label: 'Submission type', help: 'Original, amendment, resubmission, supplement and so on, matching the regional XML.' },
  { k: 'contact', label: 'Contact person', help: 'Who the agency should call about this submission.' },
];

export default function Module1({ project, seq, mutate, toast, setTab, focusNode }) {
  const s = project.settings;
  const editable = seq.status !== 'published';
  const checklist = m1Checklist(project, seq);
  const p = PRODUCTS[project.productId];
  const form = project.forms?.['fda-356h'] ?? {};

  const setSetting = (path, value) => mutate((x) => {
    const parts = path.split('.'); let o = x.settings;
    while (parts.length > 1) o = o[parts.shift()];
    o[parts[0]] = value;
  }, { quiet: true });
  const setSeq = (k, v) => mutate((x) => { const q = x.sequences.find((y) => y.id === seq.id); q[k] = v; }, { quiet: true });
  const setForm = (k, v) => mutate((x) => { x.forms ??= {}; x.forms['fda-356h'] = { ...(x.forms['fda-356h'] ?? {}), [k]: v }; }, { quiet: true });
  const prefill = () => mutate((x) => {
    x.forms ??= {};
    x.forms['fda-356h'] = {
      applicantName: s.applicant.name, applicantAddress: s.applicant.address, applicationNumber: s.applicationNumber,
      establishedName: p.product.inn, proprietaryName: p.product.brandName, dosageForm: p.product.dosageForm,
      strengths: p.product.strengths.join(', '), route: p.product.route, indication: p.product.indicationText,
      applicationType: 'NDA — 505(b)(1)', submissionType: `${seq.submissionType} / ${seq.subType}`, contact: `${s.applicant.contact}, ${s.applicant.phone}`,
    };
  });

  const present = (item) => seq.leaves.some((l) => l.operation !== 'delete' && l.nodeCode === item.section && (!item.form || docForLeaf(project, l)?.form === item.form));
  const hasCover = seq.leaves.some((l) => l.nodeCode === '1.2');

  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Regional metadata (us-regional.xml)</h2>
        <p className="small muted">These values go into the admin section of the US regional XML for sequence {seq.number}. The validator checks they are complete.</p>
        <div className="grid-2">
          <label className="field">Applicant name<input type="text" value={s.applicant.name} onChange={(e) => setSetting('applicant.name', e.target.value)} /></label>
          <label className="field">D-U-N-S number <small>fictional</small><input type="text" value={s.applicant.duns} onChange={(e) => setSetting('applicant.duns', e.target.value)} /></label>
          <label className="field">Application number <small>six digits, e.g. 299001</small><input type="text" inputMode="numeric" value={s.applicationNumber} onChange={(e) => setSetting('applicationNumber', e.target.value.trim())} /></label>
          <label className="field">Regulatory contact<input type="text" value={s.applicant.contact} onChange={(e) => setSetting('applicant.contact', e.target.value)} /></label>
          <label className="field">Submission type
            <select value={seq.submissionType} disabled={!editable} onChange={(e) => setSeq('submissionType', e.target.value)}>
              {usM1.submissionTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">Submission sub-type
            <select value={seq.subType} disabled={!editable} onChange={(e) => setSeq('subType', e.target.value)}>
              {usM1.submissionSubTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>Submission description
            <input type="text" value={seq.description} disabled={!editable} onChange={(e) => setSeq('description', e.target.value)} placeholder="e.g. Original NDA for Ostrevia tablets" />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Module 1 checklist: NDA, {seq.subType}</h2>
        {checklist.length === 0 ? <p className="muted">No checklist for this sub-type in Phase 1. Original and amendment checklists are available.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Section</th><th>Item</th><th>Level</th><th>In sequence {seq.number}</th><th /></tr></thead>
              <tbody>
                {checklist.map((it, i) => {
                  const ok = present(it);
                  return (
                    <tr key={i}>
                      <td><strong>{it.section}</strong></td>
                      <td>{it.label}</td>
                      <td>{it.level}</td>
                      <td>{ok ? <span className="pill ok">Placed</span> : <span className={`pill ${it.level === 'mandatory' ? 'high' : ''}`}>Missing</span>}</td>
                      <td><button className="btn small" onClick={() => { focusNode(it.section); setTab('builder'); }}>Open in builder</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Cover letter generator</h2>
        <p className="small muted">Pulls the applicant, product, application number, sequence and submission type from the project. Update the metadata above first.</p>
        <pre className="xml" style={{ whiteSpace: 'pre-wrap', maxHeight: 320 }}>{coverLetterText(project, seq)}</pre>
        <div className="row">
          <button className="btn primary" disabled={!editable} onClick={() => { mutate((x) => addCoverLetter(x, seq.number, true)); toast(`Cover letter added to 1.2 in sequence ${seq.number}.`); }}>
            {hasCover ? 'Add another cover letter to 1.2' : 'Add cover letter to 1.2'}
          </button>
          {hasCover && <span className="small muted">A cover letter is already in 1.2. If the metadata changed, remove the old one in the builder and add a fresh one.</span>}
        </div>
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Form FDA 356h practice (fictional)</h2>
          <button className="btn small" onClick={prefill}>Prefill from project</button>
        </div>
        <p className="small muted">A practice version of the key fields, with field-level help. It is not the agency form; the signed PDF in the library is what goes into 1.1. Check that each field agrees with Modules 2 and 3 and the labeling.</p>
        <div className="grid-2">
          {F356.map((f) => (
            <label className="field" key={f.k}>{f.label}{f.help && <small>{f.help}</small>}
              <input type="text" value={form[f.k] ?? ''} onChange={(e) => setForm(f.k, e.target.value)} />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
