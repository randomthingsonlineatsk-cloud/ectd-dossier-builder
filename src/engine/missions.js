// Mission seeds and scoring for Phase 1 missions 1, 4 and 11.
import missionsData from '../data/missions.json' with { type: 'json' };
import { createProject, docForLeaf, makeDoc, seqByNumber } from './model.js';
import { tagFromDoc } from './stf.js';
import { addCoverLetter, placeDoc, publishWithFiles, updateLeaf } from './ops.js';
import { validate } from './validate.js';

export const MISSIONS = missionsData.missions;
export const LEVELS = missionsData.levels;
export const missionById = (id) => MISSIONS.find((m) => m.id === Number(id));

const BASE_EXCLUDE = (d) => d.decoy || d.irOnly || d.defectOnly || d.generated || d.id === 'd-propname';

// Builds a complete, clean sequence 0000 from the library.
export function buildComplete(project) {
  const s = project.settings;
  s.applicationNumber = '299001';
  const seq = project.sequences[0];
  seq.description = 'Original NDA for Ostrevia (lumiravostat) tablets';
  const leafByDoc = {};
  for (const d of Object.values(project.documents)) {
    if (BASE_EXCLUDE(d)) continue;
    const leaf = placeDoc(project, seq.number, d.id, d.section);
    const tag = tagFromDoc(project, leaf);
    if (tag) leaf.study = tag;
    leafByDoc[d.id] = leaf;
  }
  const { leaf } = addCoverLetter(project, seq.number, true);
  leafByDoc.coverLetter = leaf;
  return leafByDoc;
}

function baseMissionProject(m, difficulty, user) {
  const p = createProject({
    name: `Mission ${m.id}: ${m.title}`,
    productId: m.productId, appType: m.appType, user, missionId: m.id, difficulty,
  });
  p.settings.expertMode = difficulty === 'expert';
  p.mission = { id: m.id, difficulty, startedAt: new Date().toISOString(), minutes: m.minutes?.[difficulty] ?? null, submitted: null };
  return p;
}

export async function seedMission(id, difficulty, user) {
  const m = missionById(id);
  if (m.id === 1) return baseMissionProject(m, difficulty, user);
  if (m.id === 4) return seedMission4(m, difficulty, user);
  if (m.id === 11) return seedMission11(m, difficulty, user);
  throw new Error(`Mission ${id} arrives in a later phase.`);
}

async function seedMission4(m, difficulty, user) {
  const p = baseMissionProject(m, difficulty, user);
  buildComplete(p);
  await publishWithFiles(p, '0000');
  for (const raw of m.extraDocuments) p.documents[raw.id] = makeDoc(raw);
  p.mission.letter = m.letter;
  return p;
}

