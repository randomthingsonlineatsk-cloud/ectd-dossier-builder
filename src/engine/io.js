// Project file export and import (JSON).
import { SCHEMA_VERSION, uid } from './model.js';

export const FILE_KIND = 'ectd-dossier-builder/project';

export function exportProject(project, attempts = []) {
  return JSON.stringify({
    kind: FILE_KIND,
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    notice: 'Training only. Fictional product, company and documents; not suitable for a real submission.',
    project,
    attempts: attempts.filter((a) => a.projectId === project.id),
  }, null, 2);
}

export function parseProjectFile(text, user, existingIds = new Set()) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (data?.kind !== FILE_KIND || !data.project) throw new Error('This is not an eCTD Dossier Builder project file.');
  if (data.schema > SCHEMA_VERSION) throw new Error('This project was saved by a newer version of the app.');
  const p = data.project;
  for (const k of ['id', 'sequences', 'documents', 'settings']) if (!(k in p)) throw new Error(`Project file is missing "${k}".`);
  const original = { userId: p.userId, classId: p.classId };
  if (existingIds.has(p.id)) { p.id = uid('p'); p.name = `${p.name} (imported)`; }
  p.importedFrom = { ...original, at: new Date().toISOString() };
  // An imported copy belongs to the local user; the original owner is kept for mentors and classes.
  p.userId = user?.userId ?? p.userId;
  p.classId = user?.classId ?? p.classId ?? null;
  return p;
}

export function download(filename, data, type = 'application/json') {
  const blob = new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
