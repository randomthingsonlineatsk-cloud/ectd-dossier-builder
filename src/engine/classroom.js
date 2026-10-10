// Client for the classroom API (Cloudflare Worker + D1, see worker/). Without a server address
// the app stays fully browser-only; classroom mode is the only feature that talks to a server.
import { getMeta, setMeta } from './db.js';
import { evaluateMission } from './missions.js';
import { validate } from './validate.js';
import { sortedSequences, migrateProject } from './model.js';
import { exportProject } from './io.js';

export const BUILT_IN_API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLASSROOM_API) || '';

export async function loadSession() {
  const s = (await getMeta('classroom', null)) ?? {};
  return { ...s, api: s.api || BUILT_IN_API };
}
export const saveSession = (s) => setMeta('classroom', s);

export async function api(session, method, path, body) {
  if (!session.api) throw new Error('No classroom server is set.');
  const base = session.api.replace(/\/+$/, '');
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(session.token ? { authorization: `Bearer ${session.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the classroom server. Check the address and your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `The classroom server answered ${res.status}.`);
  return data;
}

// What a student sends: the project file plus the scores the app computed.
export function submissionPayload(project, attempts = []) {
  const p = migrateProject(structuredClone(project));
  const ev = evaluateMission(p);
  const last = sortedSequences(p).filter((s) => s.leaves.length).pop() ?? sortedSequences(p)[0];
  const v = validate(p, last.number);
  return {
    project: JSON.parse(exportProject(project, attempts)),
    score: ev?.score ?? 0,
    axes: ev?.axes ?? null,
    counts: { ...v.counts, sequence: last.number, verdict: v.verdict?.text ?? '' },
    checks: ev?.checks?.map((c) => ({ id: c.id, label: c.label, ok: c.ok })) ?? (ev?.total ? [{ id: 'defects', label: `Defects fixed: ${ev.fixed} of ${ev.total}`, ok: ev.fixed === ev.total }] : null),
  };
}

// The instructor re-scores a submitted project in their own browser.
export function verifyProject(projectFile) {
  const p = migrateProject(structuredClone(projectFile.project));
  const ev = evaluateMission(p);
  return { score: ev?.score ?? 0, checks: ev?.checks ?? null, axes: ev?.axes ?? null };
}

export const isLate = (assignment, submittedAt) => submittedAt > assignment.dueAt;
