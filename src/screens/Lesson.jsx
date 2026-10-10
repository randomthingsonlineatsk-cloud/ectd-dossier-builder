import React, { useState } from 'react';
import lessons from '../data/lessons.json' with { type: 'json' };
import { useApp } from '../ctx.js';
import StatusTable from '../components/StatusTable.jsx';

const MOD_INFO = {
  1: 'Module 1 — Regional administrative information: forms, cover letter, labelling, patents, fees. Not part of the harmonised CTD; each agency defines its own.',
  2: 'Module 2 — CTD summaries: introduction, Quality Overall Summary (2.3), nonclinical and clinical overviews (2.4, 2.5) and written/tabulated summaries (2.6, 2.7).',
  3: 'Module 3 — Quality: drug substance (3.2.S), drug product (3.2.P), appendices (3.2.A), regional information (3.2.R) and literature (3.3).',
  4: 'Module 4 — Nonclinical study reports: pharmacology, pharmacokinetics and toxicology (4.2), and literature (4.3).',
  5: 'Module 5 — Clinical study reports: tabular listing (5.2), study reports grouped by type (5.3), and literature (5.4).',
};

function ModulesTriangle() {
  const [m, setM] = useState(2);
  const shape = (n, el) => (
    <g role="button" tabIndex={0} aria-label={`Module ${n}`} aria-pressed={m === n}
      onClick={() => setM(n)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setM(n))}>
      {el}
    </g>
  );
  const fill = (n) => `var(--m${n})`;
  const op = (n) => (m === n ? 1 : 0.55);
  return (
    <div>
      <svg className="ctd-triangle" viewBox="0 0 520 300" aria-label="The CTD triangle">
        {shape(1, <><rect x="10" y="20" width="120" height="70" rx="6" fill={fill(1)} opacity={op(1)} /><text x="70" y="52" textAnchor="middle" fill="#fff" fontWeight="800">Module 1</text><text x="70" y="72" textAnchor="middle" fill="#fff" fontSize="12">Regional</text></>)}
        {shape(2, <><polygon points="330,20 269,120 391,120" fill={fill(2)} opacity={op(2)} /><text x="330" y="98" textAnchor="middle" fill="#fff" fontWeight="800">2</text></>)}
        {shape(3, <><polygon points="267,124 309,124 277,282 170,282" fill={fill(3)} opacity={op(3)} /><text x="258" y="230" textAnchor="middle" fill="#fff" fontWeight="800">3</text></>)}
        {shape(4, <><polygon points="311,124 351,124 383,282 279,282" fill={fill(4)} opacity={op(4)} /><text x="331" y="230" textAnchor="middle" fill="#fff" fontWeight="800">4</text></>)}
        {shape(5, <><polygon points="353,124 393,124 490,282 385,282" fill={fill(5)} opacity={op(5)} /><text x="404" y="230" textAnchor="middle" fill="#fff" fontWeight="800">5</text></>)}
        <text x="10" y="200" fill="var(--ink-3)" fontSize="12">Harmonised CTD: Modules 2–5</text>
      </svg>
      <p className="callout" aria-live="polite">{MOD_INFO[m]}</p>
    </div>
  );
}

