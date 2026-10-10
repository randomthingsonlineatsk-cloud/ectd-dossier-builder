// Rule engine for the eCTD v3.2.2 profiles (US and EU core rules).
import rulesData from '../data/rules.json' with { type: 'json' };
import { INDEX, ancestors, REGION_PACKS, displayCode as dc, inRegion } from './tree.js';
import { docForLeaf, leafPath, lifecycleState, seqByNumber, sortedSequences } from './model.js';
import { needsStudyTag, isValidTag, suggestedStudy } from './stf.js';

export const RULES = Object.fromEntries(rulesData.rules.map((r) => [r.id, r]));
export const REQUIRED = Object.fromEntries(Object.entries(rulesData.required).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, new Set(v)]));
export const SEVERITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const PDF_OK = new Set(['1.4', '1.5', '1.6', '1.7', 'A-1', 'A-2']);
const FILE_RE = /^[a-z0-9][a-z0-9-]*\.pdf$/;

const keysFor = (project, seq) => [`${project.appType}:${seq.submissionType}:${seq.subType}`, `${project.appType}:${seq.subType}`];

export function requiredFor(project, seq) {
  for (const k of keysFor(project, seq)) if (REQUIRED[k]) return REQUIRED[k];
  return new Set();
}

export function m1Checklist(project, seq) {
  const cl = REGION_PACKS[project.region]?.checklist ?? {};
  for (const k of keysFor(project, seq)) if (cl[k]) return cl[k];
  return [];
}

export const profileLabel = (project) => rulesData.profiles[`${project.region}-3.2.2`]?.label ?? project.region;

