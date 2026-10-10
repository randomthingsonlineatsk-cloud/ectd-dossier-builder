// Generates the eCTD v3.2.2 backbone for one sequence: index.xml, index-md5.txt,
// m1/us/us-regional.xml, plus a publishing log. Modelled on the public ICH and FDA
// specifications; output is for training only.
import SparkMD5 from 'spark-md5';
import { INDEX, ancestors, REGION_PACKS, euCountry } from './tree.js';
import { docForLeaf, leafPath, seqByNumber, isRetireOp } from './model.js';
import { studyFiles } from './stf.js';
import { buildSubmissionUnit, v4FolderTree, seqInt } from './v4.js';

export const md5 = (s) => SparkMD5.hash(s);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Deterministic stand-in for the PDF bytes: anything that would change the file changes this.
export function fileContentKey(doc) {
  if (!doc) return '';
  return [doc.id, `v${doc.version}`, doc.pdfVersion, doc.fontsEmbedded, doc.secured, doc.textSearchable,
    doc.bookmarks, (doc.bookmarkList ?? []).join('~'), doc.toc ? 'toc' : '', doc.pages, doc.brokenLinks,
    (doc.links ?? []).join(','), doc.title, doc.lang ?? 'en', JSON.stringify(doc.factOverrides ?? {}), doc.content ?? ''].join('|');
}
// Real MD5 of the generated PDF once computed (at publish); a preview hash before that.
export const isRealChecksum = (doc) => !!doc?.md5 && doc.md5Key === fileContentKey(doc);
export const fileChecksum = (doc) => (isRealChecksum(doc) ? doc.md5 : md5(fileContentKey(doc)));

