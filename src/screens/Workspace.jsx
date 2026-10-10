import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../ctx.js';
import { db, saveProject as dbSave, saveAttempt } from '../engine/db.js';
import { seqByNumber, sortedSequences, PRODUCTS } from '../engine/model.js';
import { validate } from '../engine/validate.js';
import { evaluateMission } from '../engine/missions.js';
import Builder from './workspace/Builder.jsx';
import Module1 from './workspace/Module1.jsx';
import Sequences from './workspace/Sequences.jsx';
import Backbone from './workspace/Backbone.jsx';
import ValidateView from './workspace/ValidateView.jsx';
import Publishing from './workspace/Publishing.jsx';
import SettingsView from './workspace/SettingsView.jsx';
import MissionView from './workspace/MissionView.jsx';

function Timer({ mission, onExpire }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const elapsed = Math.floor((now - new Date(mission.startedAt).getTime()) / 1000);
  const limit = mission.minutes ? mission.minutes * 60 : null;
  const fired = useRef(false);
  useEffect(() => {
    if (limit && elapsed >= limit && !mission.submitted && !fired.current) { fired.current = true; onExpire(); }
  }, [elapsed, limit, mission.submitted, onExpire]);
  const show = limit ? Math.max(0, limit - elapsed) : elapsed;
  const mm = String(Math.floor(show / 60)).padStart(2, '0');
  const ss = String(show % 60).padStart(2, '0');
  return (
    <span className={`timer ${limit && show < 300 ? 'late' : ''}`} role="timer" aria-label={limit ? 'Time remaining' : 'Time elapsed'}>
      {mission.submitted ? 'Submitted' : `${mm}:${ss}`}{limit && !mission.submitted ? <span className="small muted" style={{ fontWeight: 400 }}> left</span> : null}
    </span>
  );
}

