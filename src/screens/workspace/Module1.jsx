import React from 'react';
import { REGION_PACKS, displayCode as dc } from '../../engine/tree.js';
import { coverLetterText, coverSection, docForLeaf, PRODUCTS, isRetireOp } from '../../engine/model.js';
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

const EU_STATES = { at: 'Austria', be: 'Belgium', de: 'Germany', dk: 'Denmark', es: 'Spain', fr: 'France', ie: 'Ireland', it: 'Italy', nl: 'Netherlands', pl: 'Poland', pt: 'Portugal', se: 'Sweden' };
const TRACK_HELP = {
  centralised: 'EMEA/H/C/ plus six digits, e.g. EMEA/H/C/006123',
  decentralised: 'RMS code/H/number/product numbers/DC, e.g. NL/H/1234/001-002/DC',
  'mutual-recognition': 'RMS code/H/number/product numbers/MR, e.g. DE/H/0126/001/MR',
  national: 'the national procedure number, or "to be advised"',
  asmf: 'EMEA/ASMF/ or EU/ASMF/ plus five digits, e.g. EMEA/ASMF/01234',
};
const FJP = [
  { k: 'brandName', label: 'Brand name (販売名)', help: 'Must match the submission unit metadata and the package insert draft in 1.8.' },
  { k: 'janName', label: 'Non-proprietary name (JAN)', help: 'The Japanese Accepted Name; this app uses the fictional INN.' },
  { k: 'applicant', label: 'Applicant (marketing authorisation holder)', help: 'The Japanese MAH; a foreign company applies through a designated MAH in Japan.' },
  { k: 'category', label: 'Application category', help: 'e.g. (1) drug with a new active ingredient.' },
  { k: 'composition', label: 'Composition and quantities', help: 'Per unit, matching 3.2.P.1.' },
  { k: 'dosage', label: 'Dosage and administration', help: 'Matches the proposed package insert.' },
  { k: 'indication', label: 'Indications', help: 'Matches 1.8 and 2.5.' },
  { k: 'storage', label: 'Storage method and shelf life', help: 'Matches 3.2.P.8.1.' },
  { k: 'mfgSites', label: 'Manufacturing sites', help: 'Each site needs accreditation as a foreign manufacturer if outside Japan.' },
];
const FIN = [
  { k: 'applicant', label: 'Name of applicant', help: 'The importer or manufacturer in India holding the licence.' },
  { k: 'address', label: 'Address of applicant', help: '' },
  { k: 'drugName', label: 'Name of the new drug', help: 'Generic name and brand name if any.' },
  { k: 'dosageForm', label: 'Dosage form and strengths', help: 'Must match 3.2.P.1.' },
  { k: 'manufacturer', label: 'Manufacturer and site', help: 'For an import application, the overseas manufacturer; registration is checked separately.' },
  { k: 'indication', label: 'Proposed indication', help: '' },
  { k: 'localTrial', label: 'Local clinical trial or waiver', help: 'State whether a local trial was done or a waiver is requested under Rule 101 (countries notified by the regulator).' },
  { k: 'fee', label: 'Fee paid', help: 'Amount from the Sixth Schedule and the payment reference. Figures here are fictional.' },
];

