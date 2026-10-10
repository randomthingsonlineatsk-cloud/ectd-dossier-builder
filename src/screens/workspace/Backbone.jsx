import React, { useMemo, useState } from 'react';
import { publishSequence } from '../../engine/backbone.js';
import { INDEX } from '../../engine/tree.js';
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
    if (['admin', 'title'].includes(el.tagName)) return null;
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

export default function Backbone({ project, seq }) {
  const pkg = useMemo(() => publishSequence(project, seq.number), [project, seq.number]);
  const [view, setView] = useState('index');
  const views = [
    ['index', 'index.xml'], ['regional', 'us-regional.xml'], ['md5', 'index-md5.txt'], ['rendered', 'Rendered view'], ['folders', 'Folder tree'], ['log', 'Publishing log'],
  ];
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="tablist" aria-label="Backbone files">
          {views.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <div className="row">
          <button className="btn small" onClick={() => download(`${seq.number}-index.xml`, pkg.index, 'application/xml')}>Download index.xml</button>
          <button className="btn small" onClick={() => download(`${seq.number}-us-regional.xml`, pkg.regional, 'application/xml')}>Download us-regional.xml</button>
        </div>
      </div>
      <p className="small muted">
        {seq.status === 'published' ? `Sequence ${seq.number} is published; this is its frozen backbone.` : `Live preview of sequence ${seq.number}. It updates as you place documents; checksums are fixed when you publish.`}
        {' '}Modelled on the public ICH v3.2.2 and FDA Module 1 structures. Training only.
      </p>
      {view === 'index' && <Xml text={pkg.index} />}
      {view === 'regional' && <Xml text={pkg.regional} />}
      {view === 'md5' && (
        <div className="panel">
          <p className="small">index-md5.txt holds the MD5 checksum of index.xml, so the agency can confirm the backbone arrived intact.</p>
          <pre className="xml">{pkg.md5txt}</pre>
        </div>
      )}
      {view === 'rendered' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div><h3>As a reviewer's viewer shows it</h3><Rendered xml={pkg.index} rootTag="ectd:ectd" /><h3 style={{ marginTop: '1rem' }}>Module 1 (regional)</h3><Rendered xml={pkg.regional} rootTag="fda-regional:fda-regional" /></div>
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
