import React, { useRef, useState } from 'react';
import { useApp } from '../ctx.js';
import { go } from '../App.jsx';
import { createProject, PRODUCTS } from '../engine/model.js';
import { db } from '../engine/db.js';
import { exportProject, parseProjectFile, download } from '../engine/io.js';
import { slug } from '../engine/tree.js';
import StatusTable from '../components/StatusTable.jsx';

const MODULES = [
  { m: 1, name: 'Administrative and regional', rows: [['1.1', 'Forms (356h, user fee)'], ['1.2', 'Cover letter'], ['1.14', 'Labeling']] },
  { m: 2, name: 'Summaries', rows: [['2.3', 'Quality Overall Summary'], ['2.5', 'Clinical Overview'], ['2.7', 'Clinical Summary']] },
  { m: 3, name: 'Quality', rows: [['3.2.S', 'Drug substance'], ['3.2.P', 'Drug product'], ['3.2.P.8', 'Stability']] },
  { m: 4, name: 'Nonclinical study reports', rows: [['4.2.1', 'Pharmacology'], ['4.2.2', 'Pharmacokinetics'], ['4.2.3', 'Toxicology']] },
  { m: 5, name: 'Clinical study reports', rows: [['5.2', 'Tabular listing'], ['5.3.1', 'Biopharmaceutics'], ['5.3.5', 'Efficacy and safety']] },
];

function Binder() {
  const [m, setM] = useState(3);
  const mod = MODULES[m - 1];
  return (
    <div className="binder" style={{ borderLeft: `6px solid var(--m${m})` }}>
      {MODULES.map((x, i) => (
        <button key={x.m} className="binder-tab" style={{ top: 14 + i * 50, background: `var(--m${x.m})`, opacity: x.m === m ? 1 : .55 }}
          onClick={() => setM(x.m)} aria-pressed={x.m === m} aria-label={`Module ${x.m}: ${x.name}`}>M{x.m}</button>
      ))}
      <div style={{ minHeight: 236 }}>
        <p className="small muted" style={{ margin: 0 }}>Module {mod.m}</p>
        <h3 style={{ color: `var(--m${m})` }}>{mod.name}</h3>
        {mod.rows.map(([c, t]) => (
          <div className="binder-row" key={c}><b>{c}</b><span>{t}</span></div>
        ))}
        <p className="small muted" style={{ marginTop: '.8rem' }}>
          {m === 1 ? 'Regional: it changes with every agency.' : 'Harmonised under ICH M4: the same in every region.'}
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, projects, attempts, toast, saveProject, reload } = useApp();
  const [name, setName] = useState('');
  const fileRef = useRef();

  const start = async (e) => {
    e.preventDefault();
    const p = createProject({ name: name.trim() || 'Ostrevia NDA practice', user });
    await saveProject(p);
    go(`/project/${p.id}`);
  };
  const onImport = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const p = parseProjectFile(await f.text(), user, new Set(projects.map((x) => x.id)));
      await saveProject(p);
      toast(`Imported "${p.name}".`);
    } catch (err) { toast(err.message, 'error'); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This removes it from this browser. Export it first if you want a copy.`)) return;
    await db.del('projects', p.id); await reload(); toast('Project deleted.');
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>Publish a dossier before you publish a real one.</h1>
          <p className="lede">Assemble a fictional NDA in eCTD v3.2.2: place documents into the CTD tree, build the backbone, run the validator, and manage lifecycle sequences the way a regulatory operations team does.</p>
          <div className="row">
            <a className="btn primary" href="#/learn">Start with lesson 1</a>
            <a className="btn" href="#/missions">Take a mission</a>
          </div>
        </div>
        <Binder />
      </section>

      <div className="section-head"><h2>Your projects</h2>
        <div className="row">
          <button className="btn" onClick={() => fileRef.current?.click()}>Import project file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        </div>
      </div>
      {projects.length === 0 ? (
        <p className="muted">No projects yet. Start a free-build project below, or take mission 1 for a guided first NDA.</p>
      ) : (
        <div className="list">
          {projects.map((p) => {
            const pub = p.sequences.filter((s) => s.status === 'published').length;
            return (
              <div className="list-item" key={p.id}>
                <div>
                  <h3><a href={`#/project/${p.id}`}>{p.name}</a></h3>
                  <span className="small muted">{PRODUCTS[p.productId]?.product.brandName} · {p.region} {p.appType.toUpperCase()} · eCTD {p.ectdVersion} · {p.sequences.length} sequence{p.sequences.length > 1 ? 's' : ''}, {pub} published · updated {new Date(p.updatedAt).toLocaleString()}</span>
                </div>
                <div className="row">
                  <a className="btn small" href={`#/project/${p.id}`}>Open</a>
                  <button className="btn small" onClick={() => download(`${slug(p.name)}.ectd-project.json`, exportProject(p, attempts))}>Export</button>
                  <button className="btn small danger" onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-head"><h2>Start a free-build project</h2></div>
      <form className="panel" onSubmit={start}>
        <div className="grid-2">
          <label className="field">Project name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ostrevia NDA practice" />
          </label>
          <label className="field">Fictional product
            <select defaultValue="nce-tablet">
              <option value="nce-tablet">Ostrevia (lumiravostat) — new chemical entity, IR tablet</option>
              <option disabled>Generic tablet — Phase 2</option>
              <option disabled>Sterile injectable — Phase 2</option>
              <option disabled>Monoclonal antibody, biosimilar — Phase 3</option>
            </select>
          </label>
          <label className="field">Region and application type
            <select defaultValue="US-nda">
              <option value="US-nda">US — NDA</option>
              <option disabled>EU — centralised MAA (Phase 2)</option>
              <option disabled>Japan — NDA, v4.0 (Phase 3)</option>
              <option disabled>India — NDA under NDCT Rules (Phase 3)</option>
            </select>
          </label>
          <label className="field">eCTD version
            <select defaultValue="3.2.2"><option value="3.2.2">v3.2.2</option><option disabled>v4.0 (Phase 3)</option></select>
          </label>
        </div>
        <div className="row" style={{ marginTop: '1rem' }}><button className="btn primary" type="submit">Create project</button></div>
      </form>

      <div className="section-head"><h2>Where eCTD stands in 2026</h2></div>
      <p>The industry is mid-transition: v3.2.2 is still everyday in the US and EU, while Japan has moved to v4.0. This release teaches v3.2.2 with the US pack; later releases add v4.0 and other regions.</p>
      <StatusTable />
    </div>
  );
}