export default function Module1({ project, seq, mutate, toast, setTab, focusNode }) {
  const s = project.settings;
  const eu = project.region === 'EU';
  const pack = REGION_PACKS[project.region];
  const editable = seq.status !== 'published';
  const checklist = m1Checklist(project, seq);
  const p = PRODUCTS[project.productId];
  const region = project.region;
  const jp = region === 'JP';
  const ind = region === 'IN';
  const formKey = { EU: 'eaf', JP: 'jp-form', IN: 'ct-form' }[region] ?? 'fda-356h';
  const fields = { EU: FEAF, JP: FJP, IN: FIN }[region] ?? F356;
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
    x.forms[formKey] = jp ? {
      brandName: s.jp.brandName, janName: s.jp.janName, applicant: s.jp.applicantName, category: '(1) Drug with a new active ingredient',
      composition: p.product.strengths.join(', '), dosage: '[per proposed package insert]', indication: p.product.indicationText, storage: p.facts?.storage ? `${p.facts.storage}; ${p.facts.shelfLife ?? ''}` : '', mfgSites: p.facts?.dpManufacturer ?? '',
    } : ind ? {
      applicant: s.in.agentName || s.applicant.name, address: s.in.agentAddress || s.applicant.address, drugName: `${p.product.inn} (${p.product.brandName})`,
      dosageForm: `${p.product.dosageForm}, ${p.product.strengths.join(', ')}`, manufacturer: p.facts?.dpManufacturer ?? '', indication: p.product.indicationText,
      localTrial: 'Waiver requested under Rule 101 (fictional)', fee: '[amount per Sixth Schedule], payment ref IN-FEE-0001 (fictional)',
    } : eu ? {
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

  const present = (item) => seq.leaves.some((l) => !isRetireOp(l.operation) && l.nodeCode === item.section && (!item.form || docForLeaf(project, l)?.form === item.form));
  const coverCode = coverSection(region);
  const hasCover = seq.leaves.some((l) => l.nodeCode === coverCode);
  const typeLabel = pack.submissionTypes.find((t) => t.value === seq.submissionType)?.label ?? seq.submissionType;
  const subLabel = pack.submissionSubTypes.find((t) => t.value === seq.subType)?.label ?? seq.subType;
  const subHelp = pack.submissionSubTypes.find((t) => t.value === seq.subType)?.help;

  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>{{ EU: 'EU envelope (eu-regional.xml)', JP: 'Submission unit metadata (submissionunit.xml, eCTD v4.0)', IN: 'Application details (CTD for the online portal)', CA: 'Regulatory transaction information (ca-regional.xml)', CH: 'Swiss envelope (ch-regional.xml)' }[region] ?? 'Regional metadata (us-regional.xml)'}</h2>
        <p className="small muted">{ind ? `India takes the CTD as PDF files uploaded to the online portal; there is no backbone XML. These values go into the forms and covering letter for ${seq.number}.` : jp ? `In v4.0 these values sit inside the one submission unit message for unit ${parseInt(seq.number, 10)}. There is no separate regional XML.` : `These values go into the regional XML for sequence ${seq.number}.`} The validator checks they are complete.</p>
        <div className="grid-2">
          <label className="field">Applicant name<input type="text" value={s.applicant.name} onChange={(e) => setSetting('applicant.name', e.target.value)} /></label>
          {region === 'CA' ? (
            <>
              <label className="field">Dossier identifier <small>one lowercase letter and six digits, e.g. e123456; Health Canada assigns it before the first sequence</small><input type="text" value={s.ca.dossierId} onChange={(e) => setSetting('ca.dossierId', e.target.value.trim())} /></label>
              <label className="field">Dossier type
                <select value={s.ca.dossierType} onChange={(e) => setSetting('ca.dossierType', e.target.value)}>{['Pharmaceutical Dossier', 'Biologic Dossier', 'Drug Master File Dossier'].map((x) => <option key={x}>{x}</option>)}</select>
              </label>
              <label className="field">Regulatory activity lead
                <select value={s.ca.activityLead} onChange={(e) => setSetting('ca.activityLead', e.target.value)}>{['Pharmaceutical', 'Biological', 'Post-Market Pharmacovigilance', 'Drug Master File'].map((x) => <option key={x}>{x}</option>)}</select>
              </label>
            </>
          ) : region === 'CH' ? (
            <>
              <label className="field">Application number <small>nine digits without leading zeros, or "pending"</small><input type="text" value={s.ch.applicationNumber} onChange={(e) => setSetting('ch.applicationNumber', e.target.value.trim())} /></label>
              <label className="field">Galenic form folder <small>lowercase EU standard term, e.g. tablets; Module 1 files go in m1/ch/&lt;folder&gt;/</small><input type="text" value={s.ch.galenicFolder} onChange={(e) => setSetting('ch.galenicFolder', e.target.value.trim())} /></label>
              <label className="field">Galenic name <small>in German, French or Italian</small><input type="text" value={s.ch.galenicName} onChange={(e) => setSetting('ch.galenicName', e.target.value)} /></label>
              <label className="field">Language of the galenic name
                <select value={s.ch.galenicLang} onChange={(e) => setSetting('ch.galenicLang', e.target.value)}>{['de', 'fr', 'it'].map((x) => <option key={x}>{x}</option>)}</select>
              </label>
              <label className="field">Article 13 TPA <small>"yes" when the application relies on an authorisation in a country with comparable medicines control</small>
                <select value={s.ch.article13} onChange={(e) => setSetting('ch.article13', e.target.value)}><option value="no">no</option><option value="yes">yes</option></select>
              </label>
            </>
          ) : jp ? (
            <>
              <label className="field">Reception number <small>given by the regulator before the first unit; 10 digits in this app, e.g. 2026000123</small><input type="text" inputMode="numeric" value={s.jp.receptionNumber} onChange={(e) => setSetting('jp.receptionNumber', e.target.value.trim())} /></label>
              <label className="field">Brand name<input type="text" value={s.jp.brandName} onChange={(e) => setSetting('jp.brandName', e.target.value)} /></label>
              <label className="field">JAN (non-proprietary name)<input type="text" value={s.jp.janName} onChange={(e) => setSetting('jp.janName', e.target.value)} /></label>
              <label className="field">Applicant in the submission unit <small>must match the applicant name above</small><input type="text" value={s.jp.applicantName} onChange={(e) => setSetting('jp.applicantName', e.target.value)} /></label>
              <label className="field">Product category
                <select value={s.jp.productCategory} onChange={(e) => setSetting('jp.productCategory', e.target.value)}>
                  <option value="jp_1_1">jp_1_1 — drug with a new active ingredient</option>
                  <option value="jp_1_2">jp_1_2 — new combination drug</option>
                  <option value="jp_1_4">jp_1_4 — new indication</option>
                </select>
              </label>
            </>
          ) : ind ? (
            <>
              <label className="field">Authorised agent in India <small>needed when the applicant is outside India (import applications)</small><input type="text" value={s.in.agentName} onChange={(e) => setSetting('in.agentName', e.target.value)} /></label>
              <label className="field">Agent address<input type="text" value={s.in.agentAddress} onChange={(e) => setSetting('in.agentAddress', e.target.value)} /></label>
              <label className="field">Regulatory contact<input type="text" value={s.applicant.contact} onChange={(e) => setSetting('applicant.contact', e.target.value)} /></label>
            </>
          ) : eu ? (
            <>
              <label className="field">{seq.submissionType === 'asmf' ? 'ASMF number' : 'Procedure tracking number'} <small>{TRACK_HELP[seq.submissionType === 'asmf' ? 'asmf' : s.eu.procedureType] ?? ''}</small><input type="text" value={s.eu.trackingNumber} onChange={(e) => setSetting('eu.trackingNumber', e.target.value.trim())} /></label>
              {s.eu.procedureType !== 'centralised' && seq.submissionType !== 'asmf' && (
                <>
                  <label className="field">{s.eu.procedureType === 'national' ? 'Member state' : 'Reference member state (RMS)'}
                    <select value={s.eu.rms ?? ''} onChange={(e) => setSetting('eu.rms', e.target.value)}>
                      <option value="">Choose…</option>
                      {Object.keys(EU_STATES).map((c) => <option key={c} value={c}>{EU_STATES[c]} ({c})</option>)}
                    </select>
                  </label>
                  {s.eu.procedureType !== 'national' && (
                    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend>Concerned member states (CMS) <small>one envelope each</small></legend>
                      <div className="row" style={{ flexWrap: 'wrap', gap: '.2rem .8rem' }}>
                        {Object.keys(EU_STATES).filter((c) => c !== s.eu.rms).map((c) => (
                          <label key={c} className="small row" style={{ gap: '.3rem' }}><input type="checkbox" checked={(s.eu.cms ?? []).includes(c)} onChange={(e) => setSetting('eu.cms', e.target.checked ? [...(s.eu.cms ?? []), c] : (s.eu.cms ?? []).filter((x) => x !== c))} />{EU_STATES[c]}</label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </>
              )}
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
          <label className="field">{eu || jp ? 'Submission unit type' : 'Submission sub-type'} {subHelp && <small>{subHelp}</small>}
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
            <input type="text" value={seq.description} disabled={!editable} onChange={(e) => setSeq('description', e.target.value)} placeholder={jp ? 'e.g. Initial application (CTD)' : ind ? 'e.g. Application to import Ostrevia tablets' : eu ? 'e.g. Initial MAA for Ostrevia' : 'e.g. Original NDA for Ostrevia tablets'} />
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
        <p className="small muted">Pulls the applicant, product, {{ EU: 'procedure number', JP: 'reception number', IN: 'agent details', CA: 'dossier identifier', CH: 'application number' }[region] ?? 'application number'}, sequence and submission type from the project. Update the metadata above first.{jp ? ' In Japan the cover (鑑) is filed as m1/jp/cover.pdf and is not referenced in the submission unit XML.' : ''}</p>
        <pre className="xml" style={{ whiteSpace: 'pre-wrap', maxHeight: 320 }}>{coverLetterText(project, seq)}</pre>
        <div className="row">
          <button className="btn primary" disabled={!editable} onClick={() => { mutate((x) => addCoverLetter(x, seq.number, true)); toast(`Cover letter added to ${dc(coverCode)} in sequence ${seq.number}.`); }}>
            {hasCover ? `Add another cover letter to ${dc(coverCode)}` : `Add cover letter to ${dc(coverCode)}`}
          </button>
          {hasCover && <span className="small muted">A cover letter is already placed. If the metadata changed, remove the old one in the builder and add a fresh one.</span>}
        </div>
      </section>

      {!['CA', 'CH'].includes(region) && <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>{{ EU: 'Electronic application form practice (fictional)', JP: 'Japanese application form practice (fictional)', IN: `Form ${seq.submissionType === 'clinical-trial' ? 'CT-04' : seq.submissionType === 'new-drug-manufacture' ? 'CT-21' : 'CT-18'} practice (fictional)` }[region] ?? 'Form FDA 356h practice (fictional)'}</h2>
          <button className="btn small" onClick={prefill}>Prefill from project</button>
        </div>
        <p className="small muted">A practice version of key fields, with field-level help. It is not the official form; the form in the library is what goes into {{ EU: '1.2', JP: '1.2', IN: '1.2.2' }[region] ?? '1.1'}. Check that each field agrees with Modules 2 and 3 and the product information.</p>
        <div className="grid-2">
          {fields.map((f) => (
            <label className="field" key={f.k}>{f.label}{f.help && <small>{f.help}</small>}
              <input type="text" value={form[f.k] ?? ''} onChange={(e) => setForm(f.k, e.target.value)} />
            </label>
          ))}
        </div>
      </section>}
    </div>
  );
}
