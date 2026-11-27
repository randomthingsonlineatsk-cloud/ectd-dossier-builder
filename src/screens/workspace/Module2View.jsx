import React, { useMemo, useRef, useState } from 'react';
import { displayCode as dc } from '../../engine/tree.js';
import { M2, BUILT, m2Doc, sources, blankDoc, checkDoc, fieldToken, fieldsIn, renderText, docWords, targetPages, placeSummary, WORDS_PER_PAGE } from '../../engine/module2.js';
import example from '../../data/m2-ostrevia.json' with { type: 'json' };

const sev = (s) => (s === 'error' ? 'high' : 'medium');
// The text with each linked field shown as its value, marked so the source is visible.
function Preview({ text, list }) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(/⟦([a-z0-9-]+)=([^⟧]*)⟧/g)) {
    parts.push(text.slice(last, m.index));
    const s = list.find((x) => x.id === m[1]);
    const stale = !s || s.value !== m[2];
    parts.push(<mark key={m.index} className={stale ? 'm2-stale' : 'm2-field'} title={s ? `${s.label}: ${s.leaf} (${s.dest})${stale ? ` now says ${s.value}` : ''}` : 'Source not found'}>{m[2]}<sup className="small">{s ? dc(s.leaf) : '?'}</sup></mark>);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{parts}</p>;
}

