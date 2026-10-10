// Project data model, document library and lifecycle views.
// Every project, mission attempt and score carries userId and classId so classroom mode
// (Phase 4) can be added without changing stored data.
import nceTablet from '../data/products/nce-tablet.json' with { type: 'json' };
import genericTablet from '../data/products/generic-tablet.json' with { type: 'json' };
import sterileInjectable from '../data/products/sterile-injectable.json' with { type: 'json' };
import mabInfusion from '../data/products/mab-infusion.json' with { type: 'json' };
import biosimilarMab from '../data/products/biosimilar-mab.json' with { type: 'json' };
import talmisartanEr from '../data/products/talmisartan-er.json' with { type: 'json' };
import { INDEX, filePath, inRegion } from './tree.js';
import { regionDocs, libraryBase } from './regiondocs.js';

// delete (v3.2.2) and suspend (v4.0) both take a leaf out of the current view.
export const isRetireOp = (op) => op === 'delete' || op === 'suspend';
export const SCHEMA_VERSION = 2;
export const PRODUCTS = { 'nce-tablet': nceTablet, 'generic-tablet': genericTablet, 'sterile-injectable': sterileInjectable, 'mab-infusion': mabInfusion, 'biosimilar-mab': biosimilarMab, 'talmisartan-er': talmisartanEr };
export const DEFAULT_APP_TYPE = { US: 'nda', EU: 'maa', JP: 'nda', IN: 'nda' };
export const REGION_VERSION = { US: '3.2.2', EU: '3.2.2', JP: '4.0', IN: 'CTD' };

