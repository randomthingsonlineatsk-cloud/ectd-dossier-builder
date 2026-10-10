// Project data model, document library and lifecycle views.
// Every project, mission attempt and score carries userId and classId so classroom mode
// (Phase 4) can be added without changing stored data.
import nceTablet from '../data/products/nce-tablet.json' with { type: 'json' };
import { INDEX, filePath } from './tree.js';

export const SCHEMA_VERSION = 1;
export const PRODUCTS = { 'nce-tablet': nceTablet };

export function uid(prefix = '') {
  const r = (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  return prefix + r.replace(/-/g, '').slice(0, 12);
}

const DOC_DEFAULTS = {
  pdfVersion: '1.7',
  fontsEmbedded: true,
  secured: false,
  textSearchable: true,
  bookmarks: 0,
  links: [],
  brokenLinks: 0,
  version: 1,
  pageSize: 'Letter',
};

export function makeDoc(raw) {
  const d = { ...DOC_DEFAULTS, ...raw };
  d.links = [...(raw.links ?? [])];
  if (d.bookmarks === 0 && d.pages >= 5 && raw.bookmarks === undefined) d.bookmarks = Math.max(2, Math.round(d.pages / 6));
  if (d.sizeKb === undefined) d.sizeKb = Math.round(40 + d.pages * 34);
  return d;
}

export function libraryFor(productId) {
  const p = PRODUCTS[productId];
  const docs = {};
  for (const raw of p.documents) docs[raw.id] = makeDoc(raw);
  return docs;
}

export function defaultSettings(productId) {
  const p = PRODUCTS[productId];
  return {
    applicant: { ...p.applicant },
    applicationNumber: '',
    substance: { name: p.product.inn, manufacturer: p.substanceManufacturer.name },
    product: { name: p.product.brandName, dosageForm: p.product.dosageForm, manufacturer: p.productManufacturer.name },
    indication: p.product.indication,
    sequenceStart: '0000',
    expertMode: false,
  };
}

export function newSequence(number, opts = {}) {
  return {
    id: uid('s'),
    number,
    submissionType: opts.submissionType ?? 'original-application',
    subType: opts.subType ?? 'original',
    description: opts.description ?? '',
    status: 'draft',
    publishedAt: null,
    leaves: [],
  };
}

export function createProject({ name, productId = 'nce-tablet', region = 'US', appType = 'nda', ectdVersion = '3.2.2', user, missionId = null, difficulty = null }) {
  const now = new Date().toISOString();
  const settings = defaultSettings(productId);
  return {
    id: uid('p'),
    schema: SCHEMA_VERSION,
    userId: user?.userId ?? null,
    classId: user?.classId ?? null,
    name: name || 'Untitled dossier',
    productId, region, appType, ectdVersion,
    missionId, difficulty,
    createdAt: now, updatedAt: now,
    settings,
    forms: {},
    documents: libraryFor(productId),
    sequences: [newSequence(settings.sequenceStart)],
    log: [],
  };
}

export function seqByNumber(project, number) {
  return project.sequences.find((s) => s.number === number);
}

export function sortedSequences(project) {
  return [...project.sequences].sort((a, b) => a.number.localeCompare(b.number));
}

// Leaf as it stood for its sequence: published leaves carry a frozen copy of their document.
export function docForLeaf(project, leaf) {
  if (leaf.frozenDoc) return leaf.frozenDoc;
  return leaf.docId ? project.documents[leaf.docId] ?? null : null;
}

export function leafPath(project, leaf) {
  return filePath(leaf.nodeCode, leaf.fileName, project.settings);
}

export function makeLeaf(project, doc, nodeCode, operation = 'new', target = null) {
  return {
    id: uid('L'),
    nodeCode,
    docId: doc ? doc.id : null,
    title: doc ? doc.title : '',
    fileName: doc ? doc.fileName : '',
    operation,
    target,
  };
}

// Applies sequences in order up to and including `uptoNumber`.
// Returns { entries: Map key -> {leaf, seq, status, replacedBy}, byNode: {code: [entry]} }
export function lifecycleState(project, uptoNumber = null) {
  const entries = new Map();
  const seqs = sortedSequences(project).filter((s) => uptoNumber == null || s.number <= uptoNumber);
  for (const s of seqs) {
    for (const leaf of s.leaves) {
      const key = `${s.number}:${leaf.id}`;
      const entry = { key, leaf, seq: s.number, status: 'current', by: null };
      const tKey = leaf.target ? `${leaf.target.seq}:${leaf.target.leafId}` : null;
      const tgt = tKey ? entries.get(tKey) : null;
      if (leaf.operation === 'replace' && tgt && tgt.status === 'current') { tgt.status = 'replaced'; tgt.by = key; }
      if (leaf.operation === 'delete') {
        if (tgt && tgt.status === 'current') { tgt.status = 'deleted'; tgt.by = key; }
        entry.status = 'delete-op';
      }
      entries.set(key, entry);
    }
  }
  const byNode = {};
  for (const e of entries.values()) (byNode[e.leaf.nodeCode] ??= []).push(e);
  return { entries, byNode };
}

export function currentLeaves(project, uptoNumber = null) {
  const { entries } = lifecycleState(project, uptoNumber);
  return [...entries.values()].filter((e) => e.status === 'current');
}

// History of a leaf chain: the leaf plus every leaf that targets it, transitively.
export function historyOf(project, key) {
  const { entries } = lifecycleState(project);
  const chain = [];
  let k = key;
  // walk back to the origin
  for (;;) {
    const e = entries.get(k);
    if (!e || !e.leaf.target) break;
    k = `${e.leaf.target.seq}:${e.leaf.target.leafId}`;
  }
  const visit = (kk) => {
    const e = entries.get(kk);
    if (!e) return;
    chain.push(e);
    for (const other of entries.values()) {
      if (other.leaf.target && `${other.leaf.target.seq}:${other.leaf.target.leafId}` === kk) visit(other.key);
    }
  };
  visit(k);
  return chain;
}

// Completeness per node, for the placeholder view and dossier map.
export function nodeStatus(project, seqNumber, requiredCodes) {
  const cur = currentLeaves(project, seqNumber);
  const filled = new Set(cur.map((e) => e.leaf.nodeCode));
  const status = {};
  for (const code of INDEX.order) {
    const n = INDEX.map[code];
    if (n.children.length) continue;
    if (n.notInEctd) status[code] = 'na';
    else if (filled.has(code)) status[code] = 'filled';
    else if (requiredCodes.has(code)) status[code] = 'required';
    else status[code] = 'optional';
  }
  return status;
}

export function nextSequenceNumber(project) {
  const nums = project.sequences.map((s) => parseInt(s.number, 10)).filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) + 1 : 0);
  return String(next).padStart(4, '0');
}

