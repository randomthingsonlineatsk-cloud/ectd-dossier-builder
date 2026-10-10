import React from 'react';
import { PRODUCTS } from '../../engine/model.js';
import { repeatFolder, slug } from '../../engine/tree.js';
import { exportProject, download } from '../../engine/io.js';

export default function SettingsView({ project, mutate, attempts }) {
  const s = project.settings;
  const p = PRODUCTS[project.productId];
  const set = (path, value) => mutate((x) => {
    const parts = path.split('.'); let o = x;
    while (parts.length > 1) o = o[parts.shift()];
    o[parts[0]] = value;
  }, { quiet: true });

  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Project</h2>
        <div className="grid-2">
          <label className="field">Project name<input type="text" value={project.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="field">Product<input type="text" value={`${p.product.brandName} (${p.product.inn}) ${p.product.dosageForm}, ${p.product.strengths.join(', ')}`} disabled /></label>
          <label className="field">Region and type<input type="text" value={`${project.region} — ${project.appType.toUpperCase()}`} disabled /></label>
          <label className="field">eCTD version<input type="text" value={project.ectdVersion} disabled /></label>
          <label className="field">Applicant (fictional)<input type="text" value={s.applicant.name} onChange={(e) => set('settings.applicant.name', e.target.value)} /></label>
          <label className="field">Applicant address<input type="text" value={s.applicant.address} onChange={(e) => set('settings.applicant.address', e.target.value)} /></label>
        </div>
        <label className="row small" style={{ marginTop: '1rem' }}>
          <input type="checkbox" checked={!!s.expertMode} onChange={(e) => set('settings.expertMode', e.target.checked)} />
          Expert mode: the operation picker lists every earlier leaf, including invalid targets, and placement warnings are off.
        </label>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Repeatable sections</h2>
        <p className="small muted">These attributes identify each repeated section in the backbone and name its folder. This product has one drug substance from one manufacturer and one drug product in two strengths.</p>
        <div className="grid-2">
          <label className="field">3.2.S substance<input type="text" value={s.substance.name} onChange={(e) => set('settings.substance.name', e.target.value)} /></label>
          <label className="field">3.2.S manufacturer<input type="text" value={s.substance.manufacturer} onChange={(e) => set('settings.substance.manufacturer', e.target.value)} /></label>
          <label className="field">3.2.P product name<input type="text" value={s.product.name} onChange={(e) => set('settings.product.name', e.target.value)} /></label>
          <label className="field">3.2.P dosage form<input type="text" value={s.product.dosageForm} onChange={(e) => set('settings.product.dosageForm', e.target.value)} /></label>
          <label className="field">3.2.P manufacturer<input type="text" value={s.product.manufacturer} onChange={(e) => set('settings.product.manufacturer', e.target.value)} /></label>
          <label className="field">2.7.3 and 5.3.5 indication<input type="text" value={s.indication} onChange={(e) => set('settings.indication', e.target.value)} /></label>
        </div>
        <p className="small" style={{ marginTop: '.75rem' }}>Folders: <code>32s-drug-sub/{repeatFolder('substance', s)}</code>, <code>32p-drug-prod/{repeatFolder('product', s)}</code>, <code>535-rep-effic-safety-stud/{repeatFolder('indication', s)}</code></p>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>Save and share</h2>
        <p className="small">Your work is saved in this browser automatically. Export a project file to back it up, move it to another device or send it to a mentor; they can import it from the start page.</p>
        <button className="btn primary" onClick={() => download(`${slug(project.name)}.ectd-project.json`, exportProject(project, attempts))}>Export project file</button>
        <p className="small muted" style={{ marginTop: '.75rem' }}>Owner ID {project.userId ?? '—'}; class {project.classId ?? 'none'}. Class IDs are used by classroom mode in a later release.</p>
      </section>
    </div>
  );
}