function seedMission11(m, difficulty, user) {
  const p = baseMissionProject(m, difficulty, user);
  const L = buildComplete(p);
  const seq = p.sequences[0];
  const D = p.documents;
  const defects = [];
  const remove = (leaf) => { seq.leaves = seq.leaves.filter((l) => l.id !== leaf.id); };
  const def = (label, hint, keys) => defects.push({ id: `D${String(defects.length + 1).padStart(2, '0')}`, label, hint, keys });

  remove(L['d-356h']); def('Form FDA 356h missing', 'Module 1.1 is short of the main application form.', ['M1-01:1.1/fda-356h']);
  remove(L.coverLetter); def('Cover letter missing', 'Every sequence opens with a letter in 1.2.', ['M1-02:1.2']);
  p.settings.applicationNumber = ''; def('Application number missing', 'Check the regional metadata.', ['BB-06:applicationNumber']);
  updateLeaf(p, '0000', L['d-qos'].id, { fileName: 'QOS_Final.PDF' }); def('QOS file name in capitals with underscore', 'Look at file names in Module 2.', [`FF-01:${L['d-qos'].id}`]);
  updateLeaf(p, '0000', L['d-s44'].id, { fileName: 'batch analyses.pdf' }); def('Space in a drug substance file name', 'Look at file names in 3.2.S.4.', [`FF-01:${L['d-s44'].id}`]);
  updateLeaf(p, '0000', L['d-276'].id, { fileName: 'synopses-of-individual-studies-hrp-101-102-103-104-201-301-302-303-final.pdf' }); def('Over-long file name', 'One file name in 2.7 is far too long.', [`FF-02:${L['d-276'].id}`]);
  D['d-s32'].pdfVersion = '1.3'; def('Unsupported PDF version', 'One quality document was saved in an old PDF version.', [`PDF-01:${L['d-s32'].id}`]);
  D['d-p53'].secured = true; def('Secured PDF in Module 3', 'A validation report is password-protected.', [`PDF-02:${L['d-p53'].id}`]);
  D['d-5331'].secured = true; def('Secured PDF in Module 5', 'A clinical study report is password-protected.', [`PDF-02:${L['d-5331'].id}`]);
  D['d-266'].fontsEmbedded = false; def('Fonts not embedded', 'A nonclinical summary will not render reliably.', [`PDF-03:${L['d-266'].id}`]);
  D['d-5351b'].bookmarks = 0; def('Long report without bookmarks', 'A 486-page study report has no navigation.', [`PDF-04:${L['d-5351b'].id}`]);
  D['d-qos'].brokenLinks = 3; def('Broken hyperlinks in the QOS', 'Some cross-module links lead nowhere.', [`PDF-05:${L['d-qos'].id}`]);
  D['d-s43'].textSearchable = false; def('Scanned, unsearchable PDF', 'One validation document is an image scan.', [`PDF-06:${L['d-s43'].id}`]);
  updateLeaf(p, '0000', L['d-262'].id, { title: '' }); def('Empty leaf title', 'A Module 2.6 leaf has no title.', [`BB-04:${L['d-262'].id}`]);
  updateLeaf(p, '0000', L['d-p2'].id, { title: 'pharmaceutical-development.pdf' }); def('File name used as leaf title', 'A 3.2.P leaf title reads like a file name.', [`BB-05:${L['d-p2'].id}`]);
  updateLeaf(p, '0000', L['d-p83'].id, { nodeCode: '3.2.P.5.4' }); def('Stability data filed under batch analyses', 'A 3.2.P.8 document sits in 3.2.P.5.', [`FF-04:${L['d-p83'].id}`, 'CT-01:3.2.P.8.3']);
  updateLeaf(p, '0000', L['d-cover'].id, { nodeCode: '2.4' }); def('Clinical overview filed as nonclinical overview', 'Check what sits under 2.4.', [`FF-04:${L['d-cover'].id}`, 'CT-01:2.5']);
  D['d-toc'] = makeDoc({ id: 'd-toc', section: '2.1', title: 'CTD Table of Contents', fileName: 'table-of-contents.pdf', pages: 12, bookmarks: 4, defectOnly: true });
  const tocLeaf = placeDoc(p, '0000', 'd-toc', '2.1'); def('Leaf in 2.1 (not used in eCTD)', 'One heading should never hold a document in eCTD.', [`FF-05:${tocLeaf.id}`]);
  const coarse = placeDoc(p, '0000', 'd-coarse-m3', '3.2.P.3.3'); def('Whole-3.2.P file placed', 'A 290-page file covers many subsections.', [`GR-01:${coarse.id}`]);
  const dup = placeDoc(p, '0000', 'd-s42', '3.2.S.4.2');
  def('Same file placed twice', 'Two leaves resolve to one path in 3.2.S.4.2.', [`BB-02:${dup.id}`]);
  updateLeaf(p, '0000', L['d-s5'].id, { operation: 'replace', target: { seq: '0000', leafId: 'L-unknown' } });
  def('Replace operation in the first sequence', 'Check the operations in 3.2.S.5.', [`LC-04:${L['d-s5'].id}`, `LC-02:${L['d-s5'].id}`]);
  remove(L['d-debar']); def('Debarment certification missing', 'An administrative certification in 1.3 is absent.', ['M1-05:1.3.3']);
  remove(L['d-pi']); def('Draft prescribing information missing', 'Labeling in 1.14.1 is incomplete.', ['M1-07:1.14.1.3']);
  p.settings.substance.manufacturer = ''; def('Drug substance manufacturer attribute blank', 'Repeatable-section attributes are in Project settings.', ['BB-07:substance']);
  remove(L['d-274']); def('Summary of Clinical Safety missing', 'A required 2.7 heading is empty.', ['CT-01:2.7.4']);

  p.mission.defects = defects;
  p.mission.baselineKeys = [...validate(p, '0000').keys];
  return p;
}

