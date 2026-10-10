import React, { useMemo, useState } from 'react';
import { publishSequence } from '../../engine/backbone.js';
import { INDEX, REGION_PACKS, nodeLabel, displayCode } from '../../engine/tree.js';
import { couCode, seqInt } from '../../engine/v4.js';
import { download } from '../../engine/io.js';
import { modColor } from '../../ctx.js';

const ELEMENT_TITLE = {
  ...Object.fromEntries(Object.values(INDEX.map).filter((n) => n.element).map((n) => [n.element, `${n.code} ${n.title}`])),
  'm1-administrative-information-and-prescribing-information': '1 Administrative Information (points to the regional XML)',
};

function highlight(xml) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Single pass over comments, tags and attributes so inserted markup is never re-matched.
  return xml.replace(/(<!--[\s\S]*?-->)|(<\/?)([\w:.-]+)|([\w:.-]+)=("[^"]*")|([^<]+?(?=<|[\w:.-]+="|$)|[\s\S])/g,
    (m, cm, open, tag, attr, val) => {
      if (cm) return `<span class="cm">${esc(cm)}</span>`;
      if (open) return `${esc(open)}<span class="tag">${esc(tag)}</span>`;
      if (attr) return `<span class="attr">${esc(attr)}</span>=<span class="val">${esc(val)}</span>`;
      return esc(m);
    });
}

function Xml({ text }) {
  return <pre className="xml" tabIndex={0} dangerouslySetInnerHTML={{ __html: highlight(text) }} />;
}