function Compare() {
  const rows = [
    ['Delivery', 'Printed volumes', 'PDF files on media or a gateway', 'PDF files in a fixed folder tree, through a gateway'],
    ['Navigation', 'Tabs and paper TOCs', 'Bookmarks and hyperlinked TOCs', 'The agency viewer reads the XML backbone'],
    ['Backbone XML', 'None', 'None', 'index.xml plus regional XML'],
    ['Lifecycle', 'Resend changed volumes', 'Resend changed files; no formal link', 'new / replace / append / delete per document'],
    ['Checksums', 'None', 'Usually none', 'MD5 per file (v3.2.2), SHA-256 in v4.0'],
    ['Technical validation', 'None', 'Light', 'Formal validation criteria, run before review'],
  ];
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr><th>Aspect</th><th>Paper CTD</th><th>NeeS</th><th>eCTD</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

const GRAN = [
  { t: '3.2.P.5.1 Specification(s) — one PDF with all tests and limits', a: 'right' },
  { t: '3.2.P complete — all drug product sections in one 290-page PDF', a: 'coarse' },
  { t: '3.2.P.5.2 — one PDF per analytical procedure (assay, dissolution, impurities)', a: 'right' },
  { t: '3.2.P.5.1 — one PDF per test in the specification', a: 'fine' },
  { t: '5.3.5.1 — one study report (with its appendices) per controlled study', a: 'right' },
  { t: 'Module 2 — QOS, overviews and summaries merged into one file', a: 'coarse' },
];
function Granularity() {
  const [ans, setAns] = useState({});
  const [checked, setChecked] = useState(false);
  const score = GRAN.filter((g, i) => ans[i] === g.a).length;
  const label = { right: 'Right', coarse: 'Too coarse', fine: 'Too fine' };
  return (
    <div>
      <div className="sorter">
        {GRAN.map((g, i) => (
          <div className="sorter-item" key={i} style={checked ? { borderColor: ans[i] === g.a ? 'var(--ok)' : 'var(--high)' } : undefined}>
            <span>{g.t}{checked && ans[i] !== g.a && <span className="small" style={{ display: 'block', color: 'var(--high)' }}>Answer: {label[g.a]}</span>}</span>
            <span className="seg" role="group" aria-label={`Granularity of: ${g.t}`}>
              {Object.entries(label).map(([k, v]) => (
                <button key={k} aria-pressed={ans[i] === k} onClick={() => { setAns({ ...ans, [i]: k }); setChecked(false); }}>{v}</button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: '.75rem' }}>
        <button className="btn" onClick={() => setChecked(true)} disabled={Object.keys(ans).length < GRAN.length}>Check my answers</button>
        {checked && <span className={`pill ${score === GRAN.length ? 'ok' : 'medium'}`}>{score} of {GRAN.length} right</span>}
      </div>
    </div>
  );
}

const LEAF_PARTS = {
  element: 'The node: the XML element for CTD heading 3.2.P.5.1. Its position in the backbone, not the folder, tells the agency where the document belongs.',
  ID: 'A unique identifier for this leaf. Later sequences point to it when they replace, append or delete it.',
  operation: 'The lifecycle operation: new, replace, append or delete.',
  checksum: 'The MD5 checksum of the PDF. The agency recomputes it; a mismatch means the file was altered or corrupted.',
  href: 'The relative path to the file inside the sequence folder. Lowercase, a–z, 0–9 and hyphens only.',
  version: 'The PDF version of the file, checked against the accepted range.',
  title: 'The leaf title shown to reviewers. Readable and consistent, never a file name.',
};
function LeafAnatomy() {
  const [p, setP] = useState('operation');
  const b = (k, text) => <button aria-pressed={p === k} onClick={() => setP(k)}>{text}</button>;
  return (
    <div>
      <div className="leaf-anatomy">
        {'<'}{b('element', 'm3-2-p-5-1-specifications')}{'>\n'}
        {'  <leaf '}{b('ID', 'ID="L7f3a91"')}{' '}{b('operation', 'operation="new"')}{'\n'}
        {'        checksum-type="md5" '}{b('checksum', 'checksum="9e107d9d372bb6826bd81d3542a419d6"')}{'\n'}
        {'        '}{b('href', 'xlink:href="m3/32-body-data/32p-drug-prod/ostrevia-tablet/32p5-contr-drug-prod/32p51-spec/specifications.pdf"')}{'\n'}
        {'        '}{b('version', 'application-version="PDF 1.7"')}{'>\n'}
        {'    <title>'}{b('title', 'Specification(s)')}{'</title>\n'}
        {'  </leaf>\n'}
        {'</m3-2-p-5-1-specifications>'}
      </div>
      <p className="callout" aria-live="polite" style={{ marginTop: '.75rem' }}>{LEAF_PARTS[p]}</p>
    </div>
  );
}

const LC = [
  { seq: '0000', what: 'Original NDA', leaves: [{ k: 'spec1', t: 'Specification (v1)', op: 'new' }, { k: 'stab1', t: 'Stability data (6 months)', op: 'new' }, { k: 'pd', t: 'Pharmaceutical development', op: 'new' }] },
  { seq: '0001', what: 'Response to an information request', leaves: [{ k: 'spec2', t: 'Specification (v2)', op: 'replace', target: 'spec1' }, { k: 'stab2', t: 'Stability data (12-month update)', op: 'append', target: 'stab1' }] },
  { seq: '0002', what: 'Clean-up before approval', leaves: [{ k: 'del', t: 'Pharmaceutical development', op: 'delete', target: 'pd' }] },
];
function Lifecycle() {
  const [step, setStep] = useState(0);
  const status = {};
  for (const s of LC.slice(0, step + 1)) {
    for (const l of s.leaves) {
      if (l.op !== 'delete') status[l.k] = 'current';
      if (l.op === 'replace') status[l.target] = 'replaced';
      if (l.op === 'delete') status[l.target] = 'deleted';
    }
  }
  const all = LC.slice(0, step + 1).flatMap((s) => s.leaves.filter((l) => l.op !== 'delete').map((l) => ({ ...l, seq: s.seq })));
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>After sequence {LC[step].seq}: {LC[step].what}</strong>
        <div className="row">
          <button className="btn small" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Previous sequence</button>
          <button className="btn small primary" onClick={() => setStep(Math.min(LC.length - 1, step + 1))} disabled={step === LC.length - 1}>Next sequence</button>
        </div>
      </div>
      <div className="lc-steps" style={{ marginTop: '.75rem' }}>
        {LC.slice(0, step + 1).map((s) => (
          <div className="lc-seq" key={s.seq}>
            <span className="num">{s.seq}</span>
            <div>{s.leaves.map((l) => <span key={l.k} className="lc-leaf"><span className={`op ${l.op}`}>{l.op}</span>{l.t}</span>)}</div>
          </div>
        ))}
      </div>
      <h4 style={{ marginTop: '1rem' }}>Current view</h4>
      <div aria-live="polite">{all.filter((l) => status[l.k] === 'current').map((l) => <span key={l.k} className="lc-leaf">{l.t} <span className="muted">({l.seq})</span></span>)}</div>
      <h4 style={{ marginTop: '.5rem' }}>Cumulative view</h4>
      <div>{all.map((l) => <span key={l.k} className={`lc-leaf ${status[l.k] !== 'current' ? 'gone' : ''}`}>{l.t} <span className="muted">({l.seq}{status[l.k] !== 'current' ? `, ${status[l.k]}` : ''})</span></span>)}</div>
    </div>
  );
}

const INTERACTIVES = { modules: ModulesTriangle, compare: Compare, status: StatusTable, granularity: Granularity, leaf: LeafAnatomy, lifecycle: Lifecycle };

function Quiz({ lesson }) {
  const { saveLesson, toast } = useApp();
  const [ans, setAns] = useState({});
  const [done, setDone] = useState(false);
  const score = Math.round((lesson.quiz.filter((q, i) => ans[i] === q.answer).length / lesson.quiz.length) * 100);
  const submit = async () => { setDone(true); await saveLesson(lesson.id, score); toast(`Quiz scored ${score}%.`); };
  return (
    <section>
      <h2>Quiz</h2>
      {lesson.quiz.map((q, i) => (
        <div className="quiz-q" key={i}>
          <fieldset>
            <legend>{i + 1}. {q.q}</legend>
            {q.options.map((o, j) => {
              const cls = done ? (j === q.answer ? 'right' : ans[i] === j ? 'wrong' : '') : '';
              return (
                <label key={j} className={`quiz-opt ${cls}`}>
                  <input type="radio" name={`q${i}`} checked={ans[i] === j} disabled={done} onChange={() => setAns({ ...ans, [i]: j })} />
                  <span>{o}{done && j === q.answer && <span className="sr-only"> (correct answer)</span>}</span>
                </label>
              );
            })}
            {done && <p className="small" style={{ margin: '.5rem 0 0' }}>{ans[i] === q.answer ? 'Correct. ' : 'Not quite. '}{q.why}</p>}
          </fieldset>
        </div>
      ))}
      <div className="row">
        {!done && <button className="btn primary" onClick={submit} disabled={Object.keys(ans).length < lesson.quiz.length}>Submit answers</button>}
        {done && <><span className={`pill ${score >= 80 ? 'ok' : 'medium'}`}>Score {score}%</span><button className="btn" onClick={() => { setAns({}); setDone(false); }}>Try again</button></>}
      </div>
    </section>
  );
}

export default function Lesson({ id }) {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) return <div className="page"><h1>Lesson not found</h1><a href="#/learn">Back to Learn</a></div>;
  const next = lessons.find((l) => l.id === id + 1);
  return (
    <div className="page">
      <div className="lesson">
        <p className="small"><a href="#/learn">Learn</a> / Lesson {lesson.id}</p>
        <h1>{lesson.title}</h1>
        <p className="lede muted">{lesson.summary}</p>
        {lesson.sections.map((s) => {
          const I = s.interactive ? INTERACTIVES[s.interactive] : null;
          return (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.body.map((b, i) => <p key={i}>{b}</p>)}
              {I && <I />}
            </section>
          );
        })}
        <Quiz key={lesson.id} lesson={lesson} />
        <div className="row" style={{ marginTop: '2rem', justifyContent: 'space-between' }}>
          {id > 1 ? <a className="btn" href={`#/learn/${id - 1}`}>Previous lesson</a> : <span />}
          {next ? <a className="btn primary" href={`#/learn/${next.id}`}>Next: {next.title}</a> : <a className="btn primary" href="#/missions">Go to missions</a>}
        </div>
      </div>
    </div>
  );
}