export function evaluateMission(project) {
  const id = project.mission?.id ?? project.missionId;
  if (id === 1) return evalM1(project);
  if (id === 4) return evalM4(project);
  if (id === 11) return evalM11(project);
  return null;
}

function scoreOf(checks) {
  const ok = checks.filter((c) => c.ok).length;
  return Math.round((ok / checks.length) * 100);
}

function evalM1(p) {
  const m = missionById(1);
  const seq = seqByNumber(p, '0000');
  const v = validate(p, '0000');
  const has = (prefix) => v.findings.some((f) => f.ruleId.startsWith(prefix));
  const ok = {
    meta: !has('BB-06'),
    m1: !has('M1-'),
    required: !has('CT-01'),
    noHigh: v.counts.High === 0,
    noMedium: v.counts.Medium === 0,
    noDecoys: !seq.leaves.some((l) => docForLeaf(p, l)?.decoy),
    published: seq.status === 'published',
  };
  const checks = m.checks.map((c) => ({ ...c, ok: !!ok[c.id] }));
  return { checks, score: scoreOf(checks), validation: v };
}

function evalM4(p) {
  const m = missionById(4);
  const seq = seqByNumber(p, '0001');
  const v = seq ? validate(p, '0001') : null;
  const leaves = seq?.leaves ?? [];
  const s0 = seqByNumber(p, '0000');
  const leaf0 = (docId) => s0.leaves.find((l) => l.docId === docId);
  const replaced = (newDoc, oldDoc, code) => leaves.some((l) => l.docId === newDoc && l.nodeCode === code && l.operation === 'replace'
    && l.target?.seq === '0000' && l.target?.leafId === leaf0(oldDoc)?.id);
  const allowed = new Set(['1.1', '1.2', '1.11.1', '3.2.P.5.1', '3.2.P.8.3']);
  const ok = {
    seq: !!seq && seq.subType === 'amendment' && seq.submissionType === 'original-application',
    forms: leaves.some((l) => l.nodeCode === '1.1' && docForLeaf(p, l)?.form === 'fda-356h') && leaves.some((l) => l.nodeCode === '1.2'),
    response: leaves.some((l) => l.nodeCode === '1.11.1' && l.docId === 'd-ir-resp'),
    replaceSpec: replaced('d-p51-v2', 'd-p51', '3.2.P.5.1'),
    replaceStab: replaced('d-p83-v2', 'd-p83', '3.2.P.8.3'),
    onlyAsked: !!seq && leaves.length > 0 && leaves.every((l) => allowed.has(l.nodeCode) && l.docId !== 'd-p56-v2'),
    noHigh: !!v && v.counts.High === 0,
    published: seq?.status === 'published',
  };
  const checks = m.checks.map((c) => ({ ...c, ok: !!ok[c.id] }));
  return { checks, score: scoreOf(checks), validation: v };
}

function evalM11(p) {
  const v = validate(p, '0000');
  const defects = (p.mission.defects ?? []).map((d) => ({ ...d, fixed: d.keys.every((k) => !v.keys.has(k)) }));
  const fixed = defects.filter((d) => d.fixed).length;
  const known = new Set((p.mission.defects ?? []).flatMap((d) => d.keys));
  const introduced = v.findings.filter((f) => f.severity !== 'Low' && !known.has(f.key) && !(p.mission.baselineKeys ?? []).includes(f.key));
  const score = Math.max(0, Math.round((fixed / defects.length) * 100) - introduced.length * 2);
  return { defects, fixed, total: defects.length, introduced, score, validation: v };
}
