// Zipped eCTD folder: backbone XML (or the v4.0 submission unit) and the stub PDFs, the way
// the sequence folders would sit on disk. Loaded only when a zip is made. Every PDF carries
// the TRAINING ONLY watermark, and a README at the top says the package is not for submission.
import { zipSync, strToU8 } from 'fflate';
import { publishSequence } from './backbone.js';
import { leafPath, sortedSequences, seqByNumber, docForLeaf, isRetireOp } from './model.js';
import { leafPdf, md5Bytes } from './pdfgen.js';
import { sha256Bytes } from './sha256.js';
import { slug } from './tree.js';

const FIXED = new Date('2026-01-01T00:00:00Z');

const README = (project, seqs, notes) => `TRAINING ONLY - NOT FOR SUBMISSION
====================================

This folder was exported from the eCTD Dossier Builder, a practice platform for regulatory
publishing. Every product, company, document, study and person in it is fictional. The PDFs are
stub files watermarked "TRAINING ONLY"; the XML is modelled on public ICH and regional
specifications and is simplified. Nothing here is suitable for a real submission.

Project:   ${project.name}
Region:    ${project.region} (${project.ectdVersion === 'CTD' ? 'CTD for the online portal, no backbone' : `eCTD ${project.ectdVersion}`})
Exported:  ${new Date().toISOString()}
Sequences: ${seqs.map((s) => `${s.number} (${s.status})`).join(', ')}

${project.ectdVersion === '3.2.2' ? 'DTDs are not bundled. Each util/dtd folder has a note on where the real files come from.\n' : ''}${notes.length ? `Checks:\n${notes.map((n) => `- ${n}`).join('\n')}\n` : 'Checks: every file checksum matches the value recorded in the backbone.\n'}
Built by Khan Gulrez Shagufa Fazal Ahmed. Apache-2.0.
`;

const DTD_NOTE = `The DTDs referenced by the XML in this sequence are not bundled with this training export.
Use the ICH eCTD v3.2.2 DTD and the regional DTDs published by the ICH and the agency concerned.
TRAINING ONLY - NOT FOR SUBMISSION.
`;

// Files of one sequence, as { path relative to the export root, bytes }.
export async function sequenceFiles(project, seqNumber, notes = []) {
  const seq = seqByNumber(project, seqNumber);
  const pkg = publishSequence(project, seqNumber);
  const files = [];
  const add = (path, data) => files.push({ path, bytes: typeof data === 'string' ? strToU8(data) : data });

  if (pkg.v4) {
    const root = String(parseInt(seq.number, 10));
    add(`${root}/submissionunit.xml`, pkg.unit.xml);
    add(`${root}/sha256.txt`, pkg.unit.shaTxt);
    for (const f of pkg.unit.files) {
      if (f.path.startsWith('(')) continue; // reused: referenced, not sent
      const leaf = seq.leaves.find((l) => l.id === f.leafId);
      const bytes = await leafPdf(project, seq.number, leaf);
      if (!bytes) continue;
      const sum = sha256Bytes(bytes);
      if (f.sha256 && sum !== f.sha256) notes.push(`${root}/${f.path}: SHA-256 differs from sha256.txt (${seq.status === 'published' ? 'unexpected' : 'draft: preview hash until published'})`);
      add(`${root}/${f.path}`, bytes);
    }
    return files;
  }

  if (pkg.portal) {
    for (const l of seq.leaves) {
      if (isRetireOp(l.operation)) continue;
      const bytes = await leafPdf(project, seq.number, l);
      if (bytes) add(`${seq.number}/${leafPath(project, l)}`, bytes);
    }
    return files;
  }

  add(`${seq.number}/index.xml`, pkg.index);
  add(`${seq.number}/index-md5.txt`, pkg.md5txt);
  const regional = pkg.log.find((r) => r.node === 'regional');
  if (regional) add(regional.file, pkg.regional);
  for (const f of pkg.stfs) add(`${seq.number}/${f.path}`, f.xml);
  add(`${seq.number}/util/dtd/README.txt`, DTD_NOTE);
  for (const l of seq.leaves) {
    if (isRetireOp(l.operation)) continue;
    const bytes = await leafPdf(project, seq.number, l);
    if (!bytes) continue;
    const row = pkg.log.find((r) => r.leafId === l.id);
    const sum = md5Bytes(bytes);
    if (row && row.checksum !== sum) notes.push(`${seq.number}/${leafPath(project, l)}: MD5 differs from index.xml (${seq.status === 'published' ? 'unexpected' : 'draft: preview checksum until published'})`);
    add(`${seq.number}/${leafPath(project, l)}`, bytes);
  }
  return files;
}

// One zip for the chosen sequences (default: every published one, or all if none are).
export async function dossierZip(project, { sequences = null, onProgress = () => {} } = {}) {
  const all = sortedSequences(project);
  const chosen = sequences ? all.filter((s) => sequences.includes(s.number)) : (all.some((s) => s.status === 'published') ? all.filter((s) => s.status === 'published') : all);
  const notes = [];
  const tree = {};
  const top = slug(project.name, 50) || 'dossier';
  let i = 0;
  for (const s of chosen) {
    onProgress(++i, chosen.length, s.number);
    for (const f of await sequenceFiles(project, s.number, notes)) tree[`${top}/${f.path}`] = [f.bytes, { mtime: FIXED }];
  }
  tree[`${top}/README-TRAINING-ONLY.txt`] = [strToU8(README(project, chosen, notes)), { mtime: FIXED }];
  const zip = zipSync(tree, { level: 6 });
  return { zip, name: `${top}-${chosen.map((s) => s.number).join('-')}.zip`, count: Object.keys(tree).length, notes };
}

export { docForLeaf };