// Renders a backbone the way a reviewer's viewer would: headings and leaf titles, no XML.
function Rendered({ xml, rootTag }) {
  const tree = useMemo(() => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) return { error: err.textContent };
    const root = doc.getElementsByTagName(rootTag)[0];
    return { root };
  }, [xml, rootTag]);
  if (tree.error) return <p className="callout bad">The XML is not well-formed: {tree.error}</p>;
  const walk = (el, depth = 0) => {
    const kids = [...el.children];
    if (el.tagName === 'leaf') {
      return (
        <li key={el.getAttribute('ID')} className="rendered-leaf">
          <span className={`op ${el.getAttribute('operation')}`}>{el.getAttribute('operation')}</span>
          <span>{el.querySelector('title')?.textContent || '(no title)'}</span>
          {el.getAttribute('modified-file') && <span className="small muted">→ {el.getAttribute('modified-file').replace(/^.*?(\d{4})\/.*#/, '$1 #')}</span>}
        </li>
      );
    }
    if (['admin', 'title', 'eu-envelope'].includes(el.tagName)) return null;
    const label = ELEMENT_TITLE[el.tagName] ?? el.tagName;
    const attrs = ['substance', 'manufacturer', 'product-name', 'dosageform', 'indication', 'form-type'].map((a) => el.getAttribute(a)).filter(Boolean);
    const body = kids.map((k) => walk(k, depth + 1)).filter(Boolean);
    if (depth === 0) return <ul style={{ listStyle: 'none', paddingLeft: 0 }}>{body}</ul>;
    return (
      <li key={label + depth + attrs.join()} className="rendered-node" style={depth === 1 ? { borderLeft: `4px solid ${modColor(String(parseInt(label, 10)))}`, paddingLeft: '.5rem', margin: '.5rem 0' } : undefined}>
        <span className="h">{label}{attrs.length ? <span className="muted"> [{attrs.join(' · ')}]</span> : null}</span>
        {body.length > 0 && <ul>{body}</ul>}
      </li>
    );
  };
  return <div className="panel" style={{ maxHeight: '70vh', overflow: 'auto' }}>{walk(tree.root)}</div>;
}

function FolderTree({ node }) {
  const kids = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <li>
      <span>📁 {node.name}/</span>
      <ul>
        {kids.map((k) => <FolderTree key={k.name} node={k} />)}
        {node.files.map((f, i) => <li key={f.name + i}>{f.kind === 'pdf' ? '📄' : '🧾'} {f.name}{f.op && f.op !== 'new' ? <span className="muted"> ({f.op})</span> : ''}</li>)}
      </ul>
    </li>
  );
}

// eCTD v4.0: one submission unit message, contexts of use, SHA-256, document reuse.
function V4View({ project, seq, pkg }) {
  const [view, setView] = useState('xml');
  const n = seqInt(seq.number);
  const unit = pkg.unit;
  const byNode = {};
  for (const l of seq.leaves) (byNode[l.nodeCode] ??= []).push(l);
  const views = [['xml', 'submissionunit.xml'], ['sha', 'sha256.txt'], ['cou', 'Contexts of use'], ['files', `Files (${unit.reused} reused)`], ['folders', 'Folder tree'], ['log', 'Publishing log']];
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="tablist" aria-label="Submission unit files">
          {views.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <button className="btn small" onClick={() => download(`${n}-submissionunit.xml`, unit.xml, 'application/xml')}>Download submissionunit.xml</button>
      </div>
      <p className="small muted">
        {seq.status === 'published' ? `Unit ${n} is published; this is its frozen message.` : `Live preview of submission unit ${n}. Until you publish, checksums are preview hashes; publishing generates each PDF and records the SHA-256 of its real bytes.`}
        {' '}eCTD v4.0 has one XML message per unit (no index.xml, no regional XML), numbers units 1, 2, 3…, places each document by a context of use, and reuses documents already sent by reference. Modelled on the ICH and PMDA v4.0 implementation guides, simplified. Training only.
      </p>
      {view === 'xml' && <Xml text={unit.xml} />}
      {view === 'sha' && <div className="panel"><p className="small">sha256.txt lists the SHA-256 checksum of submissionunit.xml and of every file sent in this unit. Reused documents are not sent again, so they are not listed.</p><pre className="xml">{unit.shaTxt}</pre></div>}
      {view === 'cou' && (
        <div className="table-wrap panel">
          <table className="data">
            <thead><tr><th>Heading</th><th>CoU code</th><th>Document</th><th>Status</th><th>Lifecycle</th></tr></thead>
            <tbody>{Object.entries(byNode).sort(([a], [b]) => INDEX.order.indexOf(a) - INDEX.order.indexOf(b)).flatMap(([code, ls]) => ls.map((l) => {
              const f = unit.files.find((x) => x.leafId === l.id);
              return (
                <tr key={l.id}>
                  <td>{nodeLabel(code)}</td>
                  <td className="mono">{code === 'jp:cover' ? '(not in XML)' : couCode(code)}</td>
                  <td>{l.title || '(no title)'}{f?.op === 'reuse' && <span className="pill ok" style={{ marginLeft: '.3rem' }}>reused</span>}</td>
                  <td>{l.operation === 'suspend' ? <span className="op suspend">suspended</span> : 'active'}</td>
                  <td className="small">{l.operation === 'replace' ? `replacementOf ${seqInt(l.target?.seq ?? '0')} · ${displayCode(code)}` : l.operation === 'suspend' ? `suspends CoU from unit ${seqInt(l.target?.seq ?? '0')}` : l.operation}</td>
                </tr>
              );
            }))}</tbody>
          </table>
        </div>
      )}
      {view === 'files' && (
        <div className="table-wrap panel">
          <p className="small">A document already sent in an earlier unit is placed again by its document ID. No file is sent and no checksum is listed.</p>
          <table className="data">
            <thead><tr><th>File</th><th>SHA-256</th><th>Heading</th><th>How</th></tr></thead>
            <tbody>{unit.files.map((f, i) => <tr key={i}><td className="mono" style={{ wordBreak: 'break-all' }}>{f.path}</td><td className="mono" style={{ wordBreak: 'break-all', fontSize: '.72rem' }}>{f.sha256}</td><td>{displayCode(f.node)}</td><td>{f.op}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {view === 'folders' && <div className="panel ftree"><ul><FolderTree node={pkg.tree} /></ul></div>}
      {view === 'log' && <Log pkg={pkg} label="SHA-256 checksum" />}
    </div>
  );
}

// India: the CTD goes to the online portal as PDF uploads with no backbone XML.
function PortalView({ project, seq, pkg }) {
  const [view, setView] = useState('list');
  return (
    <div className="stack">
      <div className="seg" role="tablist" aria-label="Portal upload">
        {[['list', `Upload list (${pkg.log.length})`], ['folders', 'Folder tree']].map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
      <p className="small muted">India takes the CTD as PDF files uploaded to the regulator's online portal, arranged by the CTD headings. There is no backbone XML, so lifecycle is handled by uploading revised files with the query response and listing them in the covering letter. Training only; the portal itself is not reproduced.</p>
      {view === 'list' && (
        <div className="table-wrap panel">
          <table className="data">
            <thead><tr><th>Heading</th><th>File</th><th>MD5 (for your records)</th></tr></thead>
            <tbody>{pkg.log.map((r, i) => <tr key={i}><td>{nodeLabel(r.node)}</td><td className="mono" style={{ wordBreak: 'break-all' }}>{r.file}</td><td className="mono">{r.checksum}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {view === 'folders' && <div className="panel ftree"><ul><FolderTree node={pkg.tree} /></ul></div>}
    </div>
  );
}

function Log({ pkg, label = 'MD5 checksum' }) {
  return (
    <div className="table-wrap panel">
      <table className="data">
        <thead><tr><th>File</th><th>{label}</th><th>Operation</th><th>Target</th><th>Heading</th></tr></thead>
        <tbody>{pkg.log.map((r, i) => <tr key={i}><td className="mono" style={{ wordBreak: 'break-all' }}>{r.file}</td><td className="mono" style={{ wordBreak: 'break-all' }}>{r.checksum}</td><td>{r.operation}</td><td className="mono">{r.target}</td><td>{displayCode(r.node)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function Backbone({ project, seq, toast }) {
  const pkg = useMemo(() => publishSequence(project, seq.number), [project, seq.number]);
  return (
    <>
      <ZipBar project={project} seq={seq} toast={toast} />
      {pkg.v4 ? <V4View project={project} seq={seq} pkg={pkg} /> : pkg.portal ? <PortalView project={project} seq={seq} pkg={pkg} /> : <V3View project={project} seq={seq} pkg={pkg} />}
    </>
  );
}

// Zipped folder export: this sequence, or every published one.
function ZipBar({ project, seq, toast }) {
  const [busy, setBusy] = useState(null);
  const unit = project.ectdVersion === '4.0' ? `unit ${parseInt(seq.number, 10)}` : `sequence ${seq.number}`;
  const published = project.sequences.filter((s) => s.status === 'published').length;
  const go = async (which) => {
    setBusy('Preparing…');
    try {
      const { dossierZip } = await import('../../engine/zipexport.js');
      const r = await dossierZip(project, { sequences: which === 'one' ? [seq.number] : null, onProgress: (i, n, num) => setBusy(`Building ${i} of ${n} (${num})…`) });
      download(r.name, r.zip, 'application/zip');
      toast?.(r.notes.length ? `Zip ready with ${r.count} files. ${r.notes.length} checksum note${r.notes.length > 1 ? 's' : ''} in the README.` : `Zip ready with ${r.count} files; every checksum matches.`);
    } catch (e) { toast?.(`Could not build the zip: ${e.message}`, 'error'); } finally { setBusy(null); }
  };
  return (
    <div className="row zipbar" style={{ justifyContent: 'flex-end', marginBottom: '.75rem' }}>
      <span className="small muted">Zipped folder with the {project.ectdVersion === '4.0' ? 'submission unit' : project.region === 'IN' ? 'portal files' : 'backbone'} and watermarked stub PDFs. Training only.</span>
      <button className="btn small" disabled={!!busy} onClick={() => go('one')}>{busy ?? `Download ${unit} as zip`}</button>
      {published > 1 && <button className="btn small" disabled={!!busy} onClick={() => go('all')}>All {published} published as one zip</button>}
    </div>
  );
}

function V3View({ project, seq, pkg }) {
  const [view, setView] = useState('index');
  const regionalName = REGION_PACKS[project.region].regionalFile.split('/').pop();
  const [stfId, setStfId] = useState(null);
  const views = [
    ['index', 'index.xml'], ['regional', regionalName], ['md5', 'index-md5.txt'], ['stf', `Study tagging files (${pkg.stfs.length})`], ['rendered', 'Rendered view'], ['folders', 'Folder tree'], ['log', 'Publishing log'],
  ];
  const stf = pkg.stfs.find((f) => f.id === stfId) ?? pkg.stfs[0];
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="tablist" aria-label="Backbone files">
          {views.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <div className="row">
          <button className="btn small" onClick={() => download(`${seq.number}-index.xml`, pkg.index, 'application/xml')}>Download index.xml</button>
          <button className="btn small" onClick={() => download(`${seq.number}-${regionalName}`, pkg.regional, 'application/xml')}>Download {regionalName}</button>
        </div>
      </div>
      <p className="small muted">
        {seq.status === 'published' ? `Sequence ${seq.number} is published; this is its frozen backbone.` : `Live preview of sequence ${seq.number}. It updates as you place documents. Until you publish, PDF checksums are preview hashes; publishing generates each PDF and records the MD5 of its real bytes.`}
        {' '}Modelled on the public ICH v3.2.2 and {project.region === 'EU' ? 'EU' : 'FDA'} Module 1 structures. Training only.
      </p>
      {view === 'index' && <Xml text={pkg.index} />}
      {view === 'regional' && <Xml text={pkg.regional} />}
      {view === 'md5' && (
        <div className="panel">
          <p className="small">index-md5.txt holds the MD5 checksum of index.xml, so the agency can confirm the backbone arrived intact.</p>
          <pre className="xml">{pkg.md5txt}</pre>
        </div>
      )}
      {view === 'stf' && (pkg.stfs.length === 0 ? <p className="muted">No study tagging files yet. Tag the study documents in Modules 4 and 5 in the builder.</p> : (
        <div className="stack">
          <label className="field" style={{ maxWidth: 520 }}>Study tagging file
            <select value={stf.id} onChange={(e) => setStfId(e.target.value)}>
              {pkg.stfs.map((f) => <option key={f.id} value={f.id}>{f.studyId} — {f.nodeCode} ({f.leafIds.length} file{f.leafIds.length > 1 ? 's' : ''})</option>)}
            </select>
          </label>
          <p className="small muted">Path: <span className="mono">{seq.number}/{stf.path}</span>. The STF names the study and points to each of its files in index.xml with a file tag.</p>
          <Xml text={stf.xml} />
        </div>
      ))}
      {view === 'rendered' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div><h3>As a reviewer's viewer shows it</h3><Rendered xml={pkg.index} rootTag="ectd:ectd" /><h3 style={{ marginTop: '1rem' }}>Module 1 (regional)</h3><Rendered xml={pkg.regional} rootTag={project.region === 'EU' ? 'eu:eu-backbone' : 'fda-regional:fda-regional'} /></div>
          <div><h3>Raw index.xml</h3><Xml text={pkg.index} /></div>
        </div>
      )}
      {view === 'folders' && <div className="panel ftree"><ul><FolderTree node={pkg.tree} /></ul></div>}
      {view === 'log' && (
        <div className="table-wrap panel">
          <table className="data">
            <thead><tr><th>File</th><th>MD5 checksum</th><th>Operation</th><th>Target</th><th>Heading</th></tr></thead>
            <tbody>{pkg.log.map((r, i) => <tr key={i}><td className="mono" style={{ wordBreak: 'break-all' }}>{r.file}</td><td className="mono">{r.checksum}</td><td>{r.operation}</td><td className="mono">{r.target}</td><td>{r.node}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
