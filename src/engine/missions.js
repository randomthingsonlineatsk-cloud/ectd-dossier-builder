// Mission seeds and scoring (Phase 1: missions 1, 4, 11; Phase 2: 2, 5, 6, 7, 8, 9, 10, 12).
import missionsData from '../data/missions.json' with { type: 'json' };
import { createProject, docForLeaf, makeDoc, seqByNumber, PRODUCTS } from './model.js';
import { tagFromDoc } from './stf.js';
import { addCoverLetter, placeDoc, publishWithFiles, updateLeaf } from './ops.js';
import { validate } from './validate.js';
import { consistencyMatrix } from './consistency.js';

export const MISSIONS = missionsData.missions;
export const LEVELS = missionsData.levels;
export const missionById = (id) => MISSIONS.find((m) => m.id === Number(id));

const BASE_EXCLUDE = (d) => d.decoy || d.irOnly || d.defectOnly || d.generated || d.id === 'd-propname';

// Builds a complete, clean sequence 0000 from the library.
export function buildComplete(project, { exclude = () => false } = {}) {
  const s = project.settings;
  const prod = PRODUCTS[project.productId];
  if (project.region === 'EU') s.eu.trackingNumber = 'EMEA/H/C/006123';
  else if (project.region === 'JP') s.jp.receptionNumber = '2026000123';
  else if (project.region === 'IN') s.in.agentName = 'Kestrel Regulatory Services Pvt. Ltd., Mumbai';
  else s.applicationNumber = project.appType === 'anda' ? '219876' : project.appType.startsWith('bla') ? '761999' : '299001';
  const docs = Object.values(project.documents);
  // Japan: use the Japanese Module 2 where one exists. India: the form that matches the submission type.
  const hasJa = new Set(docs.filter((d) => d.lang === 'ja').map((d) => d.id.replace(/-ja$/, '')));
  const regionSkip = (d) => (project.region === 'JP' && hasJa.has(d.id) && d.lang !== 'ja')
    || (project.region === 'IN' && d.form === (project.sequences[0].submissionType === 'new-drug-manufacture' ? 'ct-18' : 'ct-21'));
  const seq = project.sequences[0];
  seq.description = `${{ EU: 'Initial MAA', JP: 'New drug application', IN: 'New drug application' }[project.region] ?? (project.appType === 'anda' ? 'Original ANDA' : project.appType.startsWith('bla') ? 'Original BLA' : 'Original NDA')} for ${prod.product.brandName} (${prod.product.inn})`;
  const leafByDoc = {};
  for (const d of Object.values(project.documents)) {
    if (BASE_EXCLUDE(d) || exclude(d) || regionSkip(d)) continue;
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
    productId: m.productId, region: m.region === 'EU' ? 'EU' : 'US', appType: m.appType, user, missionId: m.id, difficulty,
  });
  p.settings.expertMode = difficulty === 'expert';
  p.mission = { id: m.id, difficulty, startedAt: new Date().toISOString(), minutes: m.minutes?.[difficulty] ?? null, submitted: null, answers: {} };
  if (m.letter) p.mission.letter = m.letter;
  return p;
}

const addExtras = (p, m) => { for (const raw of m.extraDocuments ?? []) p.documents[raw.id] = makeDoc(raw); };

// An approved product: complete sequence 0000, published, plus the mission's new documents.
async function seedPublished(m, difficulty, user) {
  const p = baseMissionProject(m, difficulty, user);
  buildComplete(p);
  await publishWithFiles(p, '0000');
  addExtras(p, m);
  return p;
}

export async function seedMission(id, difficulty, user) {
  const m = missionById(id);
  if (m.id === 1 || m.id === 12) return baseMissionProject(m, difficulty, user);
  if (m.id === 4) return seedMission4(m, difficulty, user);
  if (m.id === 11) return seedMission11(m, difficulty, user);
  if ([5, 6, 7, 8, 9].includes(m.id)) return seedPublished(m, difficulty, user);
  if (m.id === 2) {
    const p = baseMissionProject(m, difficulty, user);
    for (const pl of m.plant ?? []) if (p.documents[pl.doc]) p.documents[pl.doc].factOverrides = { ...pl.facts };
    return p;
  }
  if (m.id === 10) {
    const p = baseMissionProject(m, difficulty, user);
    p.sequences[0].submissionType = 'none';
    p.sequences[0].subType = 'reformat';
    addExtras(p, m);
    return p;
  }
  throw new Error(`Mission ${id} arrives in a later phase.`);
}

async function seedMission4(m, difficulty, user) {
  return seedPublished(m, difficulty, user);
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
  const fn = { 1: evalM1, 2: evalM2, 4: evalM4, 5: evalM5, 6: evalM6, 7: evalM7, 8: evalM8, 9: evalM9, 10: evalM10, 11: evalM11, 12: evalM12 }[id];
  if (!fn) return null;
  const ev = fn(project);
  ev.axes = axesFor(project, ev);
  return ev;
}

