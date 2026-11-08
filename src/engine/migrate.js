// The v4.0 Migration Lab: take an application's published eCTD v3.2.2 lifecycle and plan its move
// to v4.0 (forward compatibility), then make the v4.0 project.
//
// What the rules say (FDA eCTD v4.0 Technical Conformance Guide, rev. 1.5, June 2026, section 2.1):
// the first v4.0 unit takes the next whole number after the last v3.2.2 sequence (0003 → 4) and
// carries the v3.2.2 sequence number only on that first unit; once a v4.0 unit is received, every
// later one must be v4.0; v3.2.2 content is lifecycled and reused through a leaf reference; only
// active leaves can be lifecycled; suspend inactivates; a replacement keeps the heading and
// attributes by sending the same context of use and keyword values. Document type keywords replace
// v3.2.2 file tags (required for 4.2.x and 5.3.1.x to 5.3.5.x); sender-defined keywords replace
// heading attributes such as substance, manufacturer and dosage form; group title keywords tell
// several documents under one heading apart and are to be used sparingly. In the EU, all of
// Module 1 sits in one m1 folder (country, language and product become keywords), documents
// and submission units can never be deleted, and forward compatibility for existing centralised
// lifecycles is still being piloted (EMA: pilot phase 3 in 2026). FDA (CDER and CBER) has accepted
// forward compatibility for existing v3.2.2 applications since 16 October 2026.
import { INDEX, displayCode, nodeLabel } from './tree.js';
import { lifecycleState, sortedSequences, docForLeaf, newSequence, uid, isRetireOp } from './model.js';
import { couCode, v4FilePath } from './v4.js';
import { needsStudyTag, FILE_TAGS, moduleOf } from './stf.js';

export const MIGRATION_RULES = {
  'MIG-01': { sev: 'High', text: 'A study report has no study ID: v4.0 identifies studies by a keyword, so the document cannot be placed in its study.' },
  'MIG-02': { sev: 'Medium', text: 'A study report in 4.2 or 5.3.1 to 5.3.5 has no valid file tag: its document type keyword cannot be set (required in v4.0).' },
  'MIG-03': { sev: 'Medium', text: 'Several current documents under one heading share a title: give them distinct titles, or a group title keyword (to be used sparingly).' },
  'MIG-04': { sev: 'High', text: 'EU: Module 1 becomes one folder in v4.0, so two current Module 1 files would have the same name: rename one before migrating.' },
  'MIG-05': { sev: 'Medium', text: 'A draft sequence is still open: publish or delete it first. The first v4.0 unit follows the last published v3.2.2 sequence.' },
  'MIG-06': { sev: 'High', text: 'Nothing has been published yet: there is no v3.2.2 lifecycle to migrate. Start the application in v4.0 instead.' },
  'MIG-07': { sev: 'Low', text: 'Only active (current) leaves can be lifecycled from v4.0. Replaced and deleted leaves stay in the v3.2.2 history and are not carried forward.' },
  'MIG-09': { sev: 'High', text: 'EU: v4.0 is open to centralised procedure applications only. National, MRP and DCP lifecycles stay in v3.2.2 for now.' },
  'MIG-08': { sev: 'Low', text: 'EU: forward compatibility for existing centralised lifecycles is still in EMA’s pilot (phase 3, 2026). Practise it here; do not plan a real move until EMA opens it.' },
};

// The keywords a current v3.2.2 leaf becomes in v4.0.
export function keywordsFor(project, leaf) {
  const out = [];
  const n = INDEX.map[leaf.nodeCode];
  const s = project.settings;
  if (leaf.study?.id) out.push({ type: 'study', value: leaf.study.id });
  if (needsStudyTag(leaf.nodeCode) && leaf.study?.tag) out.push({ type: 'document type', value: FILE_TAGS[moduleOf(leaf.nodeCode)]?.find((t) => t.value === leaf.study.tag)?.label ?? leaf.study.tag });
  const anc = []; for (let a = n; a; a = a.parent ? INDEX.map[a.parent] : null) anc.push(a);
  if (anc.some((a) => a.repeat === 'substance')) out.push({ type: 'sender-defined: substance', value: `${s.substance?.name} + ${s.substance?.manufacturer}` });
  if (anc.some((a) => a.repeat === 'product')) out.push({ type: 'sender-defined: product', value: `${s.product?.name} + ${s.product?.dosageForm}` });
  if (anc.some((a) => a.repeat === 'indication')) out.push({ type: 'sender-defined: indication', value: s.indication });
  if (project.region === 'EU' && n?.isM1) {
    if (leaf.country && leaf.country !== 'ema' && leaf.country !== 'common') out.push({ type: 'country', value: leaf.country.toUpperCase() });
    if (leaf.lang) out.push({ type: 'language', value: leaf.lang });
  }
  return out;
}