export default function Workspace({ id }) {
  const { projects, attempts, toast, reload, user } = useApp();
  const [project, setProject] = useState(() => projects.find((p) => p.id === id) ?? null);
  const [missing, setMissing] = useState(false);
  const [seqNumber, setSeqNumber] = useState(null);
  const [tab, setTab] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [focusLeaf, setFocusLeaf] = useState(null);
  const [nonce, setNonce] = useState(0);
  const saveTimer = useRef(null);
  const latest = useRef(project);

  useEffect(() => {
    if (project) return;
    db.get('projects', id).then((p) => { if (p) { latest.current = p; setProject(p); } else setMissing(true); });
  }, [id, project]);
  useEffect(() => {
    if (project && !seqNumber) {
      const seqs = sortedSequences(project);
      const draft = seqs.find((s) => s.status === 'draft');
      setSeqNumber((draft ?? seqs[seqs.length - 1]).number);
      setTab(project.mission ? 'mission' : 'builder');
    }
  }, [project, seqNumber]);
  useEffect(() => () => { // flush pending save on leave
    if (saveTimer.current) { clearTimeout(saveTimer.current); dbSave(latest.current).then(reload); } else reload();
  }, [reload]);

  const persist = useCallback((p) => {
    latest.current = p;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; dbSave(p).catch(() => toast('Could not save to this browser’s storage.', 'error')); }, 350);
  }, [toast]);

  // Synchronous so callers can read values their mutation produced (e.g. a new leaf id).
  const mutate = useCallback((fn) => {
    const next = structuredClone(latest.current);
    try { fn(next); } catch (e) { toast(e.message, 'error'); return false; }
    persist(next);
    setProject(next);
    return true;
  }, [persist, toast]);

  // For work that generates files (publishing): runs on a copy, commits when done.
  const mutateAsync = useCallback(async (fn) => {
    const next = structuredClone(latest.current);
    try { await fn(next); } catch (e) { toast(e.message, 'error'); return false; }
    persist(next);
    setProject(next);
    return true;
  }, [persist, toast]);

  const seq = project && seqNumber ? seqByNumber(project, seqNumber) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const validation = useMemo(() => (seq ? validate(project, seq.number) : null), [project, seq, nonce]);
  const evaluation = useMemo(() => (project?.mission ? evaluateMission(project) : null), [project]);

  const submitMission = useCallback(() => {
    {
      const cur = latest.current;
      if (!cur?.mission || cur.mission.submitted) return;
      const ev = evaluateMission(cur);
      const next = structuredClone(cur);
      const seconds = Math.floor((Date.now() - new Date(cur.mission.startedAt).getTime()) / 1000);
      next.mission.submitted = { at: new Date().toISOString(), score: ev.score, seconds };
      persist(next);
      const att = attempts.find((a) => a.id === cur.mission.attemptId) ?? { id: cur.mission.attemptId, kind: 'mission', missionId: cur.mission.id, projectId: cur.id, difficulty: cur.mission.difficulty, startedAt: cur.mission.startedAt };
      saveAttempt({ ...att, userId: cur.userId ?? user?.userId, classId: cur.classId ?? null, finishedAt: new Date().toISOString(), score: ev.score, seconds, detail: ev.checks ?? { fixed: ev.fixed, total: ev.total } });
      toast(`Mission scored: ${ev.score}%.`);
      setProject(next);
    }
  }, [attempts, persist, toast, user]);

  const focusNode = (code, leafId = null) => { setSelectedCode(code); setFocusLeaf(leafId ? { id: leafId, n: Date.now() } : null); };

  if (missing) return <div className="page"><h1>Project not found</h1><p>It may have been deleted from this browser. <a href="#/">Go to your projects</a></p></div>;
  if (!project || !seq || !tab) return <div className="page muted">Loading project…</div>;

  const p = PRODUCTS[project.productId];
  const tabs = [
    ...(project.mission ? [['mission', 'Mission']] : []),
    ['builder', 'Builder'], ['m1', 'Module 1'], ['publishing', 'Publishing'], ['sequences', 'Sequences'], ['backbone', 'Backbone'],
    ['validate', 'Validation', validation.counts.High + validation.counts.Medium], ['settings', 'Settings'],
  ];
  const guided = project.mission?.difficulty === 'guided';

  return (
    <div className="ws">
      <div className="ws-head">
        <div className="ws-title">
          <div>
            <p className="small muted" style={{ margin: 0 }}><a href="#/">Projects</a> / {p.product.brandName} ({p.product.inn}) · {project.region} {project.appType.toUpperCase()} · eCTD {project.ectdVersion}</p>
            <h1>{project.name}</h1>
          </div>
          <label className="field" style={{ minWidth: 220 }}>Working on sequence
            <select value={seq.number} onChange={(e) => setSeqNumber(e.target.value)}>
              {sortedSequences(project).map((s) => <option key={s.id} value={s.number}>{s.number} — {s.subType} ({s.status})</option>)}
            </select>
          </label>
        </div>
        <div className="tabs" role="tablist" aria-label="Workspace">
          {tabs.map(([k, label, count]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {label}{count ? <span className={`pill ${validation.counts.High ? 'high' : 'medium'} count`}>{count}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {project.mission && (
        <div className="mission-bar">
          <strong>Mission {project.mission.id}</strong>
          <span className="pill">{project.mission.difficulty}</span>
          <Timer mission={project.mission} onExpire={() => { toast('Time is up. Your mission has been submitted for scoring.', 'warn'); submitMission(); }} />
          <span>Score now <strong>{evaluation.score}%</strong>{project.mission.id === 11 ? ` (${evaluation.fixed}/${evaluation.total} defects fixed)` : ''}</span>
          <span className={`pill ${validation.counts.High ? 'high' : validation.counts.Medium ? 'medium' : 'ok'}`}>Seq {seq.number}: {validation.counts.High} high, {validation.counts.Medium} medium</span>
        </div>
      )}
      {seq.status === 'published' && tab !== 'sequences' && tab !== 'mission' && (
        <div className="callout" style={{ margin: '1rem 1.25rem 0' }}>Sequence {seq.number} is published and read-only. Go to Sequences to create the next one.</div>
      )}
      <div className="ws-body" role="tabpanel">
        {tab === 'mission' && <MissionView project={project} evaluation={evaluation} onSubmit={submitMission} />}
        {tab === 'builder' && <Builder project={project} seq={seq} mutate={mutate} validation={validation} toast={toast} guided={guided} selectedCode={selectedCode} setSelectedCode={setSelectedCode} focusLeaf={focusLeaf} />}
        {tab === 'm1' && <Module1 project={project} seq={seq} mutate={mutate} toast={toast} setTab={setTab} focusNode={focusNode} />}
        {tab === 'publishing' && <Publishing project={project} seq={seq} mutate={mutate} validation={validation} toast={toast} focusNode={focusNode} setTab={setTab} />}
        {tab === 'sequences' && <Sequences project={project} seq={seq} setSeqNumber={setSeqNumber} mutate={mutate} mutateAsync={mutateAsync} toast={toast} />}
        {tab === 'backbone' && <Backbone project={project} seq={seq} />}
        {tab === 'validate' && <ValidateView project={project} seq={seq} validation={validation} focusNode={focusNode} setTab={setTab} onRerun={() => { setNonce((n) => n + 1); toast(`Validated sequence ${seq.number}: ${validation.verdict.text}`); }} />}
        {tab === 'settings' && <SettingsView project={project} mutate={mutate} attempts={attempts} />}
      </div>
    </div>
  );
}
