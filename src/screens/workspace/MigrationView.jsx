import React, { useMemo, useState } from 'react';
import { useApp } from '../../ctx.js';
import { saveProject } from '../../engine/db.js';
import { download } from '../../engine/io.js';
import { displayCode as dc, slug } from '../../engine/tree.js';
import { analyseMigration, migrationCsv, convertToV4, MIGRATION_RULES } from '../../engine/migrate.js';

// The v4.0 Migration Lab: plan and practise moving a published v3.2.2 lifecycle to eCTD v4.0.
export default function MigrationView({ project, focusNode, setTab, toast }) {
  const { reload } = useApp();
  const a = useMemo(() => analyseMigration(project), [project]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const eu = project.region === 'EU';
  const sev = (s) => (s === 'High' ? 'high' : s === 'Medium' ? 'medium' : 'ok');

  const create = async () => {
    setBusy(true);
    try {
      const p = convertToV4(project);
      await saveProject(p);
      await reload();
      toast(`Created “${p.name}”. Unit ${a.firstUnit} is open and carries v3.2.2 sequence ${a.lastSequence}.`);
      window.location.hash = `#/project/${p.id}`;
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <section className="panel">
        <h2 style={{ fontSize: 'var(--step-1)' }}>v4.0 Migration Lab</h2>
        <p>Plan the move of this application from eCTD v3.2.2 to v4.0 the way {eu ? 'EMA describes it' : 'FDA’s v4.0 Technical Conformance Guide describes it'}: the published lifecycle stays as it is, and each current leaf is carried forward and lifecycled by a leaf reference from the first v4.0 unit.</p>
        <div className="row" style={{ gap: '1.5rem', flexWrap: 'wrap' }}>
          <div><span className="small muted">Readiness</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.score}%</div></div>
          <div><span className="small muted">Last v3.2.2 sequence</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.lastSequence ?? '—'}</div></div>
          <div><span className="small muted">First v4.0 unit</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.lastSequence ? a.firstUnit : '—'}</div></div>
          <div><span className="small muted">Leaves carried forward</span><div style={{ fontSize: 'var(--step-2)', fontWeight: 700 }}>{a.rows.length}</div></div>
          <div><span className="small muted">Findings</span><div><span className="pill high">{a.high} high</span> <span className="pill medium">{a.medium} medium</span></div></div>
        </div>
        <div className="row" style={{ marginTop: '1rem' }}>
          <button className="btn primary" disabled={!a.ready || busy} onClick={create}>{busy ? 'Creating…' : 'Create the v4.0 project'}</button>
          <button className="btn" disabled={!a.rows.length} onClick={() => download(`${slug(project.name)}-v4-migration.csv`, migrationCsv(project, a), 'text/csv')}>Download migration inventory (CSV)</button>
          {!a.ready && <span className="small muted">Fix the High findings and close open drafts first.</span>}
        </div>
        <p className="small muted" style={{ marginTop: '.6rem' }}>This project is not changed. A new project is made with the published v3.2.2 sequences kept read-only as its history and unit {a.firstUnit} open for you to build.</p>
      </section>

      <section className="panel">
        <h3>The rules this follows</h3>
        <ul className="small">
          <li>The first v4.0 unit takes the next whole number after the last v3.2.2 sequence (0003 becomes unit 4), and only that first unit carries the v3.2.2 sequence number.</li>
          <li>Once a v4.0 unit has been sent, every later unit for the application must be v4.0. There is no going back.</li>
          <li>v3.2.2 content is reused and lifecycled through a leaf reference. Only active (current) leaves can be lifecycled; suspend takes a context of use out of the current view.</li>
          <li>Document type keywords replace v3.2.2 file tags and are required for 4.2.x and 5.3.1.x to 5.3.5.x; study IDs become study keywords; substance, product and indication attributes become sender-defined keywords.</li>
          {eu ? <>
            <li>EU: there is no separate regional envelope (submissionunit.xml and sha256.txt only), and Module 1 is one m1 folder: country and language become keywords, so every Module 1 file name must be unique.</li>
            <li>EU: documents and submission units can never be deleted. Forward compatibility for existing centralised lifecycles is still in EMA’s pilot (phase 3, 2026). v4.0 is optional for new centralised applications for now; EMA’s own documents give the date it becomes mandatory as December 2027 in one place and Q1 2028 in another, so plan for either; practise it here, and follow EMA’s eSubmission pages before a real move.</li>
          </> : <li>US: CDER and CBER have accepted forward compatibility for existing v3.2.2 applications since 16 October 2026. v4.0 is still optional: FDA accepts v3.2.2 and v4.0 side by side and has set no date for requiring v4.0.</li>}
        </ul>
      </section>

      <section className="panel">
        <h3>Findings</h3>
        {a.issues.length === 0 ? <p className="muted">No findings. Ready to migrate.</p> : (
          <table className="data">
            <thead><tr><th>Rule</th><th>Severity</th><th>Finding</th><th></th></tr></thead>
            <tbody>
              {a.issues.map((i, n) => (
                <tr key={n}>
                  <td title={MIGRATION_RULES[i.rule].text}>{i.rule}</td>
                  <td><span className={`pill ${sev(i.sev)}`}>{i.sev}</span></td>
                  <td>{i.msg}</td>
                  <td>{i.nodeCode && <button className="btn small" onClick={() => { focusNode(i.nodeCode, i.leafId ?? null); setTab('builder'); }}>Show</button>}{i.rule === 'MIG-05' && <button className="btn small" onClick={() => setTab('sequences')}>Sequences</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">A fix to a current leaf is made the v3.2.2 way: in a new sequence, published, before you migrate.</p>
      </section>

      <section className="panel">
        <h3>Migration inventory</h3>
        {a.rows.length === 0 ? <p className="muted">Publish a sequence first: nothing current to carry forward.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead><tr><th>Heading</th><th>Title</th><th>From</th><th>v4.0 context of use</th><th>Keywords</th><th></th></tr></thead>
              <tbody>
                {a.rows.map((r) => (
                  <React.Fragment key={r.leafId}>
                    <tr>
                      <td>{dc(r.nodeCode)}</td>
                      <td>{r.title}{r.notes.length ? <> {r.notes.map((x) => <span key={x} className={`pill ${sev(MIGRATION_RULES[x].sev)}`}>{x}</span>)}</> : null}</td>
                      <td className="small">seq {r.seq}<br /><code>{r.file}</code></td>
                      <td className="small"><code>{r.cou}</code><br />priority {r.priority}</td>
                      <td className="small">{r.keywords.length ? r.keywords.map((k) => `${k.type}: ${k.value}`).join('; ') : <span className="muted">none</span>}</td>
                      <td><button className="btn small" aria-expanded={open === r.leafId} onClick={() => setOpen(open === r.leafId ? null : r.leafId)}>{open === r.leafId ? 'Hide' : 'Detail'}</button></td>
                    </tr>
                    {open === r.leafId && (
                      <tr><td colSpan={6} className="small">
                        <div>v4.0 path: <code>{r.v4Path}</code></div>
                        <div>Leaf reference (v3.2.2 sequence {r.seq}, leaf <code>{r.leafId}</code>): a replacement in v4.0 points at this leaf and sends the same context of use and keywords, so the heading and attributes stay the same.</div>
                        <div>Document ID carried: <code>{r.docId}</code></div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