// Which regions and application types each product supports.
export const productOptions = (productId) => PRODUCTS[productId]?.options ?? [{ region: 'US', appType: 'nda' }];
export const optionKey = (o) => `${o.region}:${o.appType}${o.variant ? `:${o.variant}` : ''}`;
// The product option a project was made from. A variant (IND, DMF, DCP, ASMF...) changes the
// library, settings and requirements while keeping the region's application type.
export function optionFor(productId, region, appType = null, variant = null) {
  const opts = productOptions(productId).filter((o) => o.region === region);
  return opts.find((o) => (!appType || o.appType === appType) && (o.variant ?? null) === (variant ?? null))
    ?? opts.find((o) => !appType || o.appType === appType) ?? opts[0] ?? null;
}
const deepMerge = (a, b) => { for (const [k, v] of Object.entries(b ?? {})) a[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge({ ...(a[k] ?? {}) }, v) : v; return a; };

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

// Region of a library document: explicit, or US for unprefixed Module 1 sections, or shared.
export const docRegion = (d) => d.region ?? (/^1(\.|$)/.test(String(d.section)) ? 'US' : null);

export function libraryFor(productId, region = 'US', opt = null) {
  const p = PRODUCTS[productId];
  const docs = {};
  const base = opt?.library ? libraryBase(p, opt.library) : p.documents;
  for (const raw of [...base, ...regionDocs(p, region, opt)]) {
    const r = docRegion(raw);
    if (r && r !== region) continue;
    if (raw.section && !inRegion(raw.section, region) && !raw.decoy) continue;
    docs[raw.id] = makeDoc(raw);
  }
  return docs;
}

export function defaultSettings(productId, opt = null) {
  const p = PRODUCTS[productId];
  const applicant = opt?.applicantFrom === 'substanceManufacturer' ? { ...p.applicant, ...p.substanceManufacturer, duns: '000000003', contact: p.substanceManufacturer.contact ?? 'Regulatory Affairs Manager', email: p.substanceManufacturer.email ?? 'regulatory@corvane.example' } : { ...p.applicant };
  const out = deepMerge({
    applicant,
    applicationNumber: '',
    substance: { name: p.product.inn, manufacturer: p.substanceManufacturer.name },
    product: { name: p.product.brandName, dosageForm: p.product.dosageForm, manufacturer: p.productManufacturer.name },
    indication: p.product.indication,
    sequenceStart: '0000',
    expertMode: false,
    // EU envelope (eu-regional.xml). The UUID is the same for every sequence of an application.
    eu: {
      procedureType: 'centralised',
      trackingNumber: '',
      uuid: (globalThis.crypto?.randomUUID?.() ?? uid()).toLowerCase(),
      agency: 'EU-EMA',
      inventedName: p.product.brandName,
      inn: p.product.inn,
    },
    // Japan submission unit (eCTD v4.0) and India portal details.
    jp: { receptionNumber: '', brandName: p.product.brandName, janName: p.product.inn, applicantName: p.applicant.name, productCategory: 'jp_1_1' },
    in: { agentName: '', agentAddress: '' },
  }, opt?.settings ?? {});
  if (!out.eu.rms) out.eu.rms = '';
  out.eu.cms ??= [];
  return out;
}

export const SEQ_DEFAULTS = {
  US: { submissionType: 'original-application', subType: 'application' },
  EU: { submissionType: 'maa', subType: 'initial' },
  JP: { submissionType: 'jp_original', subType: 'jp_ctd' },
  IN: { submissionType: 'new-drug-import', subType: 'application' },
};

// For the EU, subType holds the submission unit type; submissionMode and relatedSequence are EU-only.
export function newSequence(number, opts = {}, region = 'US') {
  const d = SEQ_DEFAULTS[region] ?? SEQ_DEFAULTS.US;
  return {
    id: uid('s'),
    number,
    submissionType: opts.submissionType ?? d.submissionType,
    subType: opts.subType ?? d.subType,
    submissionMode: opts.submissionMode ?? 'single',
    relatedSequence: opts.relatedSequence ?? '',
    changes: opts.changes ?? [],
    description: opts.description ?? '',
    status: 'draft',
    publishedAt: null,
    leaves: [],
  };
}

export function createProject({ name, productId = 'nce-tablet', region = 'US', appType = null, variant = null, ectdVersion = null, user, missionId = null, difficulty = null }) {
  ectdVersion ??= REGION_VERSION[region] ?? '3.2.2';
  const opt = optionFor(productId, region, appType, variant);
  appType ??= opt?.appType ?? DEFAULT_APP_TYPE[region];
  variant = opt?.appType === appType ? (opt?.variant ?? null) : null;
  const now = new Date().toISOString();
  const settings = defaultSettings(productId, opt);
  if (ectdVersion === '4.0') settings.sequenceStart = '0001';
  return {
    id: uid('p'),
    schema: SCHEMA_VERSION,
    userId: user?.userId ?? null,
    classId: user?.classId ?? null,
    name: name || 'Untitled dossier',
    productId, region, appType, variant, ectdVersion,
    missionId, difficulty,
    createdAt: now, updatedAt: now,
    settings,
    forms: {},
    documents: libraryFor(productId, region, opt),
    sequences: [newSequence(settings.sequenceStart, opt?.seq ?? {}, region)],
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
  return filePath(leaf.nodeCode, leaf.fileName, project.settings, leaf);
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
    ...(doc?.country ? { country: doc.country } : {}),
    ...(doc?.country && doc?.lang ? { lang: doc.lang } : {}),
    ...(doc?.part ? { part: doc.part } : {}),
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
      if (leaf.operation === 'delete' || leaf.operation === 'suspend') {
        const st = leaf.operation === 'suspend' ? 'suspended' : 'deleted';
        if (tgt && tgt.status === 'current') { tgt.status = st; tgt.by = key; }
        entry.status = `${leaf.operation}-op`;
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
    if (n.children.length || !inRegion(code, project.region)) continue;
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

const APP_LABEL = { nda: 'NDA', anda: 'ANDA', bla: 'BLA', 'bla-351k': 'BLA', maa: 'MAA', ind: 'IND', dmf: 'DMF' };
const lc = (t) => t.charAt(0).toLowerCase() + t.slice(1);

export function coverLetterText(project, seq) {
  const p = PRODUCTS[project.productId];
  const s = project.settings;
  const prod = `${p.product.brandName} (${p.product.inn}) ${p.product.dosageForm}, ${p.product.strengths.join(' and ')}`;
  const contact = ['', `Contact: ${s.applicant.contact}, ${s.applicant.phone}, ${s.applicant.email}`, '', 'Sincerely,', '', s.applicant.contact, '', 'TRAINING ONLY - fictional product and company, not for submission.'];
  const head = [s.applicant.name, s.applicant.address, '', 'Date: [date of dispatch]', ''];
  if (project.region === 'JP') {
    const jp = s.jp ?? {};
    return [...head,
      '[In practice this letter is written in Japanese. English is shown for training.]', '',
      `To: Pharmaceuticals and Medical Devices Agency`,
      `Re: eCTD reception number ${jp.receptionNumber || '[reception number]'} - ${jp.brandName} (${jp.janName})`,
      `Submission unit ${seqIntLocal(seq.number)} - ${seq.description || seq.subType}`, '',
      `${jp.applicantName || s.applicant.name} submits this eCTD v4.0 submission unit for ${prod}.`,
      ...contact].join('\n');
  }
  if (project.region === 'IN' && seq.submissionType === 'clinical-trial') {
    return [...head,
      'To: The Central Licensing Authority',
      `Re: Application in Form CT-04 - permission to conduct a clinical trial of ${p.product.inn}`, '',
      `${s.applicant.name}, through its representative in India${s.in?.agentName ? ` (${s.in.agentName})` : ''}, applies for permission to conduct the enclosed clinical trial of ${p.product.inn} under the New Drugs and Clinical Trials Rules, 2019. The protocol, investigator's brochure, informed consent documents and investigators' undertakings are enclosed; the ethics committee approval will follow.`,
      ...contact].join('\n');
  }
  if (project.region === 'IN') {
    const form = seq.submissionType === 'new-drug-manufacture' ? 'Form CT-21' : 'Form CT-18';
    return [...head,
      'To: The Central Licensing Authority',
      `Re: ${seq.subType === 'query-response' ? 'Response to query' : `Application in ${form}`} - ${prod}`, '',
      seq.subType === 'query-response'
        ? `${s.applicant.name}, through its authorised agent in India${s.in?.agentName ? ` (${s.in.agentName})` : ''}, submits responses to the query letter. ${seq.description || ''}`.trim()
        : `${s.applicant.name}, through its authorised agent in India${s.in?.agentName ? ` (${s.in.agentName})` : ''}, applies for permission to ${seq.submissionType === 'new-drug-manufacture' ? 'manufacture' : 'import'} ${prod} for sale or distribution under the New Drugs and Clinical Trials Rules, 2019. The dossier follows the CTD format with the India Module 1 and is uploaded through the online portal.`,
      ...contact].join('\n');
  }
  if (project.region === 'EU') {
    const eu = s.eu ?? {};
    const unit = seq.subType;
    const lines = [...head,
      `Re: ${eu.trackingNumber || '[procedure number]'} - ${prod}`,
      `eCTD sequence ${seq.number} - submission type ${seq.submissionType}, submission unit ${unit}${seq.relatedSequence ? `, related sequence ${seq.relatedSequence}` : ''}`,
      '', 'Dear Sir or Madam,', ''];
    if (seq.submissionType === 'asmf') {
      lines.push(`${s.applicant.name}, the ASMF holder, submits ${unit === 'initial' ? 'an Active Substance Master File' : `${unit === 'response' ? 'responses for' : 'an update to'} the Active Substance Master File`} for ${p.product.inn} (${eu.trackingNumber || 'ASMF number to be advised'}).`, '', 'The ASMF is one eCTD sequence in which 2.3.S and 3.2.S branch into the applicant\'s part (AP) and the restricted part (RP).', '', 'Annex: letter of access for the marketing authorisation applicant ' + p.applicant.name + ', and administrative details of the ASMF holder.');
    } else if (seq.submissionType === 'maa' && unit === 'initial') {
      const proc = eu.procedureType || 'centralised';
      const states = proc === 'centralised' ? '' : proc === 'national' ? ` in ${(eu.rms || '[member state]').toUpperCase()}` : ` with ${(eu.rms || '[RMS]').toUpperCase()} as reference member state and ${(eu.cms ?? []).map((c) => c.toUpperCase()).join(', ') || '[CMS]'} as concerned member states`;
      lines.push(`${s.applicant.name} submits an application for a marketing authorisation for ${prod} through the ${proc} procedure${states}, for the ${lc(p.product.indicationText)}.`, '', 'The dossier is provided in eCTD format (v3.2.2) with EU Module 1 and Modules 2 to 5. The electronic application form is in Module 1.2.');
    } else if (unit === 'reformat') {
      lines.push(`${s.applicant.name} submits a reformatted baseline of the dossier for ${prod}. This sequence converts previously submitted information to eCTD format and contains no change in content.`);
    } else if (unit === 'response') {
      lines.push(`${s.applicant.name} submits responses to the questions adopted for ${eu.trackingNumber || 'this procedure'}. The responses document is in the Responses section of Module 1 and the updated dossier sections replace those in sequence ${seq.relatedSequence || '[related sequence]'}.`);
    } else {
      lines.push(`${s.applicant.name} submits this ${seq.submissionType} sequence (${unit}) for ${prod}. ${seq.description || ''}`.trim());
    }
    if (seq.changes?.length) lines.push('', 'Changes covered by this submission:', ...seq.changes.map((c, i) => `${i + 1}. ${c.type}: ${c.scope}`));
    return [...lines, ...contact].join('\n');
  }
  const app = APP_LABEL[project.appType] ?? project.appType.toUpperCase();
  const lines = [...head,
    `Re: ${app} ${s.applicationNumber || '[application number]'} - ${prod}`,
    `eCTD sequence ${seq.number} - ${seq.submissionType} / ${seq.subType}`,
    '', 'Dear Review Division,', ''];
  if (seq.submissionType === 'original-application' && seq.subType === 'application') {
    if (project.appType === 'ind') {
      lines.push(`${s.applicant.name} submits this initial Investigational New Drug application for ${p.product.inn}, to begin the first-in-human study described in the enclosed protocol.`, '', 'The IND is provided in eCTD format (v3.2.2). Forms FDA 1571, 1572 and 3674 are in Module 1.1; the introductory statement and general investigational plan are in 1.20 and the investigator\'s brochure in 1.14.4.1. We understand that the study may not begin until 30 days after FDA receives this IND unless FDA notifies us earlier.');
    } else if (project.appType === 'dmf') {
      lines.push(`${s.applicant.name} submits this Type II Drug Master File for the drug substance ${p.product.inn}, manufactured at ${s.applicant.address}.`, '', 'Statement of commitment: we commit to comply with the statements made in this DMF.', '', 'The DMF is provided in eCTD format (v3.2.2) with Module 1, the quality overall summary for the drug substance and Module 3.2.S. Form FDA 3938 is in Module 1.1.');
    } else if (p.basis === '505(b)(2)') {
      lines.push(`${s.applicant.name} submits this New Drug Application under section 505(b)(2) of the FD&C Act for ${prod}. It relies in part on FDA's finding of safety and effectiveness for ${p.listedDrug?.name ?? 'the listed drug'} and on published literature, bridged by the enclosed relative bioavailability study.`, '', 'The application is provided in eCTD format (v3.2.2). The patent certification for the listed drug is in Module 1.3.5.2.');
    } else if (project.appType === 'anda') {
      lines.push(`${s.applicant.name} submits this Abbreviated New Drug Application for ${prod}, referencing ${p.rld?.name ?? 'the reference listed drug'}.`, '', 'The application is provided in eCTD format (v3.2.2). The generic drug user fee cover sheet is included in Module 1.1.');
    } else {
      lines.push(`${s.applicant.name} submits this original New Drug Application for ${prod}, proposed for the ${lc(p.product.indicationText)}.`, '', 'The application is provided in eCTD format (v3.2.2) and contains Modules 1 to 5. The user fee coversheet (Form FDA 3397) is included in Module 1.1.');
    }
  } else if (seq.submissionType === 'annual-report') {
    lines.push(`${s.applicant.name} submits the annual report for ${app} ${s.applicationNumber || '[number]'}. ${seq.description || ''}`.trim());
  } else {
    lines.push(`${s.applicant.name} submits this ${seq.submissionType.replace(/-/g, ' ')} (${seq.subType}) to ${app} ${s.applicationNumber || '[number]'}. ${seq.description || ''}`.trim());
  }
  return [...lines, ...contact].join('\n');
}

const COVER = {
  US: { section: '1.2', fileName: 'cover-letter.pdf' },
  EU: { section: 'eu:1.0', fileName: 'ema-cover.pdf' },
  JP: { section: 'jp:cover', fileName: 'cover.pdf', lang: 'ja' },
  IN: { section: 'in:1.1', fileName: 'covering-letter.pdf' },
};
export const coverSection = (region) => COVER[region]?.section ?? '1.2';
const seqIntLocal = (n) => String(parseInt(n, 10));

export function makeCoverLetterDoc(project, seq) {
  const c = COVER[project.region] ?? COVER.US;
  return makeDoc({
    id: `gen-cl-${seq.number}-${uid().slice(0, 4)}`,
    section: c.section,
    region: project.region,
    lang: c.lang,
    title: `Cover Letter - ${project.ectdVersion === '4.0' ? 'Submission Unit' : 'Sequence'} ${project.ectdVersion === '4.0' ? seqIntLocal(seq.number) : seq.number}`,
    fileName: project.region === 'EU' && (project.settings.eu?.procedureType ?? 'centralised') !== 'centralised' ? 'common-cover.pdf' : c.fileName,
    pages: 2,
    generated: true,
    content: coverLetterText(project, seq),
  });
}

// Brings projects saved by earlier versions up to date.
export function migrateProject(p) {
  if (!p) return p;
  p.region ??= 'US';
  p.variant ??= null;
  for (const s of p.sequences ?? []) {
    if (s.submissionType === 'original-application' && s.subType === 'original') s.subType = 'application';
    s.submissionMode ??= 'single';
    s.relatedSequence ??= '';
    s.changes ??= [];
  }
  if (p.settings && !p.settings.jp) {
    const prod = PRODUCTS[p.productId];
    p.settings.jp = { receptionNumber: '', brandName: prod?.product.brandName ?? '', janName: prod?.product.inn ?? '', applicantName: prod?.applicant.name ?? '', productCategory: 'jp_1_1' };
    p.settings.in = { agentName: '', agentAddress: '' };
  }
  if (p.settings && !p.settings.eu) {
    const prod = PRODUCTS[p.productId];
    p.settings.eu = { procedureType: 'centralised', trackingNumber: '', uuid: uid().toLowerCase(), agency: 'EU-EMA', inventedName: prod?.product.brandName ?? '', inn: prod?.product.inn ?? '' };
  }
  p.schema = SCHEMA_VERSION;
  return p;
}
