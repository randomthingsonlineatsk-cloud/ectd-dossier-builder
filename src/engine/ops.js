// Mutating operations on a project (callers pass a clone).
import { isPlaceable, inRegion, displayCode } from './tree.js';
import { docForLeaf, makeCoverLetterDoc, makeLeaf, newSequence, nextSequenceNumber, seqByNumber, touch } from './model.js';
import { publishSequence } from './backbone.js';
import { validate } from './validate.js';

export function assertEditable(seq) {
  if (!seq) throw new Error('No sequence selected.');
  if (seq.status === 'published') throw new Error(`Sequence ${seq.number} is published and frozen. Create a new sequence for changes.`);
}

export function placeDoc(project, seqNumber, docId, nodeCode, operation = 'new', target = null) {
  const seq = seqByNumber(project, seqNumber);
  assertEditable(seq);
  if (!inRegion(nodeCode, project.region)) throw new Error(`${displayCode(nodeCode)} is not part of the ${project.region} dossier.`);
  if (!isPlaceable(nodeCode)) throw new Error(`${displayCode(nodeCode)} has sub-headings; place documents at the lowest level.`);
  const doc = project.documents[docId];
  const leaf = makeLeaf(project, doc, nodeCode, operation, target);
  seq.leaves.push(leaf);
  touch(project);
  return leaf;
}

// Retires a current leaf: 'delete' in v3.2.2, 'suspend' (statusCode suspended) in v4.0.
export function addDeleteLeaf(project, seqNumber, target, operation = project.ectdVersion === '4.0' ? 'suspend' : 'delete') {
  const seq = seqByNumber(project, seqNumber);
  assertEditable(seq);
  const leaf = makeLeaf(project, null, target.nodeCode, operation, { seq: target.seq, leafId: target.leafId });
  leaf.title = target.title ?? '';
  seq.leaves.push(leaf);
  touch(project);
  return leaf;
}

export function findLeaf(project, seqNumber, leafId) {
  const seq = seqByNumber(project, seqNumber);
  return { seq, leaf: seq?.leaves.find((l) => l.id === leafId) };
}

export function moveLeaf(project, seqNumber, leafId, nodeCode) {
  const { seq, leaf } = findLeaf(project, seqNumber, leafId);
  assertEditable(seq);
  if (!isPlaceable(nodeCode)) throw new Error(`${displayCode(nodeCode)} has sub-headings; place documents at the lowest level.`);
  leaf.nodeCode = nodeCode;
  touch(project);
}

export function removeLeaf(project, seqNumber, leafId) {
  const { seq } = findLeaf(project, seqNumber, leafId);
  assertEditable(seq);
  seq.leaves = seq.leaves.filter((l) => l.id !== leafId);
  touch(project);
}

export function updateLeaf(project, seqNumber, leafId, patch) {
  const { seq, leaf } = findLeaf(project, seqNumber, leafId);
  assertEditable(seq);
  Object.assign(leaf, patch);
  touch(project);
}

// "Publishing tool" fixes on a document's PDF properties.
export const PDF_FIXES = {
  version: { label: 'Re-save as PDF 1.7', apply: (d) => { d.pdfVersion = '1.7'; } },
  security: { label: 'Remove document security', apply: (d) => { d.secured = false; } },
  fonts: { label: 'Re-render with fonts embedded', apply: (d) => { d.fontsEmbedded = true; } },
  bookmarks: { label: 'Auto-bookmark from headings', apply: (d) => { d.bookmarks = Math.max(2, Math.round(d.pages / 6)); } },
  links: { label: 'Repair broken hyperlinks', apply: (d) => { d.brokenLinks = 0; } },
  ocr: { label: 'Run OCR (make text searchable)', apply: (d) => { d.textSearchable = true; } },
};

export function fixDoc(project, docId, fixId) {
  const d = project.documents[docId];
  PDF_FIXES[fixId].apply(d);
  touch(project);
}

export function addCoverLetter(project, seqNumber, place = true) {
  const seq = seqByNumber(project, seqNumber);
  assertEditable(seq);
  const doc = makeCoverLetterDoc(project, seq);
  project.documents[doc.id] = doc;
  let leaf = null;
  if (place) leaf = placeDoc(project, seqNumber, doc.id, doc.section);
  return { doc, leaf };
}

export function createSequence(project, opts = {}) {
  const number = opts.number ?? nextSequenceNumber(project);
  if (project.sequences.some((s) => s.number === number)) throw new Error(`Sequence ${number} already exists.`);
  const seq = newSequence(number, opts, project.region);
  project.sequences.push(seq);
  touch(project);
  return seq;
}

export function deleteSequence(project, seqNumber) {
  const seq = seqByNumber(project, seqNumber);
  assertEditable(seq);
  if (project.sequences.length === 1) throw new Error('A project needs at least one sequence.');
  project.sequences = project.sequences.filter((s) => s.id !== seq.id);
  touch(project);
}

export function publish(project, seqNumber) {
  const seq = seqByNumber(project, seqNumber);
  assertEditable(seq);
  const result = validate(project, seqNumber);
  const pkg = publishSequence(project, seqNumber);
  for (const l of seq.leaves) {
    const d = docForLeaf(project, l);
    if (d) l.frozenDoc = structuredClone(d);
  }
  seq.status = 'published';
  seq.publishedAt = new Date().toISOString();
  seq.publishSummary = { counts: result.counts, verdict: result.verdict, indexChecksum: pkg.log[0].checksum };
  touch(project);
  return { result, pkg };
}

// Generates the sequence's PDF files, records their real MD5 checksums, then publishes.
export async function publishWithFiles(project, seqNumber) {
  assertEditable(seqByNumber(project, seqNumber));
  const { computeSequenceChecksums } = await import('./pdfgen.js');
  await computeSequenceChecksums(project, seqNumber);
  return publish(project, seqNumber);
}

export const addSuspendLeaf = (project, seqNumber, target) => addDeleteLeaf(project, seqNumber, target, 'suspend');
