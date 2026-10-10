import React from 'react';
import { REGION_PACKS, displayCode as dc } from '../../engine/tree.js';
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
  { k: 'applicationType', label: 'Application type', help: 'NDA under 505(b)(1) for a new chemical entity; ANDA under 505(j) for a generic.' },
  { k: 'submissionType', label: 'Submission type', help: 'Matches the regional XML: original application, supplement, annual report…' },
  { k: 'contact', label: 'Contact person', help: 'Who the agency should call about this submission.' },
];
const FEAF = [
  { k: 'procedure', label: 'Procedure', help: 'Centralised procedure, mandatory scope or optional scope.' },
  { k: 'legalBasis', label: 'Legal basis', help: 'For a new active substance with full data: Article 8(3) of Directive 2001/83/EC.' },
  { k: 'inventedName', label: 'Invented name', help: 'Must match the SmPC and the envelope.' },
  { k: 'inn', label: 'Active substance (INN)', help: '' },
  { k: 'pharmaceuticalForm', label: 'Pharmaceutical form (EDQM standard term)', help: 'e.g. film-coated tablet.' },
  { k: 'strengths', label: 'Strengths', help: 'Must match 3.2.P.1 and the product information.' },
  { k: 'applicant', label: 'Applicant (MAH)', help: 'Must be established in the EEA; a non-EEA company needs an EEA entity as MAH.' },
  { k: 'qppv', label: 'QPPV', help: 'The qualified person responsible for pharmacovigilance, resident in the EEA.' },
  { k: 'batchRelease', label: 'Batch release site', help: 'Site in the EEA responsible for batch release.' },
  { k: 'dpManufacturer', label: 'Finished product manufacturer(s)', help: 'Must match 3.2.P.3.1 and the GMP certificates in the annexes.' },
  { k: 'orphan', label: 'Orphan designation', help: 'If any, with the designation number.' },
  { k: 'paediatric', label: 'Paediatric requirements', help: 'PIP decision number and compliance status.' },
];

