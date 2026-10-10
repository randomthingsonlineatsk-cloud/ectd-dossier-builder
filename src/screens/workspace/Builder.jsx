import React, { useEffect, useMemo, useState } from 'react';
import { INDEX, isPlaceable, ancestors, nodeOf, filePath, rootsFor, displayCode as dc, M1_ROOT } from '../../engine/tree.js';
import { docForLeaf, lifecycleState, nodeStatus, sortedSequences } from '../../engine/model.js';
import { requiredFor, m1Checklist } from '../../engine/validate.js';
import { placeDoc, moveLeaf, removeLeaf, updateLeaf, fixDoc, addDeleteLeaf, PDF_FIXES } from '../../engine/ops.js';
import { modColor } from '../../ctx.js';
import OperationPicker from './OperationPicker.jsx';
import PdfPreview from '../../components/PdfPreview.jsx';
import { FILE_TAGS, needsStudyTag, moduleOf, tagFromDoc, DEFAULT_TAG } from '../../engine/stf.js';
import rulesData from '../../data/rules.json' with { type: 'json' };

const DND = 'application/x-ectd';

function priorInfo(project, seq) {
  const seqs = sortedSequences(project);
  const i = seqs.findIndex((s) => s.id === seq.id);
  const prev = i > 0 ? seqs[i - 1] : null;
  return { isFirst: i === 0, prevState: prev ? lifecycleState(project, prev.number) : { entries: new Map(), byNode: {} } };
}