// ---------- helpers for Phase 2 checks ----------
const leavesIn = (p, n) => seqByNumber(p, n)?.leaves ?? [];
const has = (p, n, docId, code, ops = ['new']) => leavesIn(p, n).some((l) => l.docId === docId && l.nodeCode === code && ops.includes(l.operation));
const hasForm = (p, n, code, form) => leavesIn(p, n).some((l) => l.nodeCode === code && l.operation !== 'delete' && (!form || docForLeaf(p, l)?.form === form));
function replaced(p, n, newDoc, oldDoc, code, seq0 = '0000') {
  const old = leavesIn(p, seq0).find((l) => l.docId === oldDoc);
  return !!old && leavesIn(p, n).some((l) => l.docId === newDoc && l.nodeCode === code && l.operation === 'replace' && l.target?.seq === seq0 && l.target?.leafId === old.id);
}
const consistent = (p, n) => seqByNumber(p, n) ? consistencyMatrix(p, n).issues.length === 0 : false;
const quizOk = (p) => {
  const m = missionById(p.mission.id);
  return (m.quiz ?? []).every((q) => p.mission.answers?.[q.id] === q.answer);
};
const pub = (p, n) => seqByNumber(p, n)?.status === 'published';
const onlyIn = (p, n, codes) => { const ls = leavesIn(p, n); return ls.length > 0 && ls.every((l) => codes.includes(l.nodeCode)); };
function finish(id, ok, validation) {
  const m = missionById(id);
  const checks = m.checks.map((c) => ({ ...c, ok: !!ok[c.id] }));
  return { checks, score: scoreOf(checks), validation };
}

function evalBuild(p, id, extra = {}) {
  const seq = seqByNumber(p, '0000');
  const v = validate(p, '0000');
  const hasF = (prefix) => v.findings.some((f) => f.ruleId.startsWith(prefix));
  return finish(id, {
    meta: !hasF('BB-06'),
    m1: !v.findings.some((f) => f.family.startsWith('Module 1') && f.severity !== 'Low'),
    required: !hasF('CT-01'),
    noHigh: v.counts.High === 0,
    noMedium: v.counts.Medium === 0,
    noDecoys: !seq.leaves.some((l) => docForLeaf(p, l)?.decoy),
    consistent: consistent(p, '0000'),
    published: seq.status === 'published',
    quiz: quizOk(p),
    ...extra,
  }, v);
}
const evalM2 = (p) => evalBuild(p, 2);
const evalM12 = (p) => evalBuild(p, 12);

function evalM5(p) {
  const s1 = seqByNumber(p, '0001');
  const v = s1 ? validate(p, '0001') : null;
  return finish(5, {
    seq: s1?.submissionType === 'maa' && s1?.subType === 'response',
    related: s1?.relatedSequence === '0000',
    forms: hasForm(p, '0001', 'eu:1.0'),
    response: has(p, '0001', 'eu-resp-d120', 'eu:responses'),
    replaceSpec: replaced(p, '0001', 'd-p51-v2', 'd-p51', '3.2.P.5.1'),
    replacePi: replaced(p, '0001', 'eu-pi-v2', 'eu-pi', 'eu:1.3.1'),
    consistent: consistent(p, '0001'),
    onlyAsked: onlyIn(p, '0001', ['eu:1.0', 'eu:responses', '3.2.P.5.1', 'eu:1.3.1', '2.3', '3.2.P.5.6']),
    noHigh: !!v && v.counts.High === 0,
    published: pub(p, '0001'),
  }, v);
}

function evalM6(p) {
  const s1 = seqByNumber(p, '0001');
  const v = s1 ? validate(p, '0001') : null;
  return finish(6, {
    quiz: quizOk(p),
    seq: s1?.submissionType === 'chemistry-manufacturing-controls-supplement' && s1?.subType === 'application',
    forms: has(p, '0001', 'd-356h-s1', '1.1') && hasForm(p, '0001', '1.2'),
    replaceP31: replaced(p, '0001', 'd-p31-v2', 'd-p31', '3.2.P.3.1'),
    replaceA1: replaced(p, '0001', 'd-a1-v2', 'd-a1', '3.2.A.1'),
    siteB: has(p, '0001', 'd-p35-siteb', '3.2.P.3.5', ['new', 'append']) && has(p, '0001', 'd-p83-siteb', '3.2.P.8.3', ['new', 'append']),
    consistent: consistent(p, '0001'),
    noHigh: !!v && v.counts.High === 0,
    published: pub(p, '0001'),
  }, v);
}