export default function Module1({ project, seq, mutate, toast, setTab, focusNode }) {
  const s = project.settings;
  const eu = project.region === 'EU';
  const pack = REGION_PACKS[project.region];
  const editable = seq.status !== 'published';
  const checklist = m1Checklist(project, seq);
  const p = PRODUCTS[project.productId];
  const formKey = eu ? 'eaf' : 'fda-356h';
  const fields = eu ? FEAF : F356;
  const form = project.forms?.[formKey] ?? {};

  const setSetting = (path, value) => mutate((x) => {
    const parts = path.split('.'); let o = x.settings;
    while (parts.length > 1) o = o[parts.shift()];
    o[parts[0]] = value;
  }, { quiet: true });
  const setSeq = (k, v) => mutate((x) => { const q = x.sequences.find((y) => y.id === seq.id); q[k] = v; }, { quiet: true });
  const setForm = (k, v) => mutate((x) => { x.forms ??= {}; x.forms[formKey] = { ...(x.forms[formKey] ?? {}), [k]: v }; }, { quiet: true });
  const prefill = () => mutate((x) => {
    x.forms ??= {};
    x.forms[formKey] = eu ? {
      procedure: 'Centralised procedure (mandatory scope: new active substance)', legalBasis: 'Article 8(3) of Directive 2001/83/EC (full application)',
      inventedName: s.eu.inventedName, inn: s.eu.inn, pharmaceuticalForm: p.product.dosageForm, strengths: p.product.strengths.join(', '),
      applicant: s.applicant.name, qppv: '[QPPV name], [EEA address]', batchRelease: '[EEA batch release site]', dpManufacturer: p.facts?.dpManufacturer ?? '',
      orphan: 'None', paediatric: 'PIP decision P/0000/2026 (fictional); compliance check completed',
    } : {
      applicantName: s.applicant.name, applicantAddress: s.applicant.address, applicationNumber: s.applicationNumber,
      establishedName: p.product.inn, proprietaryName: p.product.brandName, dosageForm: p.product.dosageForm,
      strengths: p.product.strengths.join(', '), route: p.product.route, indication: p.product.indicationText,
      applicationType: project.appType === 'anda' ? 'ANDA — 505(j)' : 'NDA — 505(b)(1)', submissionType: `${seq.submissionType} / ${seq.subType}`, contact: `${s.applicant.contact}, ${s.applicant.phone}`,
    };
  });

  const present = (item) => seq.leaves.some((l) => l.operation !== 'delete' && l.nodeCode === item.section && (!item.form || docForLeaf(project, l)?.form === item.form));
  const coverCode = eu ? 'eu:1.0' : '1.2';
  const hasCover = seq.leaves.some((l) => l.nodeCode === coverCode);
  const typeLabel = pack.submissionTypes.find((t) => t.value === seq.submissionType)?.label ?? seq.submissionType;
  const subLabel = pack.submissionSubTypes.find((t) => t.value === seq.subType)?.label ?? seq.subType;
  const subHelp = pack.submissionSubTypes.find((t) => t.value === seq.subType)?.help;

  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>{eu ? 'EU envelope (eu-regional.xml)' : 'Regional metadata (us-regional.xml)'}</h2>
        <p className="small muted">These values go into the regional XML for sequence {seq.number}. The validator checks they are complete.</p>
        <div className="grid-2">
          <label className="field">Applicant name<input type="text" value={s.applicant.name} onChange={(e) => setSetting('applicant.name', e.target.value)} /></label>
          {eu ? (
            <>
              <label className="field">Procedure tracking number <small>EMEA/H/C/ plus six digits, e.g. EMEA/H/C/006123</small><input type="text" value={s.eu.trackingNumber} onChange={(e) => setSetting('eu.trackingNumber', e.target.value.trim())} /></label>
              <label className="field">Procedure type
                <select value={s.eu.procedureType} onChange={(e) => setSetting('eu.procedureType', e.target.value)}>
                  {pack.procedureTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="field">Envelope identifier (UUID) <small>the same for every sequence of this application</small><input type="text" value={s.eu.uuid} readOnly /></label>
              <label className="field">Invented name<input type="text" value={s.eu.inventedName} onChange={(e) => setSetting('eu.inventedName', e.target.value)} /></label>
              <label className="field">INN<input type="text" value={s.eu.inn} onChange={(e) => setSetting('eu.inn', e.target.value)} /></label>
            </>
          ) : (
            <>
              <label className="field">D-U-N-S number <small>fictional</small><input type="text" value={s.applicant.duns} onChange={(e) => setSetting('applicant.duns', e.target.value)} /></label>
              <label className="field">Application number <small>six digits, e.g. 299001</small><input type="text" inputMode="numeric" value={s.applicationNumber} onChange={(e) => setSetting('applicationNumber', e.target.value.trim())} /></label>
              <label className="field">Regulatory contact<input type="text" value={s.applicant.contact} onChange={(e) => setSetting('applicant.contact', e.target.value)} /></label>
            </>
          )}
          <label className="field">Submission type
            <select value={seq.submissionType} disabled={!editable} onChange={(e) => setSeq('submissionType', e.target.value)}>
              {pack.submissionTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">{eu ? 'Submission unit type' : 'Submission sub-type'} {subHelp && <small>{subHelp}</small>}
            <select value={seq.subType} disabled={!editable} onChange={(e) => setSeq('subType', e.target.value)}>
              {pack.submissionSubTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          {eu && (
            <label className="field">Related sequence <small>the sequence that started this procedure; empty for initial and reformat</small>
              <select value={seq.relatedSequence ?? ''} disabled={!editable} onChange={(e) => setSeq('relatedSequence', e.target.value)}>
                <option value="">None</option>
                {project.sequences.filter((x) => x.number < seq.number).map((x) => <option key={x.id} value={x.number}>{x.number} ({x.submissionType} / {x.subType})</option>)}
              </select>
            </label>
          )}
          <label className="field" style={{ gridColumn: '1 / -1' }}>Submission description
            <input type="text" value={seq.description} disabled={!editable} onChange={(e) => setSeq('description', e.target.value)} placeholder={eu ? 'e.g. Initial MAA for Ostrevia' : 'e.g. Original NDA for Ostrevia tablets'} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Module 1 checklist: {project.appType.toUpperCase()}, {typeLabel}, {subLabel}</h2>
        {checklist.length === 0 ? <p className="muted">There is no Module 1 checklist for this combination in this release. Checklists cover original applications, the response and amendment sequences, US supplements and periodic reports, and EU variations.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Section</th><th>Item</th><th>Level</th><th>In sequence {seq.number}</th><th /></tr></thead>
              <tbody>
                {checklist.map((it, i) => {
                  const ok = present(it);
                  return (
                    <tr key={i}>
                      <td><strong>{dc(it.section)}</strong></td>
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
        <p className="small muted">Pulls the applicant, product, {eu ? 'procedure number' : 'application number'}, sequence and submission type from the project. Update the metadata above first.</p>
        <pre className="xml" style={{ whiteSpace: 'pre-wrap', maxHeight: 320 }}>{coverLetterText(project, seq)}</pre>
        <div className="row">
          <button className="btn primary" disabled={!editable} onClick={() => { mutate((x) => addCoverLetter(x, seq.number, true)); toast(`Cover letter added to ${dc(coverCode)} in sequence ${seq.number}.`); }}>
            {hasCover ? `Add another cover letter to ${dc(coverCode)}` : `Add cover letter to ${dc(coverCode)}`}
          </button>
          {hasCover && <span className="small muted">A cover letter is already placed. If the metadata changed, remove the old one in the builder and add a fresh one.</span>}
        </div>
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>{eu ? 'Electronic application form practice (fictional)' : 'Form FDA 356h practice (fictional)'}</h2>
          <button className="btn small" onClick={prefill}>Prefill from project</button>
        </div>
        <p className="small muted">A practice version of key fields, with field-level help. It is not the agency form; the form in the library is what goes into {eu ? '1.2' : '1.1'}. Check that each field agrees with Modules 2 and 3 and the product information.</p>
        <div className="grid-2">
          {fields.map((f) => (
            <label className="field" key={f.k}>{f.label}{f.help && <small>{f.help}</small>}
              <input type="text" value={form[f.k] ?? ''} onChange={(e) => setForm(f.k, e.target.value)} />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