export default function Builder({ project, seq, mutate, validation, toast, guided, selectedCode, setSelectedCode, focusLeaf }) {
  const [selLeaf, setSelLeaf] = useState(null);
  const [picked, setPicked] = useState(null); // { kind: 'doc'|'leaf', id }
  const [view, setView] = useState('tree');
  const [expanded, setExpanded] = useState(() => new Set([M1_ROOT[project.region] ?? '1', '2', '3', '3.2', '3.2.P', '5', '5.3']));
  const roots = rootsFor(project.region);
  const [overCode, setOverCode] = useState(null);
  const [picker, setPicker] = useState(null);
  const [preview, setPreview] = useState(null);
  const [q, setQ] = useState('');
  const [unplacedOnly, setUnplacedOnly] = useState(false);

  // Open the tree down to a heading selected from elsewhere (validation report, Module 1 checklist).
  useEffect(() => {
    if (!selectedCode) return;
    setExpanded((s) => { const n = new Set(s); for (const a of ancestors(selectedCode)) n.add(a.code); return n; });
  }, [selectedCode]);
  useEffect(() => { if (focusLeaf) setSelLeaf(focusLeaf.id); }, [focusLeaf]);

  const editable = seq.status !== 'published';
  const expert = !!project.settings.expertMode;
  const { isFirst, prevState } = useMemo(() => priorInfo(project, seq), [project, seq]);
  // Required headings: Modules 2-5 for the application type plus the mandatory Module 1 items.
  const required = useMemo(() => new Set([...requiredFor(project, seq), ...m1Checklist(project, seq).filter((i) => i.level === 'mandatory').map((i) => i.section)]), [project, seq]);
  const status = useMemo(() => nodeStatus(project, seq.number, required), [project, seq.number, required]);
  const counts = useMemo(() => {
    const c = {};
    for (const l of seq.leaves) for (const a of ancestors(l.nodeCode)) c[a.code] = (c[a.code] ?? 0) + 1;
    return c;
  }, [seq]);
  const flagged = useMemo(() => {
    const f = new Set();
    for (const x of validation.findings) if (x.nodeCode && x.severity !== 'Low') for (const a of ancestors(x.nodeCode)) f.add(a.code);
    return f;
  }, [validation]);
  const usedDocs = useMemo(() => {
    const u = new Set();
    const st = lifecycleState(project, seq.number);
    for (const e of st.entries.values()) if (e.status === 'current' && e.leaf.docId) u.add(e.leaf.docId);
    return u;
  }, [project, seq.number]);

  const warnFit = (doc, code) => {
    if (!doc) return;
    if (doc.decoy) { toast(`Granularity coach: ${doc.coach}`, 'warn'); return; }
    if (!expert && doc.section && doc.section !== code) toast(`"${doc.title}" is a ${dc(doc.section)} document, but you placed it in ${dc(code)}. The validator will flag this.`, 'warn');
  };

  const placeInto = (code, item = picked) => {
    if (!item) return;
    if (!editable) { toast(`Sequence ${seq.number} is published and frozen. Create a new sequence to make changes.`, 'error'); return; }
    if (!isPlaceable(code)) { toast(`${dc(code)} has sub-headings. Open it and drop on the lowest-level heading.`, 'warn'); return; }
    if (item.kind === 'leaf') {
      mutate((p) => moveLeaf(p, seq.number, item.id, code));
      setPicked(null); setSelectedCode(code);
      const l = seq.leaves.find((x) => x.id === item.id);
      warnFit(l && docForLeaf(project, l), code);
      return;
    }
    const doc = project.documents[item.id];
    const prior = (prevState.byNode[code] ?? []).filter((e) => e.status === 'current');
    if (!isFirst && (prior.length || expert)) {
      setPicker({ code, docId: item.id });
      return;
    }
    let leafId;
    mutate((p) => { leafId = placeDoc(p, seq.number, item.id, code).id; });
    setPicked(null); setSelectedCode(code); setSelLeaf(leafId);
    warnFit(doc, code);
  };

  const onPickerConfirm = ({ operation, target }) => {
    const { code, docId } = picker;
    let leafId;
    mutate((p) => { leafId = placeDoc(p, seq.number, docId, code, operation, target).id; });
    setPicker(null); setPicked(null); setSelectedCode(code); setSelLeaf(leafId);
    warnFit(project.documents[docId], code);
  };

  const onDrop = (e, code) => {
    e.preventDefault(); setOverCode(null);
    const raw = e.dataTransfer.getData(DND);
    if (!raw) return;
    placeInto(code, JSON.parse(raw));
  };
  const dragProps = (item) => ({
    draggable: editable,
    onDragStart: (e) => { e.dataTransfer.setData(DND, JSON.stringify(item)); e.dataTransfer.effectAllowed = 'move'; },
  });
  const dropProps = (code) => (isPlaceable(code) ? {
    onDragOver: (e) => { if (e.dataTransfer.types.includes(DND)) { e.preventDefault(); setOverCode(code); } },
    onDragLeave: () => setOverCode((c) => (c === code ? null : c)),
    onDrop: (e) => onDrop(e, code),
  } : {});

  const toggle = (code) => setExpanded((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });

  const renderNode = (code, depth = 0) => {
    const n = INDEX.map[code];
    const hasKids = n.children.length > 0;
    const open = expanded.has(code);
    const st = status[code];
    const sel = selectedCode === code;
    const node = (
      <div
        className={`tnode ${sel ? 'sel' : ''} ${overCode === code ? 'drop' : ''} ${n.notInEctd ? 'na' : ''}`}
        role="treeitem" aria-selected={sel} aria-expanded={hasKids ? open : undefined} tabIndex={0}
        onClick={() => { setSelectedCode(code); if (hasKids && !open) toggle(code); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (picked && isPlaceable(code)) placeInto(code); else { setSelectedCode(code); if (hasKids) toggle(code); } }
          if (e.key === 'ArrowRight' && hasKids && !open) toggle(code);
          if (e.key === 'ArrowLeft' && hasKids && open) toggle(code);
        }}
        {...dropProps(code)}
      >
        {hasKids ? <button className="twist" tabIndex={-1} aria-hidden="true" onClick={(e) => { e.stopPropagation(); toggle(code); }}>{open ? '▾' : '▸'}</button> : <span className="twist" />}
        {!hasKids && <span className={`dot ${st}`} title={st} aria-label={st} />}
        <span className="code">{dc(code)}</span>
        <span className="t" title={n.title}>{n.title}</span>
        {flagged.has(code) && <span className="flag" title="Has validation findings" aria-label="has findings">!</span>}
        {counts[code] ? <span className="n" aria-label={`${counts[code]} leaves in this sequence`}>{counts[code]}</span> : null}
        {picked && isPlaceable(code) && sel && editable && <button className="btn small primary" onClick={(e) => { e.stopPropagation(); placeInto(code); }}>Place here</button>}
      </div>
    );
    const wrap = depth === 0 ? { className: 'mod-root', style: { '--mod': modColor(code) } } : {};
    return (
      <li key={code} {...wrap} role="none">
        {node}
        {hasKids && open && <ul role="group">{n.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  // Middle column
  const node = selectedCode ? nodeOf(selectedCode) : null;
  const priorHere = selectedCode ? (prevState.byNode[selectedCode] ?? []).filter((e) => e.status === 'current' && e.leaf.operation !== 'delete') : [];
  const leavesHere = selectedCode ? seq.leaves.filter((l) => l.nodeCode === selectedCode) : [];
  const leaf = selLeaf ? seq.leaves.find((l) => l.id === selLeaf) : null;
  const leafDoc = leaf ? docForLeaf(project, leaf) : null;
  const leafFindings = leaf ? validation.findings.filter((f) => f.leafId === leaf.id) : [];
  const nodeFindings = selectedCode ? validation.findings.filter((f) => f.nodeCode === selectedCode && !f.leafId) : [];

  // Library
  const docs = Object.values(project.documents)
    .filter((d) => !d.irOnly || project.mission?.id === 4)
    .filter((d) => (d.title + ' ' + d.section + ' ' + d.fileName).toLowerCase().includes(q.toLowerCase()))
    .filter((d) => !unplacedOnly || !usedDocs.has(d.id))
    .sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }));

  const allCodes = INDEX.order.filter((c) => INDEX.map[c].children.length === 0);

  return (
    <div className="builder">
      {/* Tree or map */}
      <section className="col" aria-label="CTD structure">
        <div className="col-head">
          <h2>{view === 'tree' ? 'CTD tree' : 'Dossier map'}</h2>
          <div className="seg" role="group" aria-label="View">
            <button aria-pressed={view === 'tree'} onClick={() => setView('tree')}>Tree</button>
            <button aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
          </div>
        </div>
        <div className="col-body">
          {picked && <p className="callout small" style={{ margin: '0 0 .5rem' }}>Holding <strong>{picked.kind === 'doc' ? project.documents[picked.id]?.title : 'a leaf'}</strong>. Select a heading and press Enter (or "Place here") to place it. <button className="btn small ghost" onClick={() => setPicked(null)}>Cancel</button></p>}
          {view === 'tree' ? (
            <>
              <div className="map-legend" style={{ margin: '.2rem .3rem .6rem' }}>
                <span><span className="dot filled" /> filled</span><span><span className="dot required" /> required</span><span><span className="dot optional" /> optional</span><span><span className="dot na" /> not used in eCTD</span>
              </div>
              <ul className="tree" role="tree" aria-label="CTD headings">{roots.map((c) => renderNode(c))}</ul>
            </>
          ) : (
            <div className="map">
              {roots.map((r) => {
                const codes = allCodes.filter((c) => INDEX.map[c].module === INDEX.map[r].module && ancestors(c)[0].code === r);
                const filled = codes.filter((c) => status[c] === 'filled').length;
                const req = codes.filter((c) => required.has(c));
                return (
                  <div key={r} className="map-mod" style={{ '--mod': modColor(r) }}>
                    <h3>Module {dc(r)} · {filled} of {codes.length} headings filled</h3>
                    <div className="map-cells">
                      {codes.map((c) => (
                        <button key={c} className={`map-cell ${status[c]}`} title={`${dc(c)} ${INDEX.map[c].title} (${status[c]})`}
                          onClick={() => { setSelectedCode(c); setView('tree'); setExpanded((s) => new Set([...s, ...ancestors(c).map((a) => a.code)])); }}
                          {...dropProps(c)}>
                          {dc(c)}
                        </button>
                      ))}
                    </div>
                    {req.length === 0 && !INDEX.map[r].isM1 && <p className="small muted">No required headings for this submission type.</p>}
                  </div>
                );
              })}
              <div className="map-legend"><span>Solid colour: filled</span><span>Red outline: required and empty</span><span>Dashed: optional</span><span>Faded: not used in eCTD</span></div>
            </div>
          )}
        </div>
      </section>

      {/* Node detail */}
      <section className="col sticky-col" aria-label="Heading detail">
        <div className="col-head"><h2>{node ? `${dc(node.code)} ${node.title}` : 'Select a heading'}</h2>
          {node && <span className={`pill ${status[node.code] === 'filled' ? 'ok' : status[node.code] === 'required' ? 'high' : ''}`}>{node.children.length ? 'section' : status[node.code]}</span>}
        </div>
        <div className="col-body">
          {!node && <p className="muted">Pick a heading in the tree to see its documents, or drag a document from the library onto a heading.</p>}
          {node && (
            <>
              {node.note && <p className="callout warn small">{node.note}</p>}
              {node.help && <p className="small muted">{node.help}</p>}
              {node.children.length > 0 && <p className="small muted">This heading has sub-headings. Documents go on the lowest level.</p>}
              {editable && project.region === 'US' && ['4', '5'].includes(node.module) && (() => {
                const untagged = seq.leaves.filter((l) => needsStudyTag(l.nodeCode) && l.operation !== 'delete' && !l.study?.id && tagFromDoc(project, l));
                return untagged.length > 0 && (
                  <p className="callout small">{untagged.length} study document{untagged.length > 1 ? 's' : ''} in Modules 4 and 5 {untagged.length > 1 ? 'have' : 'has'} no study tagging yet.{' '}
                    <button className="btn small" onClick={() => mutate((p) => { for (const l of p.sequences.find((x) => x.id === seq.id).leaves) if (needsStudyTag(l.nodeCode) && !l.study?.id) { const t = tagFromDoc(p, l); if (t) l.study = t; } })}>Tag studies from documents</button>
                  </p>
                );
              })()}
              {nodeFindings.map((f) => <p key={f.key} className={`callout small ${f.severity === 'High' ? 'bad' : 'warn'}`}><strong>{f.ruleId}</strong> {f.message}</p>)}
              {priorHere.length > 0 && <h3 className="small muted" style={{ marginTop: '.5rem' }}>Current from earlier sequences</h3>}
              {priorHere.map((e) => {
                const isReplacedNow = seq.leaves.some((l) => l.target?.leafId === e.leaf.id);
                return (
                  <div key={e.key} className="leaf-card prior">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="lt">{e.leaf.title || '(no title)'}</span>
                      <span className="pill">seq {e.seq}</span>
                    </div>
                    <div className="fn">{e.leaf.fileName}</div>
                    {isReplacedNow && <p className="small muted" style={{ margin: '.3rem 0 0' }}>Acted on in this sequence.</p>}
                    {editable && !isFirst && !isReplacedNow && (
                      <div className="row" style={{ marginTop: '.4rem' }}>
                        <button className="btn small" onClick={() => mutate((p) => addDeleteLeaf(p, seq.number, { seq: e.seq, leafId: e.leaf.id, nodeCode: e.leaf.nodeCode, title: e.leaf.title }))}>Delete in {seq.number}</button>
                        <span className="small muted">To replace it, drop the new version on this heading.</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {leavesHere.length > 0 && <h3 className="small muted" style={{ marginTop: '.5rem' }}>In sequence {seq.number}</h3>}
              {leavesHere.map((l) => {
                const d = docForLeaf(project, l);
                const fs = validation.findings.filter((f) => f.leafId === l.id);
                return (
                  <div key={l.id} className={`leaf-card ${selLeaf === l.id ? 'sel' : ''}`} {...(editable ? dragProps({ kind: 'leaf', id: l.id }) : {})}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <button className="btn ghost small" style={{ padding: 0, textAlign: 'left' }} onClick={() => setSelLeaf(l.id)}><span className="lt">{l.title || '(no title)'}</span></button>
                      <span className="row"><span className={`op ${l.operation}`}>{l.operation}</span>{fs.length > 0 && <span className={`pill ${fs[0].severity.toLowerCase()}`}>{fs.length} finding{fs.length > 1 ? 's' : ''}</span>}</span>
                    </div>
                    <div className="fn">{l.operation === 'delete' ? `deletes ${l.target?.seq}/${l.target?.leafId}` : filePath(l.nodeCode, l.fileName, project.settings)}</div>
                    {l.target && l.operation !== 'delete' && <div className="small muted">{l.operation}s {l.target.seq} · {l.target.leafId}</div>}
                    {d?.note && <div className="small muted">{d.note}</div>}
                  </div>
                );
              })}
              {isPlaceable(node.code) && editable && (
                <div className={`dropzone ${overCode === node.code ? 'over' : ''}`} {...dropProps(node.code)}>
                  {picked ? <button className="btn primary small" onClick={() => placeInto(node.code)}>Place held item here</button> : 'Drop a document here'}
                </div>
              )}
              {!editable && <p className="small muted">Sequence {seq.number} is published. It is read-only.</p>}

              {leaf && leaf.nodeCode === node.code && (
                <div className="props" style={{ marginTop: '1rem', borderTop: '1px solid var(--line)', paddingTop: '.75rem' }}>
                  <h3>Leaf properties</h3>
                  <div className="stack">
                    <label className="field">Leaf title
                      <input type="text" value={leaf.title} disabled={!editable} onChange={(e) => mutate((p) => updateLeaf(p, seq.number, leaf.id, { title: e.target.value }), { quiet: true })} />
                    </label>
                    {leaf.operation !== 'delete' && (
                      <label className="field">File name <small>lowercase a–z, 0–9 and hyphens, ending .pdf</small>
                        <input type="text" value={leaf.fileName} disabled={!editable} onChange={(e) => mutate((p) => updateLeaf(p, seq.number, leaf.id, { fileName: e.target.value }), { quiet: true })} />
                      </label>
                    )}
                    <label className="field">Operation
                      <select value={leaf.operation} disabled={!editable} onChange={(e) => {
                        const op = e.target.value;
                        mutate((p) => updateLeaf(p, seq.number, leaf.id, { operation: op, target: op === 'new' ? null : leaf.target }));
                      }}>
                        <option value="new">new</option>
                        {(expert || !isFirst) && <option value="replace">replace</option>}
                        {(expert || !isFirst) && <option value="append">append</option>}
                        {leaf.operation === 'delete' && <option value="delete">delete</option>}
                      </select>
                    </label>
                    {leaf.operation !== 'new' && leaf.operation !== 'delete' && (
                      <label className="field">Target leaf
                        <select value={leaf.target ? `${leaf.target.seq}:${leaf.target.leafId}` : ''} disabled={!editable} onChange={(e) => {
                          const [s, id] = e.target.value.split(':');
                          mutate((p) => updateLeaf(p, seq.number, leaf.id, { target: id ? { seq: s, leafId: id } : null }));
                        }}>
                          <option value="">Choose…</option>
                          {[...prevState.entries.values()]
                            .filter((x) => x.leaf.operation !== 'delete' && (expert || (x.status === 'current' && x.leaf.nodeCode === leaf.nodeCode)))
                            .map((x) => <option key={x.key} value={x.key}>{x.seq} · {dc(x.leaf.nodeCode)} · {x.leaf.title}{x.status !== 'current' ? ` (${x.status})` : ''}</option>)}
                          {leaf.target && !prevState.entries.has(`${leaf.target.seq}:${leaf.target.leafId}`) && <option value={`${leaf.target.seq}:${leaf.target.leafId}`}>{leaf.target.seq} · {leaf.target.leafId} (not found)</option>}
                        </select>
                      </label>
                    )}
                    {project.region === 'US' && needsStudyTag(leaf.nodeCode) && leaf.operation !== 'delete' && (
                      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', padding: '.6rem .7rem' }}>
                        <legend className="small" style={{ fontWeight: 600 }}>Study tagging file (US)</legend>
                        <div className="grid-2" style={{ gap: '.5rem' }}>
                          <label className="field">Study ID
                            <input type="text" value={leaf.study?.id ?? ''} disabled={!editable} placeholder="e.g. HRP-301"
                              onChange={(e) => mutate((p) => updateLeaf(p, seq.number, leaf.id, { study: { tag: leaf.study?.tag ?? DEFAULT_TAG[moduleOf(leaf.nodeCode)], id: e.target.value } }))} />
                          </label>
                          <label className="field">File tag
                            <select value={leaf.study?.tag ?? ''} disabled={!editable} onChange={(e) => mutate((p) => updateLeaf(p, seq.number, leaf.id, { study: { id: leaf.study?.id ?? '', tag: e.target.value } }))}>
                              <option value="">Choose…</option>
                              {(FILE_TAGS[moduleOf(leaf.nodeCode)] ?? []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </label>
                        </div>
                        {editable && tagFromDoc(project, leaf) && leaf.study?.id !== tagFromDoc(project, leaf).id && (
                          <button className="btn small" style={{ marginTop: '.4rem' }} onClick={() => mutate((p) => updateLeaf(p, seq.number, leaf.id, { study: tagFromDoc(p, leaf) }))}>Use {tagFromDoc(project, leaf).id} from the document</button>
                        )}
                      </fieldset>
                    )}
                  </div>
                  {leafDoc && (
                    <>
                      <div className="row" style={{ marginTop: '.6rem' }}><button className="btn small" onClick={() => setPreview(leaf)}>Open PDF</button><span className="small muted">Generated stub with the properties below built in.</span></div>
                      <dl>
                        <dt>Belongs in</dt><dd>{dc(leafDoc.section)}{leafDoc.section !== leaf.nodeCode && !leafDoc.decoy ? ' (not here)' : ''}</dd>
                        <dt>Pages</dt><dd>{leafDoc.pages}</dd>
                        <dt>File size</dt><dd>{(leafDoc.sizeKb / 1024).toFixed(2)} MB</dd>
                        <dt>PDF version</dt><dd>{leafDoc.pdfVersion}</dd>
                        <dt>Fonts</dt><dd>{leafDoc.fontsEmbedded ? 'all embedded' : 'not embedded'}</dd>
                        <dt>Security</dt><dd>{leafDoc.secured ? 'password set' : 'none'}</dd>
                        <dt>Text</dt><dd>{leafDoc.textSearchable ? 'searchable' : 'scanned image'}</dd>
                        <dt>Bookmarks</dt><dd>{leafDoc.bookmarks}</dd>
                        <dt>Hyperlinks</dt><dd>{(leafDoc.links ?? []).length ? `to ${leafDoc.links.join(', ')}` : 'none'}{leafDoc.brokenLinks ? `; ${leafDoc.brokenLinks} broken` : ''}</dd>
                        <dt>Page size</dt><dd>{leafDoc.pageSize}</dd>
                      </dl>
                      {leafDoc.coach && <p className="callout warn small">{leafDoc.coach}</p>}
                      {leafDoc.generated && leafDoc.content && <details><summary className="small">Read the generated text</summary><pre className="xml" style={{ whiteSpace: 'pre-wrap', maxHeight: 260 }}>{leafDoc.content}</pre></details>}
                      {editable && (
                        <div className="row" style={{ margin: '.5rem 0' }}>
                          {!['1.4', '1.5', '1.6', '1.7', 'A-1', 'A-2'].includes(leafDoc.pdfVersion) && <FixBtn id="version" />}
                          {leafDoc.secured && <FixBtn id="security" />}
                          {!leafDoc.fontsEmbedded && <FixBtn id="fonts" />}
                          {leafDoc.pages >= 5 && !leafDoc.bookmarks && <FixBtn id="bookmarks" />}
                          {leafDoc.brokenLinks > 0 && <FixBtn id="links" />}
                          {!leafDoc.textSearchable && <FixBtn id="ocr" />}
                        </div>
                      )}
                    </>
                  )}
                  {leafFindings.length > 0 && (
                    <ul className="small" style={{ paddingLeft: '1.1rem' }}>
                      {leafFindings.map((f) => <li key={f.key}><span className={`pill ${f.severity.toLowerCase()}`}>{f.severity}</span> {f.ruleId}: {f.message}{guided && <span className="muted"> {RULE_FIX(f)}</span>}</li>)}
                    </ul>
                  )}
                  {editable && (
                    <div className="row" style={{ marginTop: '.5rem' }}>
                      <button className="btn small" onClick={() => setPicked({ kind: 'leaf', id: leaf.id })}>Move to another heading</button>
                      <button className="btn small danger" onClick={() => { mutate((p) => removeLeaf(p, seq.number, leaf.id)); setSelLeaf(null); }}>Remove from sequence</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Library */}
      <section className="col" aria-label="Document library">
        <div className="col-head"><h2>Document library</h2><span className="small muted">{docs.length} documents</span></div>
        <div className="col-body">
          <label className="field" style={{ marginBottom: '.4rem' }}><span className="sr-only">Search documents</span>
            <input type="search" placeholder="Search title, section or file" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="small row" style={{ marginBottom: '.5rem' }}><input type="checkbox" checked={unplacedOnly} onChange={(e) => setUnplacedOnly(e.target.checked)} /> Only documents not yet in the current view</label>
          {docs.map((d) => (
            <div key={d.id} className={`doc ${picked?.id === d.id ? 'picked' : ''} ${usedDocs.has(d.id) ? 'used' : ''}`} {...dragProps({ kind: 'doc', id: d.id })}>
              <span className="bar" style={{ background: modColor(d.section) }} />
              <div>
                <div className="dt">{d.title}</div>
                <div className="ds">{dc(d.section)} · {d.pages} p{d.version > 1 ? ` · version ${d.version}` : ''}{usedDocs.has(d.id) ? ' · in dossier' : ''}{d.irOnly ? ' · from the IR response pack' : ''}</div>
                {guided && d.decoy && <div className="ds" style={{ color: 'var(--medium)' }}>Check the granularity of this one before using it.</div>}
              </div>
              {editable && <button className="btn small" aria-pressed={picked?.id === d.id} onClick={() => setPicked(picked?.id === d.id ? null : { kind: 'doc', id: d.id })}>{picked?.id === d.id ? 'Held' : 'Pick up'}</button>}
            </div>
          ))}
          {!docs.length && <p className="muted small">No documents match.</p>}
        </div>
      </section>

      {preview && <PdfPreview project={project} seqNumber={seq.number} leaf={preview} onClose={() => setPreview(null)} />}
      {picker && (
        <OperationPicker project={project} seq={seq} code={picker.code} doc={project.documents[picker.docId]} prevState={prevState} expert={expert}
          onCancel={() => setPicker(null)} onConfirm={onPickerConfirm} />
      )}
    </div>
  );

  function FixBtn({ id }) {
    return <button className="btn small" onClick={() => mutate((p) => fixDoc(p, leafDoc.id, id))}>{PDF_FIXES[id].label}</button>;
  }
}

const FIX = Object.fromEntries(rulesData.rules.map((r) => [r.id, r.fix]));
const RULE_FIX = (f) => `Fix: ${FIX[f.ruleId]}`;