export function analyseMigration(project) {
  const issues = [];
  const add = (rule, msg, where = {}) => issues.push({ rule, sev: MIGRATION_RULES[rule].sev, msg, ...where });
  const seqs = sortedSequences(project);
  const published = seqs.filter((s) => s.status === 'published');
  const last = published.at(-1);
  if (!last) add('MIG-06', MIGRATION_RULES['MIG-06'].text);
  if (project.region === 'EU' && (project.settings.eu?.procedureType ?? 'centralised') !== 'centralised') add('MIG-09', `This is a ${project.settings.eu.procedureType} procedure. ${MIGRATION_RULES['MIG-09'].text}`);
  if (project.ectdVersion !== '3.2.2') add('MIG-06', `This project is already eCTD ${project.ectdVersion}.`);
  for (const s of seqs.filter((x) => x.status !== 'published')) if (last && s.number > last.number && s.leaves.length) add('MIG-05', `Sequence ${s.number} is a draft with ${s.leaves.length} leaf${s.leaves.length === 1 ? '' : 'ves'}.`, { seq: s.number });
  const firstUnit = last ? parseInt(last.number, 10) + 1 : 1
  const rows = []
  if (last) {
    const st = lifecycleState(project, last.number);
    const all = [...st.entries.values()];
    const current = all.filter((e) => e.status === 'current' && !isRetireOp(e.leaf.operation));
    const retired = all.length - current.length;
    if (retired) add('MIG-07', `${retired} leaf${retired === 1 ? ' is' : 'ves are'} replaced or deleted in the v3.2.2 history and stay there.`);
    const byNode = {};
    for (const e of current) (byNode[e.leaf.nodeCode] ??= []).push(e);
    const m1Names = new Map();
    for (const [code, list] of Object.entries(byNode)) {
      const titles = new Map();
      list.forEach((e, i) => {
        const l = e.leaf, doc = docForLeaf(project, l), kw = keywordsFor(project, l);
        const notes = [];
        if (needsStudyTag(code) && !l.study?.id) { add('MIG-01', `“${l.title}” in ${displayCode(code)} has no study ID.`, { seq: e.seq, leafId: l.id, nodeCode: code }); notes.push('MIG-01') }
        else if (needsStudyTag(code) && !FILE_TAGS[moduleOf(code)]?.some((t) => t.value === l.study?.tag)) { add('MIG-02', `“${l.title}” has file tag “${l.study?.tag || '(none)'}”.`, { seq: e.seq, leafId: l.id, nodeCode: code }); notes.push('MIG-02') }
        const t = (l.title ?? '').trim().toLowerCase(); titles.set(t, [...(titles.get(t) ?? []), l])
        const path = v4FilePath({ ...project, region: project.region }, l)
        if (project.region === 'EU' && INDEX.map[code]?.isM1) {
          const prev = m1Names.get(l.fileName)
          if (prev) { add('MIG-04', `${l.fileName} is used by “${prev.title}” (${displayCode(prev.nodeCode)}) and “${l.title}” (${displayCode(code)}).`, { seq: e.seq, leafId: l.id, nodeCode: code }); notes.push('MIG-04') }
          else m1Names.set(l.fileName, l)
        }
        rows.push({ seq: e.seq, leafId: l.id, nodeCode: code, heading: nodeLabel(code), title: l.title, file: l.fileName, v4Path: path, cou: couCode(code), priority: (i + 1) * 1000, keywords: kw, docId: doc?.id ?? l.docId, notes })
      })
      for (const [, ls] of titles) if (ls.length > 1) { add('MIG-03', `${ls.length} documents titled “${ls[0].title}” under ${displayCode(code)}.`, { nodeCode: code }); for (const r of rows.filter((x) => ls.some((l) => l.id === x.leafId))) r.notes.push('MIG-03') }
    }
    if (project.region === 'EU') add('MIG-08', MIGRATION_RULES['MIG-08'].text)
  }
  rows.sort((a, b) => INDEX.order.indexOf(a.nodeCode) - INDEX.order.indexOf(b.nodeCode) || a.priority - b.priority)
  const high = issues.filter((i) => i.sev === 'High').length, medium = issues.filter((i) => i.sev === 'Medium').length
  const score = Math.max(0, 100 - 15 * high - 4 * medium)
  return { lastSequence: last?.number ?? null, firstUnit, rows, issues, high, medium, score, ready: !!last && high === 0 && !issues.some((i) => i.rule === 'MIG-05') }
}

export function migrationCsv(project, a) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const head = ['v3.2.2 sequence', 'Leaf ID', 'Heading', 'Title', 'v3.2.2 file', 'v4.0 path', 'Context of use', 'Priority', 'Keywords', 'Issues']
  return [head, ...a.rows.map((r) => [r.seq, r.leafId, r.heading, r.title, r.file, r.v4Path, r.cou, r.priority, r.keywords.map((k) => `${k.type}=${k.value}`).join('; '), r.notes.join(' ')])].map((r) => r.map(q).join(',')).join('\n') + '\n'
}

// Makes the v4.0 project: the published v3.2.2 sequences are kept, read-only, as its history
// (their content is reached by leaf reference), and the first v4.0 unit is opened with the next
// whole number, recording the v3.2.2 sequence it follows.
export function convertToV4(project) {
  const a = analyseMigration(project)
  if (!a.ready) throw new Error('Fix the High findings and close open drafts before creating the v4.0 project.')
  const p = structuredClone(project)
  p.id = uid('p')
  p.couSeed = project.couSeed ?? project.id
  p.name = `${project.name} (v4.0)`
  p.ectdVersion = '4.0'
  p.migratedFrom = { projectId: project.id, lastV322: a.lastSequence, at: new Date().toISOString(), score: a.score }
  p.sequences = p.sequences.filter((s) => s.status === 'published').map((s) => ({ ...s, legacy: '3.2.2' }))
  const first = newSequence(String(a.firstUnit).padStart(4, '0'), { submissionType: p.sequences.at(-1)?.submissionType, subType: project.region === 'EU' ? 'initial' : 'amendment' }, p.region)
  first.forwardFrom = a.lastSequence
  first.description = `First eCTD v4.0 unit (forward compatibility from v3.2.2 sequence ${a.lastSequence})`
  p.sequences.push(first)
  p.mission = undefined
  p.log = [...(p.log ?? []), { at: new Date().toISOString(), what: `Migrated from eCTD v3.2.2 (last sequence ${a.lastSequence}); first v4.0 unit ${a.firstUnit}` }]
  p.updatedAt = new Date().toISOString()
  return p
}
