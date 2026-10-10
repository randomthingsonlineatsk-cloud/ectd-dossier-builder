import React, { useMemo, useState } from 'react';
import { INDEX, isPlaceable, displayCode as dc } from '../../engine/tree.js';
import { docForLeaf, lifecycleState, sortedSequences } from '../../engine/model.js';
import { updateLeaf, fixDoc } from '../../engine/ops.js';
import { bookmarkTitles, defaultHeadings } from '../../engine/pdfmeta.js';
import { suggestedStudy, needsStudyTag, STUDY_ID_RE } from '../../engine/stf.js';
import PdfPreview from '../../components/PdfPreview.jsx';
import { modColor } from '../../ctx.js';

const TOC_PAGES = 50;

// Leaf-title consistency checks across the current view, with one-click fixes where safe.
function titleIssues(project, seq) {
  const issues = [];
  const st = lifecycleState(project, seq.number);
  const cur = [...st.entries.values()].filter((e) => e.status === 'current' && e.leaf.operation !== 'delete');
  const mine = new Set(seq.leaves.map((l) => l.id));
  const byNode = {};
  for (const e of cur) (byNode[e.leaf.nodeCode] ??= []).push(e);
  for (const [code, list] of Object.entries(byNode)) {
    const seen = {};
    for (const e of list) {
      const k = e.leaf.title.trim().toLowerCase();
      if (k && seen[k]) issues.push({ leaf: e.leaf, seq: e.seq, kind: 'Duplicate title in the same heading', detail: `"${e.leaf.title}" appears twice in ${dc(code)}; reviewers cannot tell the documents apart.` });
      seen[k] = true;
    }
  }
  for (const e of cur) {
    const l = e.leaf; const t = l.title;
    const doc = docForLeaf(project, l);
    const editable = mine.has(l.id) && seq.status !== 'published';
    const base = { leaf: l, seq: e.seq, editable };
    if (t !== t.trim() || /\s{2,}/.test(t)) issues.push({ ...base, kind: 'Stray spaces', detail: `"${t}" has leading, trailing or double spaces.`, fix: { label: 'Tidy spaces', title: t.trim().replace(/\s{2,}/g, ' ') } });
    if (t.length > 8 && t === t.toUpperCase() && /[A-Z]/.test(t)) issues.push({ ...base, kind: 'All capitals', detail: `"${t}" is in capitals; titles are easier to scan in sentence or title case.` });
    if (/\b(final|v\d+|rev\s?\d+|version\s?\d+|tmp|old)\b|_v\d/i.test(t)) issues.push({ ...base, kind: 'Working-file wording', detail: `"${t}" contains working-file words such as final or a version number. Lifecycle tracks versions; titles should not.` });
    if (t.length > 150) issues.push({ ...base, kind: 'Very long title', detail: `${t.length} characters; long titles are cut off in review tools.` });
    if (doc && !doc.generated && t.trim() && t.trim() !== doc.title && !/\.pdf$/i.test(t)) issues.push({ ...base, kind: 'Differs from the document', detail: `Leaf title "${t}" does not match the document's own title "${doc.title}".`, fix: { label: 'Use the document title', title: doc.title } });
    if (doc && needsStudyTag(l.nodeCode)) {
      const sid = suggestedStudy(doc);
      if (sid && STUDY_ID_RE.test(sid) && !t.includes(sid)) issues.push({ ...base, kind: 'Study ID missing from title', detail: `Study reports are easier to find when the title starts with the study ID (${sid}).`, fix: { label: `Prefix ${sid}`, title: `Study ${sid}: ${t.replace(/^Study [^:]+:\s*/, '')}` } });
    }
    if (l.target && (l.operation === 'replace' || l.operation === 'append')) {
      const tgt = st.entries.get(`${l.target.seq}:${l.target.leafId}`);
      if (tgt && tgt.leaf.title.trim() !== t.trim()) issues.push({ ...base, kind: 'Title changed across lifecycle', detail: `This ${l.operation}s "${tgt.leaf.title}" (sequence ${l.target.seq}) but uses a different title. Keep titles stable so reviewers recognise the document.`, fix: { label: 'Use the earlier title', title: tgt.leaf.title } });
    }
  }
  return issues;
}

