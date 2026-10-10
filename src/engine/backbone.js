// Generates the eCTD v3.2.2 backbone for one sequence: index.xml, index-md5.txt,
// m1/us/us-regional.xml, plus a publishing log. Modelled on the public ICH and FDA
// specifications; output is for training only.
import SparkMD5 from 'spark-md5';
import { INDEX, ancestors, REGION_PACKS } from './tree.js';
import { docForLeaf, leafPath, seqByNumber } from './model.js';

export const md5 = (s) => SparkMD5.hash(s);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Deterministic stand-in for the PDF bytes: anything that would change the file changes this.
export function fileContentKey(doc) {
  if (!doc) return '';
  return [doc.id, `v${doc.version}`, doc.pdfVersion, doc.fontsEmbedded, doc.secured, doc.textSearchable,
    doc.bookmarks, doc.pages, doc.brokenLinks, doc.content ?? ''].join('|');
}
export const fileChecksum = (doc) => md5(fileContentKey(doc));

function leafXml(project, seq, leaf, indent, hrefBase = '') {
  const doc = docForLeaf(project, leaf);
  const pad = ' '.repeat(indent);
  const attrs = [`ID="${esc(leaf.id)}"`, `operation="${leaf.operation}"`];
  const isM1 = !!INDEX.map[leaf.nodeCode]?.isM1;
  // Regional XML lives in m1/us/, so its references are relative to that folder.
  if (leaf.target) {
    const ref = isM1 ? `../../../${leaf.target.seq}/m1/us/us-regional.xml` : `../${leaf.target.seq}/index.xml`;
    attrs.push(`modified-file="${ref}#${esc(leaf.target.leafId)}"`);
  }
  if (leaf.operation !== 'delete') {
    const full = leafPath(project, leaf);
    const href = hrefBase + (isM1 ? full.replace(/^m1\/us\//, '') : full);
    attrs.push('checksum-type="md5"', `checksum="${doc ? fileChecksum(doc) : ''}"`, 'xlink:type="simple"', `xlink:href="${esc(href)}"`);
    if (doc) attrs.push(`application-version="PDF ${esc(doc.pdfVersion)}"`);
  }
  attrs.push('xml:lang="en"');
  return `${pad}<leaf ${attrs.join(' ')}>\n${pad}  <title>${esc(leaf.title)}</title>\n${pad}</leaf>`;
}

function repeatAttrs(node, settings) {
  if (node.repeat === 'substance') return ` substance="${esc(settings.substance?.name)}" manufacturer="${esc(settings.substance?.manufacturer)}"`;
  if (node.repeat === 'product') return ` product-name="${esc(settings.product?.name)}" dosageform="${esc(settings.product?.dosageForm)}" manufacturer="${esc(settings.product?.manufacturer)}"`;
  if (node.repeat === 'indication') return ` indication="${esc(settings.indication)}"`;
  return '';
}

// Builds nested elements for the given leaves grouped by node, following tree order.
function nestedXml(project, seq, leaves, rootCode, indent, leafFn) {
  const byNode = {};
  for (const l of leaves) (byNode[l.nodeCode] ??= []).push(l);
  const used = new Set();
  for (const code of Object.keys(byNode)) for (const a of ancestors(code)) used.add(a.code);
  const render = (code, ind) => {
    const n = INDEX.map[code];
    if (!used.has(code) || !n.element) return '';
    const pad = ' '.repeat(ind);
    const inner = [];
    for (const l of byNode[code] ?? []) inner.push(leafFn(l, ind + 2));
    for (const c of n.children) { const r = render(c, ind + 2); if (r) inner.push(r); }
    return `${pad}<${n.element}${repeatAttrs(n, project.settings)}>\n${inner.join('\n')}\n${pad}</${n.element}>`;
  };
  return render(rootCode, indent);
}

export function buildRegionalXml(project, seq) {
  const s = project.settings;
  const m1Leaves = seq.leaves.filter((l) => INDEX.map[l.nodeCode]?.isM1);
  const leafFn = (l, ind) => {
    const doc = docForLeaf(project, l);
    const base = leafXml(project, seq, l, l.nodeCode === '1.1' ? ind + 2 : ind);
    if (l.nodeCode === '1.1') {
      const pad = ' '.repeat(ind);
      return `${pad}<form form-type="${esc(doc?.form ?? 'unspecified')}">\n${base}\n${pad}</form>`;
    }
    return base;
  };
  const m1Body = m1Leaves.length ? nestedXml(project, seq, m1Leaves, '1', 2, leafFn) : '  <m1-regional/>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional content modelled on the public FDA eCTD Module 1 v2.3 structure. Not for submission. -->
<fda-regional:fda-regional xmlns:fda-regional="http://www.ich.org/fda" xmlns:xlink="http://www.w3c.org/1999/xlink" dtd-version="3.3" xml:lang="en">
  <admin>
    <applicant-info>
      <id><dun-and-bradstreet-number>${esc(s.applicant?.duns)}</dun-and-bradstreet-number></id>
      <company-name>${esc(s.applicant?.name)}</company-name>
      <submission-description>${esc(seq.description)}</submission-description>
      <applicant-contacts>
        <applicant-contact>
          <applicant-contact-name contact-type="fdaact2">${esc(s.applicant?.contact)}</applicant-contact-name>
          <telephones><telephone telephone-number-type="fdatnt1">${esc(s.applicant?.phone)}</telephone></telephones>
          <emails><email>${esc(s.applicant?.email)}</email></emails>
        </applicant-contact>
      </applicant-contacts>
    </applicant-info>
    <application-set>
      <application application-containing-files="true">
        <application-information>
          <application-number application-type="${esc(project.appType)}">${esc(s.applicationNumber)}</application-number>
        </application-information>
        <submission-information>
          <submission-id submission-type="${esc(seq.submissionType)}">${esc(String(parseInt(seq.number, 10) + 1))}</submission-id>
          <sequence-number submission-sub-type="${esc(seq.subType)}">${esc(seq.number)}</sequence-number>
        </submission-information>
      </application>
    </application-set>
  </admin>
${m1Body}
</fda-regional:fda-regional>
`;
}

export function buildIndexXml(project, seq, regionalXml) {
  const pack = REGION_PACKS[project.region];
  const regionalLeaf = `    <leaf ID="R${seq.number}" operation="new" checksum-type="md5" checksum="${md5(regionalXml)}" xlink:type="simple" xlink:href="${pack.regionalFile}" xml:lang="en">
      <title>US Regional</title>
    </leaf>`;
  const body = seq.leaves.filter((l) => !INDEX.map[l.nodeCode]?.isM1 && INDEX.map[l.nodeCode]?.element);
  const modules = ['2', '3', '4', '5']
    .map((m) => nestedXml(project, seq, body, m, 2, (l, ind) => leafXml(project, seq, l, ind)))
    .filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional content modelled on the public ICH eCTD v3.2.2 specification. Not for submission. -->
<!DOCTYPE ectd:ectd SYSTEM "util/dtd/ich-ectd-3-2.dtd">
<ectd:ectd xmlns:ectd="http://www.ich.org/ectd" xmlns:xlink="http://www.w3c.org/1999/xlink" dtd-version="3.2">
  <m1-administrative-information-and-prescribing-information>
${regionalLeaf}
  </m1-administrative-information-and-prescribing-information>
${modules.join('\n')}
</ectd:ectd>
`;
}

export function publishSequence(project, seqNumber) {
  const seq = seqByNumber(project, seqNumber);
  const regional = buildRegionalXml(project, seq);
  const index = buildIndexXml(project, seq, regional);
  const md5txt = `${md5(index)}\n`;
  const log = [];
  log.push({ file: `${seq.number}/index.xml`, checksum: md5(index), operation: '—', target: '—', node: 'backbone' });
  log.push({ file: `${seq.number}/index-md5.txt`, checksum: md5(md5txt), operation: '—', target: '—', node: 'backbone checksum' });
  log.push({ file: `${seq.number}/m1/us/us-regional.xml`, checksum: md5(regional), operation: 'new', target: '—', node: 'regional' });
  for (const l of seq.leaves) {
    const doc = docForLeaf(project, l);
    log.push({
      file: l.operation === 'delete' ? '(no file — delete)' : `${seq.number}/${leafPath(project, l)}`,
      checksum: l.operation === 'delete' || !doc ? '—' : fileChecksum(doc),
      operation: l.operation,
      target: l.target ? `${l.target.seq} · ${l.target.leafId}` : '—',
      node: l.nodeCode,
      leafId: l.id,
    });
  }
  const tree = folderTree(project, seq);
  return { regional, index, md5txt, log, tree };
}

// Folder tree (sequence-relative) for the live preview.
export function folderTree(project, seq) {
  const root = { name: seq.number, children: {}, files: [] };
  const add = (path, meta) => {
    const parts = path.split('/');
    const file = parts.pop();
    let cur = root;
    for (const p of parts) cur = (cur.children[p] ??= { name: p, children: {}, files: [] });
    cur.files.push({ name: file, ...meta });
  };
  add('index.xml', { kind: 'xml' });
  add('index-md5.txt', { kind: 'txt' });
  add('m1/us/us-regional.xml', { kind: 'xml' });
  add('util/dtd/ich-ectd-3-2.dtd', { kind: 'dtd' });
  add('util/dtd/us-regional-v3-3.dtd', { kind: 'dtd' });
  for (const l of seq.leaves) if (l.operation !== 'delete') add(leafPath(project, l), { kind: 'pdf', leafId: l.id, node: l.nodeCode, op: l.operation });
  return root;
}