// The Module 2 writing workspace: write each summary heading by heading, insert values from their
// Module 3 source as linked fields, check every claim, and place the summary in the tree.
export default function Module2View({ project, seq, mutate, toast, setTab }) {
  const [code, setCode] = useState('2.3');
  const out = m2Doc(code);
  const doc = project.module2?.docs?.[code] ?? blankDoc(project, code);
  const [head, setHead] = useState(out.headings?.[0]?.code);
  const h = out.headings?.find((x) => x.code === head) ?? out.headings?.[0];
  const list = useMemo(() => sources(project), [project]);
  const chk = useMemo(() => checkDoc(project, doc), [project, doc]);
  const area = useRef(null);
  const [pick, setPick] = useState('');
  const sec = doc.sections[h.code] ?? { text: '', na: false, reason: '' };
  const inScope = list.filter((s) => h.code.startsWith(s.scope) || s.scope === '2.');
  const byHead = (c) => chk.findings.filter((f) => f.heading === c);
  const edit = (patch) => mutate((p) => { p.module2 ??= { docs: {} }; p.module2.docs[code] ??= blankDoc(p, code); Object.assign(p.module2.docs[code].sections[h.code], patch); p.module2.docs[code].updatedAt = new Date().toISOString(); });
  const insert = () => {
    const s = list.find((x) => x.id === pick); if (!s) return;
    const el = area.current, at = el ? el.selectionStart : sec.text.length;
    edit({ text: `${sec.text.slice(0, at)}${fieldToken(s)}${sec.text.slice(at)}` });
    toast(`Inserted ${s.label} from ${dc(s.leaf)}.`);
  };
  const relink = () => mutate((p) => {
    const d = p.module2.docs[code];
    for (const s of Object.values(d.sections)) s.text = s.text.replace(/⟦([a-z0-9-]+)=([^⟧]*)⟧/g, (m, id) => { const src = list.find((x) => x.id === id); return src ? fieldToken(src) : m; });
  });
  const stale = chk.findings.some((f) => f.stale);
  const words = docWords(doc), target = targetPages(project, code);
  const ostrevia = project.productId === 'nce-tablet' && !project.mission;
  const loadExample = () => {
    if (docWords(doc) && !window.confirm('Replace what you have written with the worked example?')) return;
    mutate((p) => { p.module2 ??= { docs: {} }; const d = blankDoc(p, code); const src = code === '2.2' ? example.introModel : example.qosModel; for (const [k, t] of Object.entries(src)) if (d.sections[k]) d.sections[k].text = t; if (d.sections['2.3.A']) Object.assign(d.sections['2.3.A'], { na: true, reason: 'Not applicable: a chemically synthesised small molecule with no adventitious agents or novel excipients.' }); p.module2.docs[code] = d; });
  };
  const place = () => { let r; if (mutate((p) => { r = placeSummary(p, seq.number, code); })) toast(`${r.message}${r.errors ? ` It still has ${r.errors} claim error${r.errors > 1 ? 's' : ''}; the validator will list them.` : ''}`, r.errors ? 'warn' : undefined); };

  return (
    <div className="stack">
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem' }}>
          <div>
            <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Module 2 Summary Writer</h2>
            <span className="small muted">Write each summary from the dossier's own data. Insert values from their source so every claim links to Module 3, and fix what the checker finds before you place it.</span>
          </div>
          <label className="field" style={{ minWidth: 260 }}>Document
            <select value={code} onChange={(e) => { setCode(e.target.value); setHead(m2Doc(e.target.value).headings?.[0]?.code); }}>
              {M2.docs.map((d) => <option key={d.code} value={d.code} disabled={!BUILT.includes(d.code)}>{d.code} {d.title}{BUILT.includes(d.code) ? '' : ` (Phase ${d.phase})`}</option>)}
            </select>
          </label>
        </div>
        <div className="row" style={{ gap: '1.5rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
          <div><span className="small muted">Length</span><div style={{ fontWeight: 700 }}>{words} words, about {Math.max(1, Math.ceil(words / WORDS_PER_PAGE))} of {target} pages</div></div>
          <div><span className="small muted">Linked fields</span><div style={{ fontWeight: 700 }}>{Object.values(doc.sections).reduce((n, s) => n + fieldsIn(s.text).length, 0)}</div></div>
          <div><span className="small muted">Claim errors</span><div style={{ fontWeight: 700 }}><span className={`pill ${chk.errors.length ? 'high' : 'ok'}`}>{chk.errors.length}</span></div></div>
          <div><span className="small muted">Warnings</span><div style={{ fontWeight: 700 }}><span className={`pill ${chk.warnings.length ? 'medium' : 'ok'}`}>{chk.warnings.length}</span></div></div>
        </div>
        <div className="row" style={{ marginTop: '.75rem', flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={seq.status === 'published' || !words} onClick={place}>Place in {dc(code)} of sequence {seq.number}</button>
          {stale && <button className="btn" onClick={relink}>Update every linked field to its current value</button>}
          {ostrevia && <button className="btn ghost small" onClick={loadExample}>Load the worked example</button>}
          <button className="btn ghost small" onClick={() => setTab('validate')}>Validation</button>
        </div>
      </section>

      <div className="row" style={{ alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <nav className="panel" style={{ flex: '0 1 16rem', minWidth: '13rem' }} aria-label={`${code} headings`}>
          <h3 style={{ marginTop: 0 }}>Headings</h3>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {out.headings.map((x) => {
              const f = byHead(x.code), s = doc.sections[x.code];
              const state = s?.na ? 'n/a' : !renderText(s?.text ?? '').trim() ? 'empty' : f.some((y) => y.severity === 'error') ? 'errors' : 'ok';
              return (
                <li key={x.code}>
                  <button className="btn ghost small" style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left', fontWeight: x.code === h.code ? 700 : 400 }} aria-current={x.code === h.code} onClick={() => setHead(x.code)}>
                    <span>{x.title}</span>
                    <span className={`pill ${state === 'errors' ? 'high' : state === 'ok' ? 'ok' : state === 'n/a' ? '' : 'medium'}`}>{state === 'errors' ? f.filter((y) => y.severity === 'error').length : state}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="panel" style={{ flex: '1 1 30rem', minWidth: 0 }}>
          <h3 style={{ marginTop: 0 }}>{h.title}</h3>
          <p className="small">{h.guide}</p>
          <label className="row small" style={{ gap: '.4rem' }}><input type="checkbox" checked={!!sec.na} onChange={(e) => edit({ na: e.target.checked })} />Not applicable to this product</label>
          {sec.na ? (
            <label className="field">Why it does not apply<input value={sec.reason ?? ''} onChange={(e) => edit({ reason: e.target.value })} /></label>
          ) : (
            <>
              <label className="field">Text<textarea ref={area} rows={9} value={sec.text} onChange={(e) => edit({ text: e.target.value })} aria-describedby="m2-tokens" /></label>
              <p id="m2-tokens" className="small muted">Linked fields appear in the text as ⟦source=value⟧. Leave them as they are; the preview shows the value and its source.</p>
              <div className="row" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
                <label className="field" style={{ flex: '1 1 18rem' }}>Insert from source
                  <select value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choose a value…</option>
                    {inScope.map((s) => <option key={s.id} value={s.id}>{s.label}: {s.value} ({dc(s.leaf)})</option>)}
                  </select>
                </label>
                <button className="btn" disabled={!pick} onClick={insert}>Insert at the cursor</button>
              </div>
              <div className="callout small" style={{ marginTop: '.75rem' }}><strong>Preview</strong><Preview text={sec.text || ' '} list={list} /></div>
            </>
          )}
          {byHead(h.code).length > 0 && (
            <ul className="small" style={{ marginTop: '.75rem' }}>
              {byHead(h.code).map((f, i) => <li key={i}><span className={`pill ${sev(f.severity)}`}>{f.code}</span> {f.message}</li>)}
            </ul>
          )}
        </section>
      </div>

      {chk.findings.length > 0 && (
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Every finding in {code}</h3>
          <div className="table-wrap">
            <table className="data">
              <caption className="sr-only">Claim checker findings</caption>
              <thead><tr><th>Check</th><th>Heading</th><th>Finding</th></tr></thead>
              <tbody>{chk.findings.map((f, i) => (
                <tr key={i}><td><span className={`pill ${sev(f.severity)}`}>{f.code}</span></td><td>{f.heading ? <button className="btn small ghost" onClick={() => setHead(f.heading)}>{out.headings.find((x) => x.code === f.heading)?.title ?? f.heading}</button> : '—'}</td><td>{f.message}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="small muted">C0 empty heading · C1 a number with no source · C2 a value that differs from its source or a linked field out of date · C3 a condition that differs · C12 not applicable without a valid reason · W1 a value typed rather than linked · L2 a link outside the dossier · LEN longer than the target.</p>
        </section>
      )}
    </div>
  );
}
