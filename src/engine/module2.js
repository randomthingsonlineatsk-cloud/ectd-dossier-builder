// Module 2 Summary Writer (Phase 6A): the Module 2 outline, the source values a summary may quote,
// linked fields, the claim checker and placing a written summary in the CTD tree.
//
// A linked field is written into the text as ⟦source-id=value⟧: the value as it was when it was
// inserted. If the source later changes, the field is stale. Plain numbers in the text are
// claims too: the checker finds them by the words around them and compares them with Module 3.
import outline from '../data/module2.json' with { type: 'json' };
import { PRODUCTS, makeDoc, seqByNumber, lifecycleState, docForLeaf, touch, isRetireOp } from './model.js';
import { factsForDoc } from './consistency.js';
import { placeDoc, updateLeaf } from './ops.js';

export const M2 = outline;
export const WORDS_PER_PAGE = outline.wordsPerPage;
export const m2Doc = (code) => outline.docs.find((d) => d.code === code);
export const BUILT = outline.docs.filter((d) => d.phase === '6A').map((d) => d.code);
const FIELD = /⟦([a-z0-9-]+)=([^⟧]*)⟧/g;

// ---------------------------------------------------------------- sources
// Each source value lives in a Module 3 leaf. A value that a document in the current view states
// differently (a planted contradiction, a later correction) is read from that document's facts,
// so the sources follow the dossier, not just the product file.
export function sources(project) {
  const prod = PRODUCTS[project.productId];
  const list = (prod.m2sources ?? []).map((s) => ({ ...s }));
  // A Module 3 document that states a fact differently (a planted contradiction) is noted on the
  // source, so the writer sees that Module 3 itself disagrees.
  for (const s of list) {
    if (!s.fact) continue;
    const d = Object.values(project.documents).find((x) => x.section === s.leaf && !x.decoy && x.factOverrides?.[s.fact] && factsForDoc(project, x)[s.fact] !== prod.facts?.[s.fact]);
    if (d) s.overriddenBy = d.id;
  }
  return list;
}
export const sourceById = (project, id) => sources(project).find((s) => s.id === id);

// ---------------------------------------------------------------- authored documents
export function blankDoc(project, code) {
  const d = m2Doc(code);
  return { code, title: d.title, version: 1, sections: Object.fromEntries((d.headings ?? []).map((h) => [h.code, { text: '', na: false, reason: '' }])), userId: project.userId, classId: project.classId ?? null, updatedAt: new Date().toISOString() };
}
export function getDoc(project, code) {
  project.module2 ??= { docs: {} };
  project.module2.docs[code] ??= blankDoc(project, code);
  return project.module2.docs[code];
}
export const fieldToken = (s) => `⟦${s.id}=${s.value}⟧`;
export const renderText = (text) => text.replace(FIELD, (_, _id, v) => v);
export const fieldsIn = (text) => [...text.matchAll(FIELD)].map((m) => ({ id: m[1], value: m[2] }));
const plainOf = (text) => text.replace(FIELD, ' ');
export const words = (text) => renderText(text).split(/\s+/).filter(Boolean).length;
export function docWords(doc) { return Object.values(doc.sections).reduce((n, s) => n + (s.na ? 0 : words(s.text)), 0); }
export function targetPages(project, code) {
  const d = m2Doc(code);
  return ['mab-infusion', 'biosimilar-mab'].includes(project.productId) && d.targetPagesBiologic ? d.targetPagesBiologic : d.targetPages;
}