function evalM7(p) {
  const s1 = seqByNumber(p, '0001');
  const v = s1 ? validate(p, '0001') : null;
  return finish(7, {
    quiz: quizOk(p),
    seq: s1?.submissionType === 'labeling-supplement' && s1?.subType === 'application',
    forms: hasForm(p, '0001', '1.1', 'fda-356h') && hasForm(p, '0001', '1.2'),
    replacePi: replaced(p, '0001', 'd-pi-v2', 'd-pi', '1.14.1.3'),
    replaceAnnot: replaced(p, '0001', 'd-annot-v2', 'd-annot', '1.14.1.2'),
    review: has(p, '0001', 'd-hep-review', '5.3.6'),
    onlyAsked: onlyIn(p, '0001', ['1.1', '1.2', '1.14.1.2', '1.14.1.3', '5.3.6']),
    noHigh: !!v && v.counts.High === 0,
    published: pub(p, '0001'),
  }, v);
}

function evalM8(p) {
  const s1 = seqByNumber(p, '0001');
  const s2 = seqByNumber(p, '0002');
  const v1 = s1 ? validate(p, '0001') : null;
  const v2 = s2 ? validate(p, '0002') : null;
  return finish(8, {
    quiz: quizOk(p),
    ar: s1?.submissionType === 'annual-report' && s1?.subType === 'report' && hasForm(p, '0001', '1.1', 'fda-2252') && hasForm(p, '0001', '1.2'),
    arDocs: [['d-ar-safety', '1.13.3'], ['d-ar-mfg', '1.13.5'], ['d-ar-dist', '1.13.11'], ['d-ar-pmc', '1.13.12']].every(([d, c]) => has(p, '0001', d, c)),
    psr: s2?.submissionType === 'periodic-safety-reports' && s2?.subType === 'report' && hasForm(p, '0002', '1.1', 'fda-2252') && hasForm(p, '0002', '1.2'),
    pader: has(p, '0002', 'd-pader', '5.3.6'),
    noHigh: !!v1 && !!v2 && v1.counts.High === 0 && v2.counts.High === 0,
    published: pub(p, '0001') && pub(p, '0002'),
  }, v2 ?? v1);
}

function evalM9(p) {
  const s1 = seqByNumber(p, '0001');
  const v = s1 ? validate(p, '0001') : null;
  return finish(9, {
    quiz: quizOk(p),
    seq: s1?.submissionType === 'chemistry-manufacturing-controls-supplement' && s1?.subType === 'application',
    forms: hasForm(p, '0001', '1.1', 'fda-356h') && hasForm(p, '0001', '1.2'),
    replaceLoa: replaced(p, '0001', 'd-loa-v2', 'd-loa', '1.4.1'),
    replaceS22: replaced(p, '0001', 'd-s22-v2', 'd-s22', '3.2.S.2.2'),
    batches: has(p, '0001', 'd-s44-post', '3.2.S.4.4', ['new', 'append']),
    noHigh: !!v && v.counts.High === 0,
    published: pub(p, '0001'),
  }, v);
}

function evalM10(p) {
  const s0 = seqByNumber(p, '0000');
  const v = validate(p, '0000');
  return finish(10, {
    seq: s0.subType === 'reformat' && ['none', 'maa'].includes(s0.submissionType),
    forms: hasForm(p, '0000', 'eu:1.0'),
    required: !v.findings.some((f) => f.ruleId === 'CT-01'),
    noLegacy: !s0.leaves.some((l) => ['legacy-s', 'legacy-p'].includes(l.docId)),
    onlyM3: s0.leaves.length > 0 && s0.leaves.every((l) => l.nodeCode.startsWith('3.') || l.nodeCode === 'eu:1.0'),
    noHigh: v.counts.High === 0,
    published: s0.status === 'published',
  }, v);
}

// ---------- four scoring axes ----------
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
export function axesFor(p, ev) {
  const seqs = p.sequences.filter((s) => s.leaves.length);
  const vals = seqs.map((s) => validate(p, s.number));
  const last = [...seqs].sort((a, b) => b.number.localeCompare(a.number))[0];
  const tech = ev.validation ? clamp(100 - ev.validation.counts.High * 30 - ev.validation.counts.Medium * 10 - ev.validation.counts.Low * 2) : 0;
  const lcFindings = vals.reduce((n, v) => n + v.findings.filter((f) => f.family === 'Lifecycle').length, 0);
  const lifecycle = clamp(100 - lcFindings * 25);
  const issues = last ? consistencyMatrix(p, last.number).issues.length : 0;
  const consistency = clamp(100 - issues * 25);
  const m = p.mission ?? {};
  const seconds = m.submitted?.seconds ?? Math.floor((Date.now() - new Date(m.startedAt ?? Date.now()).getTime()) / 1000);
  const limit = (m.minutes ?? 45) * 60;
  const time = clamp(seconds <= limit ? 100 : 100 - ((seconds - limit) / 60) * 5);
  return { technical: tech, lifecycle, consistency, time };
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
