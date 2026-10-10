// Cross-module consistency QC. Documents state structured facts (strengths, shelf life,
// manufacturers, limits, batches, patient numbers...). The matrix compares every
// statement of a fact across the current view and flags the ones that disagree.
import data from '../data/consistency.json' with { type: 'json' };
import { PRODUCTS, docForLeaf, lifecycleState, makeDoc, seqByNumber, touch } from './model.js';
import { INDEX } from './tree.js';

export const FACTS = data.facts;

// Entries are a heading code, optionally with "@form" for a specific form in that heading.
function statesFact(doc, entry) {
  const [sec, form] = entry.split('@');
  if (doc.section !== sec) return false;
  return !form || doc.form === form;
}

export function factsForDoc(project, doc) {
  if (!doc || doc.decoy) return {};
  const prod = PRODUCTS[project.productId];
  const facts = { ...(prod?.facts ?? {}) };
  facts.holder ??= project.settings?.applicant?.name ?? prod?.applicant?.name;
  const out = {};
  for (const f of FACTS) {
    if (!facts[f.key] || doc.factExclude?.includes(f.key)) continue;
    if (f.sections.some((e) => statesFact(doc, e))) out[f.key] = doc.factOverrides?.[f.key] ?? facts[f.key];
  }
  return out;
}

// The reference value for a fact: what most documents say; ties go to Module 3.
function reference(cells) {
  const count = {};
  for (const c of cells) count[c.value] = (count[c.value] ?? 0) + 1;
  const max = Math.max(...Object.values(count));
  const top = Object.keys(count).filter((v) => count[v] === max);
  if (top.length === 1) return top[0];
  const m3 = cells.find((c) => top.includes(c.value) && c.leaf.nodeCode.startsWith('3.'));
  return (m3 ?? cells.find((c) => top.includes(c.value))).value;
}

export function consistencyMatrix(project, seqNumber) {
  const st = lifecycleState(project, seqNumber);
  let current = [...st.entries.values()].filter((e) => e.status === 'current' && e.leaf.operation !== 'delete');
  // Forms are sent fresh with each sequence; only the latest one of each form speaks for the dossier.
  const latestForm = {};
  for (const e of current) {
    const d = docForLeaf(project, e.leaf);
    if (!d?.form) continue;
    const k = `${e.leaf.nodeCode}@${d.form}`;
    if (!latestForm[k] || e.seq > latestForm[k].seq) latestForm[k] = e;
  }
  current = current.filter((e) => {
    const d = docForLeaf(project, e.leaf);
    return !d?.form || latestForm[`${e.leaf.nodeCode}@${d.form}`] === e;
  });
  const rows = [];
  const issues = [];
  for (const f of FACTS) {
    const cells = [];
    for (const e of current) {
      const doc = docForLeaf(project, e.leaf);
      const facts = factsForDoc(project, doc);
      if (f.key in facts) cells.push({ key: `${e.key}|${f.key}`, entryKey: e.key, leaf: e.leaf, seq: e.seq, doc, value: facts[f.key] });
    }
    cells.sort((a, b) => INDEX.order.indexOf(a.leaf.nodeCode) - INDEX.order.indexOf(b.leaf.nodeCode));
    if (!cells.length) continue;
    const ref = reference(cells);
    for (const c of cells) {
      c.ok = c.value === ref;
      c.expected = ref;
      if (!c.ok) issues.push({ fact: f, ...c });
    }
    rows.push({ fact: f, cells, reference: ref, mismatches: cells.filter((c) => !c.ok).length });
  }
  return { rows, issues };
}

// Corrects a contradiction. A document in an editable sequence is revised in place; a
// document already published gets a corrected new version in the library, to be sent
// with a replace operation in a new sequence.
export function correctFact(project, seqNumber, cell) {
  const seq = seqByNumber(project, cell.seq);
  const doc = project.documents[cell.leaf.docId];
  if (!doc) throw new Error('The document is not in the library.');
  if (seq && seq.status !== 'published' && cell.seq === seqNumber) {
    doc.factOverrides = { ...(doc.factOverrides ?? {}) };
    if ((PRODUCTS[project.productId].facts ?? {})[cell.fact.key] === cell.expected) delete doc.factOverrides[cell.fact.key];
    else doc.factOverrides[cell.fact.key] = cell.expected;
    touch(project);
    return { revised: doc.id, message: `Revised "${doc.title}" in sequence ${seqNumber}.` };
  }
  const nextVersion = (doc.version ?? 1) + 1;
  const id = `${doc.id.replace(/-v\d+$/, '')}-v${nextVersion}`;
  const copy = makeDoc({ ...structuredClone(doc), id, version: nextVersion, md5: undefined, md5Key: undefined, note: `Corrected: ${cell.fact.label.toLowerCase()} now reads "${cell.expected}".` });
  copy.factOverrides = { ...(doc.factOverrides ?? {}), [cell.fact.key]: cell.expected };
  project.documents[id] = copy;
  touch(project);
  return { created: id, message: `Created version ${nextVersion} of "${doc.title}" in the library. Send it in a new sequence with a replace operation.` };
}