// ---------------------------------------------------------------- extraction
const num = (s) => String(Number(s));
const EXTRACT = {
  range: (t) => { const m = /(\d+(?:\.\d+)?)\s*%?\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)\s*%/.exec(t); return m && `${Number(m[1]).toFixed(1)}–${Number(m[2]).toFixed(1)}%`; },
  nmt: (t) => { const m = /(?:NMT|not more than|≤|no more than)\s*(\d+(?:\.\d+)?)\s*%/i.exec(t); return m && `NMT ${m[1]}%`; },
  um: (t) => { const m = /(?:NMT|not more than|≤)?\s*(\d+(?:\.\d+)?)\s*(?:µm|μm|um|microns?)/i.exec(t); return m && `NMT ${num(m[1])} µm`; },
  months: (t) => { const m = /(\d+)\s*months?/i.exec(t); return m && `${m[1]} months`; },
  rh: (t) => { const m = /(\d+)\s*°\s*C\s*\/\s*(\d+)\s*%\s*RH/i.exec(t); return m && `${m[1]}°C/${m[2]}% RH`; },
  temp: (t) => {
    let m = /(\d+)\s*°\s*C\s*(?:to|–|-)\s*(\d+)\s*°\s*C/.exec(t); if (m) return `${m[1]}°C to ${m[2]}°C`;
    m = /(?:below|not above|up to|at or below|under)\s*(\d+)\s*°\s*C/i.exec(t); return m && `below ${m[1]}°C`;
  },
  q: (t) => { const m = /Q\s*=?\s*(\d+)\s*%\s*(?:in|at|within)\s*(\d+)\s*min/i.exec(t); return m && `Q = ${m[1]}% in ${m[2]} minutes`; },
  strengths: (t) => { const m = /(\d+(?:\.\d+)?)\s*mg\s*(?:and|,|or)\s*(\d+(?:\.\d+)?)\s*mg/i.exec(t); return m && `${m[1]} mg and ${m[2]} mg`; },
  batches: (t) => { const b = [...t.matchAll(/\bHR-\d{4}\b/g)].map((x) => x[0]); return b.length ? [...new Set(b)].sort().join(', ') : null; },
  count: (t) => { const m = /(\d{1,3}(?:,\d{3})+|\d+)\s*tablets/i.exec(t); return m && `${m[1]} tablets`; },
  steps: (t) => { const m = /(\d+|one|two|three|four|five|six|seven|eight)[- ]steps?\b/i.exec(t); if (!m) return null; const w = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }; return String(w[m[1].toLowerCase()] ?? m[1]); },
  formula: (t) => { const m = /\b(C\d+H\d+[A-Z][A-Za-z0-9]*)\b/.exec(t); return m && m[1]; },
  mw: (t) => { const m = /(\d+(?:\.\d+)?)\s*g\/mol/.exec(t); return m && `${m[1]} g/mol`; },
  pka: (t) => { const m = /pKa\s*(?:of|is|=|:)?\s*(?:about\s*)?(\d+(?:\.\d+)?)/i.exec(t); return m && m[1]; },
  polymorph: (t) => { const m = /\bForm\s+([A-Z]|I{1,3}|IV)\b/.exec(t); return m && `Form ${m[1]}`; },
};
// Values written as words or names: the source's own words must appear, and a known alternative
// must not.
const KNOWN = {
  company: ['Corvane Fine Chemicals', 'Halcyon Ridge Manufacturing', 'Halcyon Ridge Pharmaceuticals', 'Brightwater Synthesis', 'Northgate Contract Manufacturing'],
  process: ['direct compression', 'wet granulation', 'dry granulation', 'roller compaction', 'hot-melt extrusion'],
  container: ['high-density polyethylene bottles', 'blisters', 'aluminium/aluminium blisters', 'PVC/aluminium blisters', 'glass bottles'],
};
function wordCheck(s, sentence) {
  const t = sentence.toLowerCase();
  if (s.type === 'company') {
    const named = KNOWN.company.filter((c) => t.includes(c.toLowerCase()));
    if (!named.length) return null;
    const own = s.value.split(',')[0].toLowerCase();
    return named.some((c) => own.startsWith(c.toLowerCase())) ? s.value : named[0];
  }
  if (s.type === 'process') { const hit = KNOWN.process.find((c) => t.includes(c)); return hit ?? null; }
  if (s.id === 'p-container') { if (/blister/.test(t)) return 'blisters'; if (/bottle/.test(t)) return /high-density polyethylene|hdpe/.test(t) ? s.value : 'bottles of another material'; return null; }
  if (s.id === 's-container') return /drum|bag/.test(t) ? (/polyethylene/.test(t) ? s.value : 'another container') : null;
  if (s.type === 'excipients') {
    const want = s.value.split(', ');
    const known = [...want, 'lactose monohydrate', 'povidone', 'sodium starch glycolate', 'colloidal silicon dioxide', 'mannitol', 'talc'];
    const said = known.filter((e) => t.includes(e));
    if (!said.length) return null;
    const extra = said.filter((e) => !want.includes(e));
    return extra.length ? `${s.value} (and ${extra.join(', ')})` : s.value;
  }
  return null;
}
const SENT = /(?<=[.;!?])\s+(?=[A-Z(])|\n+/;
const sentences = (text) => plainOf(text).split(SENT).map((x) => x.trim()).filter(Boolean);
const scoped = (s, headingCode) => headingCode.startsWith(s.scope) || (s.scope === '2.' && headingCode.startsWith('2.'));

// Every value a sentence states for the sources in scope.
export function claimsIn(project, headingCode, text, list = sources(project)) {
  const out = [];
  for (const sen of sentences(text)) {
    const low = sen.toLowerCase();
    for (const s of list) {
      const extractable = EXTRACT[s.type] || ['company', 'process', 'excipients'].includes(s.type) || ['p-container', 's-container'].includes(s.id);
      if (!extractable || !scoped(s, headingCode)) continue;
      if (!s.near.some((n) => low.includes(n.toLowerCase()))) continue;
      const said = EXTRACT[s.type] ? EXTRACT[s.type](sen) : wordCheck(s, sen);
      if (said == null) continue;
      out.push({ source: s, said, sentence: sen, ok: said === s.value });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the checker
// C1 a number with units that no source holds · C2 a value that differs from its source (or a
// linked field that is out of date) · C3 a storage or stability condition that differs · C12 a
// heading marked not applicable without a good reason · plus empty required headings, links and
// length.
const UNIT = /(\d+(?:\.\d+)?)\s*(%|mg|months?|°\s*C|µm|minutes?|g\/mol)/g;
export function checkDoc(project, doc) {
  const list = sources(project);
  const all = new Set(list.flatMap((s) => [s.value, ...(s.value.match(/\d+(?:\.\d+)?/g) ?? [])]));
  const findings = [];
  const add = (code, heading, severity, message, extra = {}) => findings.push({ code, heading, severity, message, ...extra });
  const out = m2Doc(doc.code);
  for (const h of out.headings ?? []) {
    const sec = doc.sections[h.code] ?? { text: '', na: false };
    const required = h.required || (h.requiredFor ?? []).includes(project.productId);
    if (sec.na) {
      if (required) add('C12', h.code, 'error', `${h.title} cannot be marked not applicable for this product.`);
      else if ((sec.reason ?? '').trim().split(/\s+/).length < 4) add('C12', h.code, 'error', `${h.title} is marked not applicable: give the reason.`);
      continue;
    }
    if (!renderText(sec.text).trim()) { if (required) add('C0', h.code, 'error', `${h.title} is empty.`); continue; }
    for (const f of fieldsIn(sec.text)) {
      const s = list.find((x) => x.id === f.id);
      if (!s) add('C2', h.code, 'error', `A linked field points to a source that no longer exists (${f.id}).`, { stale: true });
      else if (s.value !== f.value) add('C2', h.code, 'error', `Linked field out of date: ${s.label} is now ${s.value} in ${s.leaf} (the text says ${f.value}).`, { source: s.id, stale: true });
    }
    const claims = claimsIn(project, h.code, sec.text, list);
    for (const c of claims) {
      if (c.ok) add('W1', h.code, 'warning', `${c.source.label} (${c.said}) is typed, not linked: insert it from ${c.source.leaf} so the reviewer can click through.`, { source: c.source.id, unlinked: true });
      else add(['temp', 'rh'].includes(c.source.type) ? 'C3' : 'C2', h.code, 'error', `${c.source.label}: the text says ${c.said}; ${c.source.leaf} (${c.source.dest}) says ${c.source.value}.`, { source: c.source.id, said: c.said });
    }
    const claimed = new Set(claims.flatMap((c) => [c.said, ...(c.said.match(/\d+(?:\.\d+)?/g) ?? [])]));
    for (const m of plainOf(sec.text).matchAll(UNIT)) {
      if (all.has(m[1]) || claimed.has(m[1]) || all.has(`${m[1]}${m[2]}`)) continue;
      add('C1', h.code, 'error', `"${m[0]}" has no source in Module 3.`, { said: m[0] });
    }
    if (/https?:\/\/|file:\/\/|[A-Z]:\\/.test(sec.text)) add('L2', h.code, 'error', 'The text has an absolute or web link; Module 2 links point to leaves in the dossier.');
  }
  const pages = docWords(doc) / WORDS_PER_PAGE, target = targetPages(project, doc.code);
  if (target && pages > target) add('LEN', null, 'warning', `About ${Math.ceil(pages)} pages against a target of ${target}.`);
  return { findings, errors: findings.filter((f) => f.severity === 'error'), warnings: findings.filter((f) => f.severity === 'warning'), pages: Math.max(1, Math.ceil(pages)), target };
}

// The Module 3 leaves a document links to: every linked field's leaf, and every section number
// the text cites.
export function linksOf(project, doc) {
  const list = sources(project), out = new Set();
  for (const sec of Object.values(doc.sections)) {
    if (sec.na) continue;
    for (const f of fieldsIn(sec.text)) { const s = list.find((x) => x.id === f.id); if (s) out.add(s.leaf); }
    for (const m of plainOf(sec.text).matchAll(/\b(3\.2\.[SPAR](?:\.\d+){0,2})\b/g)) out.add(m[1]);
  }
  return [...out];
}

// ---------------------------------------------------------------- facts for the consistency matrix
// A placed summary states the facts it quotes. Only a value that differs from the product file is
// recorded, in the fact's own wording, so the matrix lights up exactly where the summary is wrong.
const FACT_FORMAT = {
  assay: (v) => `${v.replace('–', '-').replace(/%$/, '')}% of label claim`,
  storage: (v) => `Store at ${v}`,
};
export function statedFacts(project, doc) {
  const out = {};
  const prod = PRODUCTS[project.productId];
  for (const [code, sec] of Object.entries(doc.sections)) {
    if (sec.na) continue;
    for (const c of claimsIn(project, code, sec.text)) {
      const k = c.source.fact; if (!k || c.ok || out[k]) continue;
      const v = (FACT_FORMAT[k] ?? ((x) => x))(c.said);
      if (v !== prod.facts?.[k]) out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------- placing in the tree
const FILE = { '2.2': 'introduction.pdf', '2.3': 'quality-overall-summary.pdf' };
export function placeSummary(project, seqNumber, code) {
  const seq = seqByNumber(project, seqNumber);
  if (!seq || seq.status === 'published') throw new Error(`Sequence ${seqNumber} is published. Create a new sequence to send the summary.`);
  const doc = getDoc(project, code);
  const chk = checkDoc(project, doc);
  const heads = (m2Doc(code).headings ?? []).filter((h) => !doc.sections[h.code]?.na);
  const prev = Object.values(project.documents).filter((d) => d.m2?.code === code).sort((a, b) => b.version - a.version)[0];
  const version = (prev?.version ?? 0) + 1;
  const id = `m2-${code.replace(/\./g, '')}-v${version}`;
  project.documents[id] = makeDoc({
    id, section: code, title: m2Doc(code).title, fileName: FILE[code] ?? `m2-${code.replace(/\./g, '-')}.pdf`,
    pages: chk.pages + 1, bookmarks: Math.max(2, heads.length), links: linksOf(project, doc), version,
    factOverrides: statedFacts(project, doc),
    m2: { code, version, words: docWords(doc), sections: structuredClone(doc.sections), errors: chk.errors.length, placedAt: new Date().toISOString() },
    userId: project.userId, classId: project.classId ?? null,
  });
  // In this sequence already: point the leaf at the new version. In an earlier sequence: replace it.
  const here = seq.leaves.find((l) => l.nodeCode === code && !isRetireOp(l.operation));
  if (here) updateLeaf(project, seqNumber, here.id, { docId: id, title: project.documents[id].title });
  else {
    const st = lifecycleState(project, seqNumber);
    const earlier = [...st.entries.values()].find((e) => e.status === 'current' && e.leaf.nodeCode === code && e.seq !== seqNumber);
    placeDoc(project, seqNumber, id, code, earlier ? 'replace' : 'new', earlier ? { seq: earlier.seq, leafId: earlier.leaf.id } : null);
  }
  doc.version = version + 1;
  touch(project);
  return { docId: id, errors: chk.errors.length, message: `Placed ${code} ${m2Doc(code).title} (version ${version}) in sequence ${seqNumber}${here ? '' : ''}.` };
}

// The written summaries in the current view, and what the validator says about each.
export function placedSummaries(project, seqNumber) {
  const st = lifecycleState(project, seqNumber);
  return [...st.entries.values()].filter((e) => e.status === 'current').map((e) => ({ entry: e, doc: docForLeaf(project, e.leaf) })).filter((x) => x.doc?.m2);
}
export function checkPlaced(project, doc) {
  return checkDoc(project, { code: doc.m2.code, sections: doc.m2.sections });
}