export function validate(project, seqNumber) {
  const seq = seqByNumber(project, seqNumber);
  const findings = [];
  const add = (ruleId, key, message, extra = {}) => {
    const r = RULES[ruleId];
    findings.push({ ruleId, severity: r.severity, family: r.family, title: r.title, key: `${ruleId}:${key}`, message, ...extra });
  };
  if (!seq) return summarise(findings);

  const seqs = sortedSequences(project);
  const idx = seqs.findIndex((s) => s.id === seq.id);
  const prev = idx > 0 ? seqs[idx - 1] : null;
  const before = prev ? lifecycleState(project, prev.number) : { entries: new Map(), byNode: {} };
  const after = lifecycleState(project, seq.number);
  const isFirst = idx === 0;
  const s = project.settings;

  // Sequence-level
  if (!/^\d{4}$/.test(seq.number)) add('LC-01', 'format', `Sequence number "${seq.number}" is not four digits.`);
  if (project.sequences.filter((x) => x.number === seq.number).length > 1) add('LC-01', 'unique', `Sequence ${seq.number} is used more than once.`);
  if (seq.status !== 'published' && seqs.slice(idx + 1).some((x) => x.status === 'published')) add('LC-01', 'order', `A later sequence is already published; ${seq.number} would arrive out of order.`);

  const eu = project.region === 'EU';
  const m1Root = eu ? 'eu:1' : '1';
  const meta = eu ? [
    ['applicant', s.applicant?.name, 'Applicant name'],
    ['trackingNumber', /^EMEA\/H\/C\/\d{6}$/.test(s.eu?.trackingNumber || '') ? 'ok' : '', 'Procedure tracking number (EMEA/H/C/ plus six digits)'],
    ['uuid', s.eu?.uuid, 'Envelope identifier (UUID)'],
    ['procedureType', s.eu?.procedureType, 'Procedure type'],
    ['inventedName', s.eu?.inventedName, 'Invented name'],
    ['inn', s.eu?.inn, 'INN'],
    ['submissionType', seq.submissionType, 'Submission type'],
    ['subType', seq.subType, 'Submission unit type'],
  ] : [
    ['applicant', s.applicant?.name, 'Applicant name'],
    ['applicationNumber', /^\d{6}$/.test(s.applicationNumber || '') ? 'ok' : '', 'Application number (six digits)'],
    ['submissionType', seq.submissionType, 'Submission type'],
    ['subType', seq.subType, 'Submission sub-type'],
    ['duns', s.applicant?.duns, 'D-U-N-S number'],
  ];
  for (const [k, v, label] of meta) if (!String(v ?? '').trim()) add('BB-06', k, `${label} is missing from the regional metadata.`, { nodeCode: m1Root });

  if (eu) {
    const needsRelated = !['initial', 'reformat'].includes(seq.subType);
    const rel = seq.relatedSequence?.trim();
    if (needsRelated && !rel) add('EU-11', 'missing', `Sequence ${seq.number} (${seq.subType}) has no related sequence.`, { nodeCode: m1Root });
    else if (rel && (!seqByNumber(project, rel) || rel >= seq.number)) add('EU-11', 'invalid', `Related sequence "${rel}" is not an earlier sequence of this application.`, { nodeCode: m1Root });
    else if (rel && !needsRelated) add('EU-11', 'unexpected', `An ${seq.subType} sequence should not name a related sequence.`, { nodeCode: m1Root });
    if (seq.submissionMode !== 'single' && (seq.changes?.length ?? 0) < 2) add('EU-12', 'changes', `Submission mode is ${seq.submissionMode} but ${seq.changes?.length ?? 0} change(s) are listed.`, { nodeCode: m1Root });
  }

  const leaves = seq.leaves;
  if (leaves.some((l) => l.nodeCode.startsWith('3.2.S'))) {
    if (!s.substance?.name?.trim() || !s.substance?.manufacturer?.trim()) add('BB-07', 'substance', '3.2.S is missing its substance or manufacturer attribute.', { nodeCode: '3.2.S' });
  }
  if (leaves.some((l) => l.nodeCode.startsWith('3.2.P'))) {
    if (!s.product?.name?.trim() || !s.product?.dosageForm?.trim() || !s.product?.manufacturer?.trim()) add('BB-07', 'product', '3.2.P is missing its product-name, dosage form or manufacturer attribute.', { nodeCode: '3.2.P' });
  }

  // Duplicate paths
  const paths = {};
  for (const l of leaves) {
    if (l.operation === 'delete') continue;
    const p = leafPath(project, l);
    (paths[p] ??= []).push(l);
  }
  for (const [p, ls] of Object.entries(paths)) {
    if (ls.length > 1) add('BB-02', ls[ls.length - 1].id, `${ls.length} leaves resolve to ${p}.`, { nodeCode: ls[1].nodeCode, leafId: ls[1].id });
  }

  const currentAfterCodes = new Set([...after.entries.values()].filter((e) => e.status === 'current').map((e) => e.leaf.nodeCode));

  for (const l of leaves) {
    const node = INDEX.map[l.nodeCode];
    const doc = docForLeaf(project, l);
    if (!inRegion(l.nodeCode, project.region)) { add('FF-04', l.id, `"${l.title || l.id}" is under ${dc(l.nodeCode)}, which belongs to another region's Module 1.`, { nodeCode: l.nodeCode, leafId: l.id }); continue; }
    const where = { nodeCode: l.nodeCode, leafId: l.id };
    const name = l.title || l.fileName || l.id;

    if (seq.status === 'published' && !l.frozenDoc && l.operation !== 'delete') add('LC-06', l.id, `"${name}" changed after sequence ${seq.number} was published.`, where);

    // Lifecycle
    if (isFirst && l.operation !== 'new') add('LC-04', l.id, `"${name}" uses "${l.operation}" in the first sequence.`, where);
    if (l.operation !== 'new') {
      const t = l.target;
      const tKey = t ? `${t.seq}:${t.leafId}` : null;
      const tEntry = tKey ? before.entries.get(tKey) : null;
      const tSeq = t ? seqByNumber(project, t.seq) : null;
      if (!t || !tEntry) add('LC-02', l.id, `"${name}" (${l.operation}) has no valid target leaf in an earlier sequence.`, where);
      else if (tEntry.status !== 'current') add('LC-02', l.id, `"${name}" targets a leaf that is already ${tEntry.status}.`, where);
      else if (tSeq && tSeq.status !== 'published') add('LC-02', l.id, `"${name}" targets sequence ${t.seq}, which has not been published.`, where);
      else if (tEntry.leaf.nodeCode !== l.nodeCode) add('LC-03', l.id, `"${name}" is in ${dc(l.nodeCode)} but its target is in ${dc(tEntry.leaf.nodeCode)}.`, where);
    }
    // Forms and cover letters are sent new with every sequence, so they are exempt.
    if (l.operation === 'new' && !isFirst && !['1.1', '1.2', 'eu:1.0', 'eu:1.2'].includes(l.nodeCode)) {
      const dup = (before.byNode[l.nodeCode] ?? []).find((e) => e.status === 'current' && e.leaf.title.trim().toLowerCase() === l.title.trim().toLowerCase());
      if (dup) add('LC-05', l.id, `"${name}" is new but a current leaf with the same title exists from sequence ${dup.seq}.`, where);
    }
    if (l.operation === 'delete') continue;

    // Backbone
    if (!doc) { add('BB-01', l.id, `Leaf "${name}" points to a document that is not in the library.`, where); continue; }
    if (!l.title.trim()) add('BB-04', l.id, `The leaf in ${dc(l.nodeCode)} (${l.fileName}) has no title.`, where);
    else if (/\.pdf$/i.test(l.title.trim()) || l.title.trim().toLowerCase() === l.fileName.toLowerCase()) add('BB-05', l.id, `Leaf title "${l.title}" looks like a file name.`, where);

    // Files and folders
    if (!FILE_RE.test(l.fileName)) add('FF-01', l.id, `File name "${l.fileName}" breaks the naming rule.`, where);
    if (l.fileName.length > 64) add('FF-02', l.id, `File name is ${l.fileName.length} characters.`, where);
    const full = `${seq.number}/${leafPath(project, l)}`;
    if (full.length > 180) add('FF-03', l.id, `Path is ${full.length} characters: ${full}`, where);
    if (node?.notInEctd) add('FF-05', l.id, `"${name}" is placed in ${dc(l.nodeCode)}, which is not used in eCTD.`, where);
    else if (doc.section && !doc.decoy && doc.section !== l.nodeCode) {
      add('FF-04', l.id, `"${name}" belongs in ${dc(doc.section)} but is placed in ${dc(l.nodeCode)}.`, where);
    }

    // PDF
    if (!PDF_OK.has(doc.pdfVersion)) add('PDF-01', l.id, `"${name}" is PDF ${doc.pdfVersion}.`, where);
    if (doc.secured) add('PDF-02', l.id, `"${name}" has document security set.`, where);
    if (!doc.fontsEmbedded) add('PDF-03', l.id, `"${name}" has fonts that are not embedded.`, where);
    if (doc.pages >= 5 && !doc.bookmarks) add('PDF-04', l.id, `"${name}" has ${doc.pages} pages and no bookmarks.`, where);
    const missingTargets = (doc.links ?? []).filter((c) => !currentAfterCodes.has(c));
    if (doc.brokenLinks > 0 || missingTargets.length) {
      const parts = [];
      if (doc.brokenLinks > 0) parts.push(`${doc.brokenLinks} link(s) point to pages that no longer exist`);
      if (missingTargets.length) parts.push(`links to ${missingTargets.map(dc).join(', ')} have no document in the current view`);
      add('PDF-05', l.id, `"${name}": ${parts.join('; ')}.`, where);
    }
    if (!doc.textSearchable) add('PDF-06', l.id, `"${name}" is a scanned image without searchable text.`, where);

    // Study grouping (US v3.2.2 study tagging files)
    if (!eu && needsStudyTag(l.nodeCode)) {
      if (!l.study?.id?.trim()) add('SG-01', l.id, `"${name}" in ${dc(l.nodeCode)} has no study ID or file tag.`, where);
      else {
        if (!isValidTag(l.nodeCode, l.study.tag)) add('SG-02', l.id, `"${name}" has file tag "${l.study.tag || '(none)'}", which is not valid for Module ${l.nodeCode[0]}.`, where);
        const sug = suggestedStudy(doc);
        if (sug && sug !== l.study.id.trim()) add('SG-03', l.id, `"${name}" reports study ${sug} but is tagged as ${l.study.id}.`, where);
      }
    }

    // EU Module 1 file naming: country folder code first (ema-..., common-...)
    if (eu && node?.isM1 && node.country) {
      const cc = node.country.split('/')[0];
      if (!l.fileName.startsWith(`${cc}-`)) add('EU-10', l.id, `"${l.fileName}" in ${dc(l.nodeCode)} should start with "${cc}-".`, where);
    }

    // Granularity
    if (doc.decoy === 'coarse') add('GR-01', l.id, `"${name}" bundles several CTD subsections into one file.`, where);
    if (doc.decoy === 'fine') add('GR-02', l.id, `"${name}" splits ${dc(doc.section)} finer than ICH granularity expects.`, where);
  }

  // Module 1 checklist (this sequence only)
  for (const item of m1Checklist(project, seq)) {
    if (!item.rule) continue;
    const ok = leaves.some((l) => {
      if (l.operation === 'delete' || l.nodeCode !== item.section) return false;
      if (!item.form) return true;
      const d = docForLeaf(project, l);
      return d?.form === item.form;
    });
    if (!ok) add(item.rule, `${item.section}${item.form ? '/' + item.form : ''}`, `${item.label} is missing from ${dc(item.section)}.`, { nodeCode: item.section });
  }

  if (eu && seq.subType === 'response' && !leaves.some((l) => l.nodeCode === 'eu:responses' && l.operation !== 'delete')) {
    add('EU-09', 'responses', 'This response sequence has no responses document.', { nodeCode: 'eu:responses' });
  }

  // Content completeness (current view after this sequence)
  for (const code of requiredFor(project, seq)) {
    if (!currentAfterCodes.has(code)) add('CT-01', code, `${dc(code)} ${INDEX.map[code]?.title ?? ''} has no document.`, { nodeCode: code });
  }

  return summarise(findings);
}

function summarise(findings) {
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.ruleId.localeCompare(b.ruleId));
  const counts = { High: 0, Medium: 0, Low: 0 };
  for (const f of findings) counts[f.severity]++;
  let verdict;
  if (counts.High) verdict = { level: 'reject', text: `Likely technical rejection: ${counts.High} high-severity finding${counts.High > 1 ? 's' : ''} would stop this sequence before review starts.` };
  else if (counts.Medium) verdict = { level: 'warn', text: `Likely to pass the technical check, but ${counts.Medium} medium finding${counts.Medium > 1 ? 's' : ''} may draw agency comments. Fix before sending.` };
  else if (counts.Low) verdict = { level: 'ok', text: 'Technically clean, with minor best-practice notes.' };
  else verdict = { level: 'ok', text: 'Technically clean: no findings.' };
  return { findings, counts, verdict, keys: new Set(findings.map((f) => f.key)) };
}

export function nodeHasFinding(result, code) {
  return result.findings.some((f) => f.nodeCode === code || (f.nodeCode && ancestors(f.nodeCode).some((a) => a.code === code)));
}