export default function Publishing({ project, seq, mutate, validation, toast, focusNode, setTab }) {
  const [selId, setSelId] = useState(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [newBm, setNewBm] = useState('');
  const [allMarks, setAllMarks] = useState(false);
  const editable = seq.status !== 'published';

  const leaves = seq.leaves.filter((l) => l.operation !== 'delete');
  const st = useMemo(() => lifecycleState(project, seq.number), [project, seq.number]);
  const currentCodes = useMemo(() => new Set([...st.entries.values()].filter((e) => e.status === 'current').map((e) => e.leaf.nodeCode)), [st]);
  const placedCodes = [...currentCodes].sort((a, b) => INDEX.order.indexOf(a) - INDEX.order.indexOf(b));
  const issues = useMemo(() => titleIssues(project, seq), [project, seq]);

  const docIssues = (l) => {
    const d = docForLeaf(project, l);
    if (!d) return [];
    const out = [];
    if (d.pages >= 5 && !d.bookmarks) out.push('no bookmarks');
    if (d.pages >= TOC_PAGES && !d.toc) out.push('no table of contents');
    if (d.brokenLinks || (d.links ?? []).some((c) => !currentCodes.has(c))) out.push('broken links');
    return out;
  };
  const broken = leaves.filter((l) => docIssues(l).includes('broken links'));
  const list = leaves
    .filter((l) => !onlyIssues || docIssues(l).length)
    .sort((a, b) => INDEX.order.indexOf(a.nodeCode) - INDEX.order.indexOf(b.nodeCode));
  const leaf = leaves.find((l) => l.id === selId) ?? null;
  const doc = leaf ? docForLeaf(project, leaf) : null;
  const marks = doc ? bookmarkTitles(doc) : [];

  const editDoc = (fn) => mutate((p) => { const d = p.documents[doc.id]; fn(d); d.bookmarks = d.bookmarkList ? d.bookmarkList.length : d.bookmarks; });
  const setMarks = (listNext) => editDoc((d) => { d.bookmarkList = listNext; });

  return (
    <div className="builder" style={{ gridTemplateColumns: 'minmax(260px, .9fr) minmax(320px, 1.6fr)' }}>
      <section className="col" aria-label="Documents in this sequence">
        <div className="col-head"><h2>Documents in {seq.number}</h2><span className="small muted">{leaves.length}</span></div>
        <div className="col-body">
          <label className="small row" style={{ marginBottom: '.5rem' }}><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Only documents with publishing issues</label>
          {list.map((l) => {
            const is = docIssues(l);
            return (
              <button key={l.id} className={`doc ${selId === l.id ? 'picked' : ''}`} style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => { setSelId(l.id); setShowPdf(false); }}>
                <span className="bar" style={{ background: modColor(l.nodeCode) }} />
                <span><span className="dt" style={{ display: 'block' }}>{l.title || '(no title)'}</span><span className="ds">{dc(l.nodeCode)}{is.length ? ` · ${is.join(', ')}` : ''}</span></span>
                <span />
              </button>
            );
          })}
          {!list.length && <p className="muted small">{leaves.length ? 'No publishing issues in this sequence.' : 'Place documents in the builder first.'}</p>}
        </div>
      </section>

      <div className="stack">
        {!leaf && (
          <section className="panel">
            <h2 style={{ fontSize: 'var(--step-1)' }}>Document-level publishing</h2>
            <p>Pick a document to edit its bookmarks, table of contents and hyperlinks, and to open the generated PDF. The checks below run across the whole sequence.</p>
          </section>
        )}
        {leaf && doc && (
          <section className="panel">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>{leaf.title || '(no title)'}</h2>
                <span className="small muted">{dc(leaf.nodeCode)} · {leaf.fileName} · {doc.pages} pages</span>
              </div>
              <div className="row">
                <button className="btn small" aria-expanded={showPdf} onClick={() => setShowPdf(!showPdf)}>{showPdf ? 'Hide PDF' : 'Show PDF'}</button>
                <button className="btn small" onClick={() => { focusNode(leaf.nodeCode, leaf.id); setTab('builder'); }}>Open in builder</button>
              </div>
            </div>
            {!editable && <p className="callout small" style={{ marginTop: '.6rem' }}>Sequence {seq.number} is published. These files are frozen.</p>}
            {doc.generated && <p className="small muted">Generated cover letters have no bookmarks or links to manage.</p>}
            {showPdf && <div style={{ marginTop: '.75rem' }}><PdfPreview project={project} seqNumber={seq.number} leaf={leaf} inline /></div>}

            <h3 style={{ marginTop: '1rem' }}>Bookmarks</h3>
            <p className="small muted">Documents of 5 pages or more need bookmarks. The first level should follow the document's own headings.</p>
            {marks.length === 0 && <p className="small">This document has no bookmarks.</p>}
            <ol className="small" style={{ paddingLeft: '1.3rem' }}>
              {marks.slice(0, allMarks ? marks.length : 12).map((m, i) => (
                <li key={i} style={{ marginBottom: '.3rem' }}>
                  <span className="row" style={{ gap: '.3rem' }}>
                    <input type="text" aria-label={`Bookmark ${i + 1}`} value={m} disabled={!editable} style={{ flex: 1, minWidth: 160 }}
                      onChange={(e) => setMarks(marks.map((x, j) => (j === i ? e.target.value : x)))} />
                    <button className="btn small ghost" disabled={!editable || i === 0} aria-label="Move up" onClick={() => { const n = [...marks]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setMarks(n); }}>↑</button>
                    <button className="btn small ghost" disabled={!editable || i === marks.length - 1} aria-label="Move down" onClick={() => { const n = [...marks]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setMarks(n); }}>↓</button>
                    <button className="btn small ghost" disabled={!editable} aria-label="Remove bookmark" onClick={() => setMarks(marks.filter((_, j) => j !== i))}>✕</button>
                  </span>
                </li>
              ))}
            </ol>
            {marks.length > 12 && <button className="btn small ghost" aria-expanded={allMarks} onClick={() => setAllMarks(!allMarks)}>{allMarks ? 'Show fewer' : `Show all ${marks.length} bookmarks`}</button>}
            {editable && (
              <div className="row">
                <input type="text" placeholder="New bookmark title" value={newBm} onChange={(e) => setNewBm(e.target.value)} style={{ maxWidth: 260 }} aria-label="New bookmark title" />
                <button className="btn small" disabled={!newBm.trim()} onClick={() => { setMarks([...marks, newBm.trim()]); setNewBm(''); }}>Add bookmark</button>
                <button className="btn small" onClick={() => { editDoc((d) => { d.bookmarks = Math.max(2, Math.round(d.pages / 6)); d.bookmarkList = defaultHeadings(d); }); toast('Bookmarks rebuilt from the document headings.'); }}>Auto-bookmark from headings</button>
              </div>
            )}

            <h3 style={{ marginTop: '1rem' }}>Table of contents</h3>
            <label className="row small">
              <input type="checkbox" checked={!!doc.toc} disabled={!editable} onChange={(e) => editDoc((d) => { d.toc = e.target.checked; })} />
              Generate a linked table of contents page from the bookmarks
            </label>
            {doc.pages >= TOC_PAGES && !doc.toc && <p className="small" style={{ color: 'var(--medium)' }}>Recommended: this document has {doc.pages} pages.</p>}

            <h3 style={{ marginTop: '1rem' }}>Hyperlinks</h3>
            <p className="small muted">Cross-document links are relative file links. They resolve only when the target document is in the current view.</p>
            <table className="data">
              <thead><tr><th>Links to</th><th>Status</th><th /></tr></thead>
              <tbody>
                {(doc.links ?? []).map((c) => (
                  <tr key={c}>
                    <td><strong>{dc(c)}</strong> {INDEX.map[c]?.title}</td>
                    <td>{currentCodes.has(c) ? <span className="pill ok">Resolves</span> : <span className="pill high">Broken: no document</span>}</td>
                    <td>{editable && <button className="btn small ghost" onClick={() => editDoc((d) => { d.links = d.links.filter((x) => x !== c); })}>Remove link</button>}</td>
                  </tr>
                ))}
                {doc.brokenLinks > 0 && (
                  <tr>
                    <td>{doc.brokenLinks} link{doc.brokenLinks > 1 ? 's' : ''} to moved appendices</td>
                    <td><span className="pill high">Broken: file not found</span></td>
                    <td>{editable && <button className="btn small ghost" onClick={() => mutate((p) => fixDoc(p, doc.id, 'links'))}>Repair</button>}</td>
                  </tr>
                )}
                {!(doc.links ?? []).length && !doc.brokenLinks && <tr><td colSpan={3} className="muted">No hyperlinks.</td></tr>}
              </tbody>
            </table>
            {editable && (
              <div className="row" style={{ marginTop: '.5rem' }}>
                <select value={newLink} onChange={(e) => setNewLink(e.target.value)} style={{ maxWidth: 360 }} aria-label="Link target">
                  <option value="">Add a link to…</option>
                  {placedCodes.filter((c) => c !== leaf.nodeCode && isPlaceable(c) && !(doc.links ?? []).includes(c)).map((c) => <option key={c} value={c}>{dc(c)} {INDEX.map[c]?.title}</option>)}
                </select>
                <button className="btn small" disabled={!newLink} onClick={() => { editDoc((d) => { d.links = [...(d.links ?? []), newLink]; }); setNewLink(''); }}>Add link</button>
              </div>
            )}
          </section>
        )}

        <section className="panel">
          <h2 style={{ fontSize: 'var(--step-1)' }}>Broken-link finder</h2>
          {broken.length === 0 ? <p className="small"><span className="pill ok">No broken links</span> in sequence {seq.number}.</p> : (
            <ul className="small" style={{ paddingLeft: '1.1rem' }}>
              {broken.map((l) => {
                const d = docForLeaf(project, l);
                const missing = (d.links ?? []).filter((c) => !currentCodes.has(c));
                return (
                  <li key={l.id} style={{ marginBottom: '.3rem' }}>
                    <button className="btn ghost small" style={{ padding: 0 }} onClick={() => setSelId(l.id)}><strong>{l.title || l.fileName}</strong></button>{' '}
                    ({dc(l.nodeCode)}): {[d.brokenLinks ? `${d.brokenLinks} to moved files` : null, missing.length ? `to ${missing.join(', ')} with no document` : null].filter(Boolean).join('; ')}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2 style={{ fontSize: 'var(--step-1)' }}>Leaf title consistency</h2>
          <p className="small muted">Checks titles across the current view: duplicates, wording, study IDs, and titles that drift across lifecycle. These are quality checks, not validation rules.</p>
          {issues.length === 0 ? <p className="small"><span className="pill ok">Titles are consistent</span></p> : (
            <div className="findings">
              {issues.map((it, i) => (
                <article key={i} className="finding Low">
                  <span className="pill low">{it.kind}</span>
                  <div><h4 style={{ fontSize: 'var(--step--1)' }}>{dc(it.leaf.nodeCode)} · {it.leaf.title || '(no title)'} <span className="muted">({it.seq})</span></h4><p className="small" style={{ margin: 0 }}>{it.detail}</p></div>
                  {it.fix && it.editable ? <button className="btn small" onClick={() => mutate((p) => updateLeaf(p, seq.number, it.leaf.id, { title: it.fix.title }))}>{it.fix.label}</button> : <span />}
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="small muted">File names and PDF settings are checked by the validator ({validation.findings.filter((f) => f.family === 'Files and folders' || f.family === 'PDF').length} open findings in this sequence).</p>
      </div>
    </div>
  );
}