export function touch(project) {
  project.updatedAt = new Date().toISOString();
  return project;
}

export function coverLetterText(project, seq) {
  const p = PRODUCTS[project.productId];
  const s = project.settings;
  const subLabel = { original: 'original application', amendment: 'amendment', resubmission: 'resubmission', report: 'report', correspondence: 'correspondence', presubmission: 'presubmission' }[seq.subType] ?? seq.subType;
  const lines = [
    `${s.applicant.name}`,
    `${s.applicant.address}`,
    '',
    `Date: [date of dispatch]`,
    '',
    `Re: NDA ${s.applicationNumber || '[application number]'} — ${p.product.brandName} (${p.product.inn}) ${p.product.dosageForm}, ${p.product.strengths.join(' and ')}`,
    `eCTD sequence ${seq.number} — ${subLabel}`,
    '',
    'Dear Review Division,',
    '',
  ];
  if (seq.subType === 'original') {
    lines.push(`${s.applicant.name} submits this original New Drug Application for ${p.product.brandName} (${p.product.inn}) ${p.product.dosageForm}, ${p.product.strengths.join(' and ')}, proposed for the ${p.product.indicationText.charAt(0).toLowerCase() + p.product.indicationText.slice(1)}.`);
    lines.push('', 'The application is provided in eCTD format (v3.2.2) and contains Modules 1 to 5. The user fee coversheet (Form FDA 3397) is included in Module 1.1.');
  } else {
    lines.push(`${s.applicant.name} submits this ${subLabel} to NDA ${s.applicationNumber || '[number]'}. ${seq.description || ''}`.trim());
  }
  lines.push('', `Contact: ${s.applicant.contact}, ${s.applicant.phone}, ${s.applicant.email}`, '', 'Sincerely,', '', s.applicant.contact, '', 'TRAINING ONLY — fictional product and company, not for submission.');
  return lines.join('\n');
}

export function makeCoverLetterDoc(project, seq) {
  return makeDoc({
    id: `gen-cl-${seq.number}-${uid().slice(0, 4)}`,
    section: '1.2',
    title: `Cover Letter — Sequence ${seq.number}`,
    fileName: 'cover-letter.pdf',
    pages: 2,
    generated: true,
    content: coverLetterText(project, seq),
  });
}