function leafXml(project, seq, leaf, indent, hrefBase = '') {
  const doc = docForLeaf(project, leaf);
  const pad = ' '.repeat(indent);
  const attrs = [`ID="${esc(leaf.id)}"`, `operation="${leaf.operation}"`];
  const isM1 = !!INDEX.map[leaf.nodeCode]?.isM1;
  // Regional XML lives in m1/us/, so its references are relative to that folder.
  if (leaf.target) {
    const regional = REGION_PACKS[INDEX.map[leaf.nodeCode]?.region ?? 'US']?.regionalFile ?? 'm1/us/us-regional.xml';
    const ref = isM1 ? `../../../${leaf.target.seq}/${regional}` : `../${leaf.target.seq}/index.xml`;
    attrs.push(`modified-file="${ref}#${esc(leaf.target.leafId)}"`);
  }
  if (!isRetireOp(leaf.operation)) {
    const full = leafPath(project, leaf);
    const href = hrefBase + (isM1 ? full.replace(/^m1\/[a-z]+\//, '') : full);
    const sum = leaf.stf ? md5(leaf.xml) : doc ? fileChecksum(doc) : '';
    attrs.push('checksum-type="md5"', `checksum="${sum}"`, 'xlink:type="simple"', `xlink:href="${esc(href)}"`);
    if (doc) attrs.push(`application-version="PDF ${esc(doc.pdfVersion)}"`);
  }
  attrs.push(`xml:lang="${esc(leaf.lang ?? 'en')}"`);
  return `${pad}<leaf ${attrs.join(' ')}>\n${pad}  <title>${esc(leaf.title)}</title>\n${pad}</leaf>`;
}

function repeatAttrs(node, settings, part = null) {
  if (node.repeat === 'substance') return ` substance="${esc(settings.substance?.name)}${part ? ` ${part.toUpperCase()}` : ''}" manufacturer="${esc(settings.substance?.manufacturer)}"`;
  if (node.repeat === 'product') return ` product-name="${esc(settings.product?.name)}" dosageform="${esc(settings.product?.dosageForm)}" manufacturer="${esc(settings.product?.manufacturer)}"`;
  if (node.repeat === 'indication') return ` indication="${esc(settings.indication)}"`;
  return '';
}

// Builds nested elements for the given leaves grouped by node, following tree order.
// groupFn(node, leaves, ind) may wrap a node's leaves (EU 'specific' and 'pi-doc' elements).
// A repeatable substance section is written once per ASMF part (applicant's / restricted).
function nestedXml(project, seq, leaves, rootCode, indent, leafFn, groupFn = null) {
  const render = (code, ind, list, part = null) => {
    const n = INDEX.map[code];
    if (!n.element) return '';
    const mine = list.filter((l) => l.nodeCode === code || ancestors(l.nodeCode).some((a) => a.code === code));
    if (!mine.length) return '';
    if (n.repeat === 'substance' && part === null) {
      const parts = [...new Set(mine.map((l) => l.part ?? null))];
      if (parts.length > 1 || parts[0]) return parts.map((pt) => render(code, ind, mine.filter((l) => (l.part ?? null) === pt), pt ?? '')).join('\n');
    }
    const pad = ' '.repeat(ind);
    const own = mine.filter((l) => l.nodeCode === code);
    const inner = groupFn && own.length ? groupFn(n, own, ind + 2) : own.map((l) => leafFn(l, ind + 2));
    for (const c of n.children) { const r = render(c, ind + 2, mine, part); if (r) inner.push(r); }
    return `${pad}<${n.element}${repeatAttrs(n, project.settings, part || null)}>\n${inner.join('\n')}\n${pad}</${n.element}>`;
  };
  return render(rootCode, indent, leaves);
}

export function buildRegionalXml(project, seq) {
  if (project.region === 'EU') return buildEuRegionalXml(project, seq);
  if (project.region === 'CA') return buildCaRegionalXml(project, seq);
  if (project.region === 'CH') return buildChRegionalXml(project, seq);
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

// Canada: ca-regional.xml carries the regulatory transaction information.
function buildCaRegionalXml(project, seq) {
  const s = project.settings;
  const ca = s.ca ?? {};
  const pack = REGION_PACKS.CA;
  const desc = pack.submissionSubTypes.find((t) => t.value === seq.subType)?.label ?? seq.subType;
  const m1Leaves = seq.leaves.filter((l) => INDEX.map[l.nodeCode]?.isM1);
  const m1Body = m1Leaves.length ? nestedXml(project, seq, m1Leaves, 'ca:1', 2, (l, ind) => leafXml(project, seq, l, ind)) : '  <m1-ca/>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional content modelled on Health Canada's guidance on the Canadian Module 1 backbone. Element names are simplified. Not for submission. -->
<ca-regional:ca-regional xmlns:ca-regional="http://www.hc-sc.gc.ca/ectd" xmlns:xlink="http://www.w3c.org/1999/xlink" xml:lang="en">
  <ectd-regulatory-transaction-information>
    <applicant>${esc(s.applicant?.name)}</applicant>
    <product-name>${esc(s.product?.name)}</product-name>
    <dossier-identifier>${esc(ca.dossierId)}</dossier-identifier>
    <dossier-type>${esc(ca.dossierType)}</dossier-type>
    <regulatory-activity-type>${esc(seq.submissionType.toUpperCase())}</regulatory-activity-type>
    <regulatory-activity-lead>${esc(ca.activityLead)}</regulatory-activity-lead>
    <sequence-number>${esc(seq.number)}</sequence-number>
    <sequence-description>${esc(desc)}</sequence-description>
${seq.relatedSequence ? `    <related-sequence-number>${esc(seq.relatedSequence)}</related-sequence-number>\n` : ''}  </ectd-regulatory-transaction-information>
${m1Body}
</ca-regional:ca-regional>
`;
}

// Switzerland: ch-regional.xml with the Swiss envelope.
function buildChRegionalXml(project, seq) {
  const s = project.settings;
  const ch = s.ch ?? {};
  const m1Leaves = seq.leaves.filter((l) => INDEX.map[l.nodeCode]?.isM1);
  const m1Body = m1Leaves.length ? nestedXml(project, seq, m1Leaves, 'ch:1', 2, (l, ind) => leafXml(project, seq, l, ind)) : '  <m1-ch/>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional content modelled on the Swiss Module 1 Specification for eCTD (v1.6). Simplified. Not for submission. -->
<ch-backbone xmlns:xlink="http://www.w3c.org/1999/xlink" xml:lang="en">
  <ch-envelope country="ch">
    <application-number>${esc(ch.applicationNumber || 'pending')}</application-number>
    <submission-description>${esc(seq.description)}</submission-description>
    <invented-name>${esc(s.product?.name)}</invented-name>
    <galenic-form name="${esc(ch.galenicFolder)}">
      <swissmedic-number>${esc(ch.swissmedicNumber || 'pending')}</swissmedic-number>
      <galenic-name language="${esc(ch.galenicLang || 'de')}">${esc(ch.galenicName)}</galenic-name>
    </galenic-form>
    <dmf-number>n/a</dmf-number>
    <pmf-number>n/a</pmf-number>
    <inn>${esc(s.substance?.name)}</inn>
    <applicant>${esc(s.applicant?.name)}</applicant>
    <dmf-holder>n/a</dmf-holder>
    <pmf-holder>n/a</pmf-holder>
    <agency>Swissmedic</agency>
    <application type="${esc(seq.submissionType)}"/>
    <article-13-tpa>${esc(ch.article13 === 'yes' ? 'yes' : 'no')}</article-13-tpa>
    <ectd-sequence>${esc(seq.number)}</ectd-sequence>
    <related-ectd-sequence>${esc(seq.relatedSequence || 'none')}</related-ectd-sequence>
  </ch-envelope>
${m1Body}
</ch-backbone>
`;
}

// Receiving member states: the agency in the centralised procedure, otherwise the RMS and CMSs.
export const EU_AGENCY = { nl: 'NL-MEB', de: 'DE-BfArM', fr: 'FR-ANSM', ie: 'IE-HPRA', be: 'BE-FAMHP', es: 'ES-AEMPS', it: 'IT-AIFA', se: 'SE-MPA', at: 'AT-BASG', dk: 'DK-DKMA', pl: 'PL-URPL', pt: 'PT-INFARMED' };
export function euEnvelopes(project) {
  const eu = project.settings.eu ?? {};
  if ((eu.procedureType ?? 'centralised') === 'centralised') return [{ country: 'ema', agency: eu.agency ?? 'EU-EMA' }];
  const states = eu.procedureType === 'national' ? [eu.rms] : [eu.rms, ...(eu.cms ?? [])];
  return states.filter(Boolean).map((c) => ({ country: c, agency: EU_AGENCY[c] ?? `${c.toUpperCase()}-NCA`, rms: c === eu.rms }));
}

function buildEuRegionalXml(project, seq) {
  const s = project.settings;
  const eu = s.eu ?? {};
  const m1Leaves = seq.leaves.filter((l) => INDEX.map[l.nodeCode]?.isM1);
  const leafFn = (l, ind) => leafXml(project, seq, l, ind);
  // EU M1 wraps country-specific documents in 'specific' (or 'pi-doc' for 1.3.1) elements.
  const groupFn = (node, leaves, ind) => {
    if (!node.country || node.country === 'common' && node.code !== 'eu:1.0') return leaves.map((l) => leafFn(l, ind));
    const groups = new Map();
    for (const l of leaves) {
      const cc = euCountry(node, s, l);
      (groups.get(cc) ?? groups.set(cc, []).get(cc)).push(l);
    }
    const pad = ' '.repeat(ind);
    return [...groups.entries()].map(([cc, ls]) => {
      const [country, lang] = cc.split('/');
      const open = node.code === 'eu:1.3.1' ? `<pi-doc xml:lang="${esc(lang ?? 'en')}" type="combined" country="${esc(country)}">` : `<specific country="${esc(country)}">`;
      const close = node.code === 'eu:1.3.1' ? '</pi-doc>' : '</specific>';
      return `${pad}${open}\n${ls.map((l) => leafFn(l, ind + 2)).join('\n')}\n${pad}${close}`;
    });
  };
  const m1Body = m1Leaves.length ? nestedXml(project, seq, m1Leaves, 'eu:1', 2, leafFn, groupFn) : '  <m1-eu/>';
  const envelopes = euEnvelopes(project).map((e) => `    <envelope country="${esc(e.country)}">
      <identifier>${esc(eu.uuid)}</identifier>
      <submission type="${esc(seq.submissionType)}"${seq.submissionType === 'asmf' ? '' : ` mode="${esc(seq.submissionMode ?? 'single')}"`}/>
      <procedure-tracking>
        <number>${esc(eu.trackingNumber)}</number>
      </procedure-tracking>
      <submission-unit type="${esc(seq.subType)}"/>
      <applicant>${esc(s.applicant?.name)}</applicant>
      <agency code="${esc(e.agency)}"/>
      <procedure type="${esc(eu.procedureType)}"/>
      <invented-name>${esc(eu.inventedName)}</invented-name>
      <inn>${esc(eu.inn)}</inn>
      <sequence>${esc(seq.number)}</sequence>
      <related-sequence>${esc(seq.relatedSequence ?? '')}</related-sequence>
      <submission-description>${esc(seq.description)}</submission-description>
    </envelope>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional content modelled on the public EU Module 1 eCTD specification (v3.0.x). Not for submission. -->
<!DOCTYPE eu:eu-backbone SYSTEM "../../util/dtd/eu-regional.dtd">
<eu:eu-backbone xmlns:eu="http://europa.eu.int" xmlns:xlink="http://www.w3c.org/1999/xlink" dtd-version="3.0.4" xml:lang="en">
  <eu-envelope>
${envelopes}
  </eu-envelope>
${m1Body}
</eu:eu-backbone>
`;
}

export function buildIndexXml(project, seq, regionalXml) {
  const pack = REGION_PACKS[project.region];
  const regionalLeaf = `    <leaf ID="R${seq.number}" operation="new" checksum-type="md5" checksum="${md5(regionalXml)}" xlink:type="simple" xlink:href="${pack.regionalFile}" xml:lang="en">
      <title>${project.region} Regional</title>
    </leaf>`;
  const stfLeaves = studyFiles(project, seq).map((f) => ({ id: f.id, nodeCode: f.nodeCode, operation: 'new', fileName: f.fileName, title: f.title, stf: true, xml: f.xml }));
  const body = [...seq.leaves, ...stfLeaves].filter((l) => !INDEX.map[l.nodeCode]?.isM1 && INDEX.map[l.nodeCode]?.element);
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
  if (project.ectdVersion === '4.0') {
    const unit = buildSubmissionUnit(project, seq);
    const log = [
      { file: `${seqInt(seq.number)}/submissionunit.xml`, checksum: unit.xmlSum, operation: '—', target: '—', node: 'submission unit' },
      ...unit.files.map((f) => {
        const l = seq.leaves.find((x) => x.id === f.leafId);
        return { file: f.path.startsWith('(') ? f.path : `${seqInt(seq.number)}/${f.path}`, checksum: f.sha256, operation: l?.operation ?? f.op, target: l?.target ? `${seqInt(l.target.seq)} · ${l.target.leafId}` : '—', node: f.node, leafId: f.leafId };
      }),
      ...seq.leaves.filter((l) => l.operation === 'suspend').map((l) => ({ file: '(no file — suspend)', checksum: '—', operation: 'suspend', target: `${seqInt(l.target?.seq ?? '0')} · ${l.target?.leafId ?? ''}`, node: l.nodeCode, leafId: l.id })),
    ];
    return { v4: true, unit, index: unit.xml, regional: '', md5txt: unit.shaTxt, log, tree: v4FolderTree(project, seq, unit), stfs: [] };
  }
  if (project.region === 'IN') {
    const log = seq.leaves.filter((l) => !isRetireOp(l.operation)).map((l) => {
      const doc = docForLeaf(project, l);
      return { file: `${seq.number}/${leafPath(project, l)}`, checksum: doc ? fileChecksum(doc) : '—', operation: 'upload', target: '—', node: l.nodeCode, leafId: l.id };
    });
    return { portal: true, index: '', regional: '', md5txt: '', log, tree: folderTree(project, seq, { portal: true }), stfs: [] };
  }
  const regional = buildRegionalXml(project, seq);
  const index = buildIndexXml(project, seq, regional);
  const md5txt = `${md5(index)}\n`;
  const log = [];
  log.push({ file: `${seq.number}/index.xml`, checksum: md5(index), operation: '—', target: '—', node: 'backbone' });
  log.push({ file: `${seq.number}/index-md5.txt`, checksum: md5(md5txt), operation: '—', target: '—', node: 'backbone checksum' });
  log.push({ file: `${seq.number}/${REGION_PACKS[project.region].regionalFile}`, checksum: md5(regional), operation: 'new', target: '—', node: 'regional' });
  for (const l of seq.leaves) {
    const doc = docForLeaf(project, l);
    log.push({
      file: l.operation === 'delete' ? '(no file — delete)' : `${seq.number}/${leafPath(project, l)}`,
      checksum: isRetireOp(l.operation) || !doc ? '—' : fileChecksum(doc),
      operation: l.operation,
      target: l.target ? `${l.target.seq} · ${l.target.leafId}` : '—',
      node: l.nodeCode,
      leafId: l.id,
    });
  }
  const stfs = studyFiles(project, seq);
  for (const f of stfs) log.push({ file: `${seq.number}/${f.path}`, checksum: md5(f.xml), operation: 'new', target: '—', node: `${f.nodeCode} (STF)`, stf: f.id });
  const tree = folderTree(project, seq);
  return { regional, index, md5txt, log, tree, stfs };
}

// Folder tree (sequence-relative) for the live preview.
export function folderTree(project, seq, { portal = false } = {}) {
  const root = { name: seq.number, children: {}, files: [] };
  const add = (path, meta) => {
    const parts = path.split('/');
    const file = parts.pop();
    let cur = root;
    for (const p of parts) cur = (cur.children[p] ??= { name: p, children: {}, files: [] });
    cur.files.push({ name: file, ...meta });
  };
  if (portal) {
    for (const l of seq.leaves) if (!isRetireOp(l.operation)) add(leafPath(project, l), { kind: 'pdf', leafId: l.id, node: l.nodeCode, op: l.operation });
    return root;
  }
  add('index.xml', { kind: 'xml' });
  add('index-md5.txt', { kind: 'txt' });
  add(REGION_PACKS[project.region].regionalFile, { kind: 'xml' });
  add('util/dtd/ich-ectd-3-2.dtd', { kind: 'dtd' });
  add({ EU: 'util/dtd/eu-regional.dtd', CA: 'util/dtd/ca-regional.dtd', CH: 'util/dtd/ch-regional.dtd' }[project.region] ?? 'util/dtd/us-regional-v3-3.dtd', { kind: 'dtd' });
  add('util/dtd/ich-stf-v2-2.dtd', { kind: 'dtd' });
  for (const f of studyFiles(project, seq)) add(f.path, { kind: 'xml', node: f.nodeCode, op: 'new' });
  for (const l of seq.leaves) if (!isRetireOp(l.operation)) add(leafPath(project, l), { kind: 'pdf', leafId: l.id, node: l.nodeCode, op: l.operation });
  return root;
}
