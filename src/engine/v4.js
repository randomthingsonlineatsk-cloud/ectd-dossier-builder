// eCTD v4.0: one submission unit message (submissionunit.xml) per sequence, modelled on the
// ICH eCTD v4.0 Implementation Guide and PMDA's eCTD v4.0 Implementation Guide in Japan.
// In v4.0 a document is defined once and placed by contexts of use (CoU). A CoU can be
// replaced (replacementOf) or suspended (statusCode "suspended"); a document already sent
// is reused by reference without resending the file. Checksums are SHA-256.
import { INDEX, REGION_PACKS, ancestors, filePath } from './tree.js';
import { docForLeaf, lifecycleState, seqByNumber, sortedSequences, PRODUCTS } from './model.js';
import { fileContentKey } from './backbone.js';
import { sha256 } from './sha256.js';

export const isV4 = (project) => project.ectdVersion === '4.0';
export const seqInt = (number) => String(parseInt(number, 10));

// Deterministic UUIDs so the same leaf or document always has the same identifier.
export function uuidFrom(text) {
  const h = sha256(text);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export const couId = (project, leafId) => uuidFrom(`${project.id}|cou|${leafId}`);
export const docUuid = (project, docId) => uuidFrom(`${project.id}|doc|${docId}`);

export function couCode(nodeCode) {
  const n = INDEX.map[nodeCode];
  if (!n) return null;
  if (n.cou) return n.cou;
  if (!n.isM1) return `ich_${n.code.toLowerCase()}`;
  return null;
}

export const isRealSha = (doc) => !!doc?.sha256 && doc.sha256Key === fileContentKey(doc);
export const fileSha256 = (doc) => (isRealSha(doc) ? doc.sha256 : sha256(fileContentKey(doc)));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Which documents were already delivered in an earlier published unit (so can be reused).
export function deliveredBefore(project, seqNumber) {
  const delivered = new Map();
  for (const s of sortedSequences(project)) {
    if (s.number >= seqNumber || s.status !== 'published') continue;
    for (const l of s.leaves) if (l.docId && l.operation !== 'suspend' && !delivered.has(l.docId)) delivered.set(l.docId, { seq: s.number, leaf: l });
  }
  return delivered;
}

// Priority numbers order the CoUs under one heading (1000, 2000...).
function priorities(project, seq) {
  const st = lifecycleState(project, seq.number);
  const byNode = {};
  for (const e of st.entries.values()) if (e.status === 'current' && e.leaf.operation !== 'delete' && e.leaf.operation !== 'suspend') (byNode[e.leaf.nodeCode] ??= []).push(e);
  const out = {};
  for (const list of Object.values(byNode)) list.forEach((e, i) => { out[e.leaf.id] = (i + 1) * 1000; });
  return out;
}

export function buildSubmissionUnit(project, seq) {
  const pack = REGION_PACKS[project.region];
  const oids = pack.oids ?? {};
  const s = project.settings;
  const jp = s.jp ?? {};
  const prod = PRODUCTS[project.productId];
  const delivered = deliveredBefore(project, seq.number);
  const prio = priorities(project, seq);
  const keywordDefs = new Map();
  const comps = [];
  const docs = [];
  const files = [];

  for (const l of seq.leaves) {
    const node = INDEX.map[l.nodeCode];
    if (!node || l.nodeCode === 'jp:cover') continue;
    const code = couCode(l.nodeCode);
    const codeSystem = node.isM1 ? (oids.jpCou ?? '') : (oids.cou ?? '2.16.840.1.113883.3.989.2.2.1.1.2');
    if (l.operation === 'suspend') {
      comps.push(`  <component>
    <contextOfUse>
      <id root="${couId(project, l.target?.leafId ?? l.id)}"/>
      <code code="${esc(code)}" codeSystem="${codeSystem}"/>
      <statusCode code="suspended"/>
    </contextOfUse>
  </component>`);
      continue;
    }
    const doc = docForLeaf(project, l);
    const dId = docUuid(project, l.docId);
    const reused = delivered.has(l.docId);
    const extra = [];
    if (l.operation === 'replace' && l.target) extra.push(`      <replacementOf typeCode="RPLC">
        <relatedContextOfUse>
          <id root="${couId(project, l.target.leafId)}"/>
        </relatedContextOfUse>
      </replacementOf>`);
    if (l.study?.id) {
      const kd = uuidFrom(`${project.id}|kw|study`);
      keywordDefs.set(l.study.id, kd);
      extra.push(`      <referencedBy typeCode="REFR">
        <keyword>
          <code code="${esc(l.study.id)}" codeSystem="${kd}"/>
        </keyword>
      </referencedBy>`);
    }
    comps.push(`  <component>
    <priorityNumber value="${prio[l.id] ?? 1000}"/>
    <contextOfUse>
      <id root="${couId(project, l.id)}"/>
      <code code="${esc(code)}" codeSystem="${codeSystem}"/>
      <statusCode code="active"/>
${extra.join('\n')}${extra.length ? '\n' : ''}      <derivedFrom>
        <documentReference>
          <id root="${dId}"/>
        </documentReference>
      </derivedFrom>
    </contextOfUse>
  </component>`);
    if (!reused && doc && !docs.some((d) => d.id === dId)) {
      const path = filePath(l.nodeCode, l.fileName, s);
      const sum = fileSha256(doc);
      files.push({ path, sha256: sum, leafId: l.id, node: l.nodeCode, op: l.operation });
      docs.push({ id: dId, xml: `  <component>
    <document>
      <id root="${dId}"/>
      <title value="${esc(l.title)}"/>
      <text integrityCheckAlgorithm="SHA256">
        <reference value="${esc(path)}"/>
        <integrityCheck value="${sum}"/>
      </text>
    </document>
  </component>` });
    } else if (reused) {
      files.push({ path: `(reused from sequence ${seqInt(delivered.get(l.docId).seq)})`, sha256: '—', leafId: l.id, node: l.nodeCode, op: 'reuse' });
    }
  }
  const cover = seq.leaves.find((l) => l.nodeCode === 'jp:cover');
  if (cover) {
    const doc = docForLeaf(project, cover);
    files.unshift({ path: 'm1/jp/cover.pdf', sha256: doc ? fileSha256(doc) : '', leafId: cover.id, node: 'jp:cover', op: 'not in XML' });
  }

  const kdXml = [...keywordDefs.entries()].map(([value, kd]) => `  <component>
    <keywordDefinition>
      <value>
        <item>
          <code code="${esc(value)}" codeSystem="${kd}">
            <displayName value="Study ${esc(value)}"/>
          </code>
        </item>
      </value>
    </keywordDefinition>
  </component>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional content modelled on the ICH eCTD v4.0 and PMDA (Japan) implementation guides. Element order and identifiers are simplified. Not for submission. -->
<submissionUnit xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <id root="${uuidFrom(`${project.id}|su|${seq.number}`)}"/>
  <code code="${esc(seq.subType)}" codeSystem="${oids.jpSubmissionUnit ?? ''}"/>
  <title value="${esc(seq.description || `Sequence ${seqInt(seq.number)}`)}"/>
  <statusCode code="active"/>
${comps.join('\n')}
${docs.map((d) => d.xml).join('\n')}${docs.length ? '\n' : ''}${kdXml.join('\n')}${kdXml.length ? '\n' : ''}  <componentOf1>
    <sequenceNumber value="${seqInt(seq.number)}"/>
    <submission>
      <id>
        <item root="${s.eu?.uuid ?? uuidFrom(project.id)}" extension="${esc(jp.receptionNumber)}"/>
      </id>
      <code code="${esc(seq.submissionType)}" codeSystem="${oids.jpSubmission ?? ''}"/>
      <subject2>
        <review>
          <id root="${uuidFrom(`${project.id}|review`)}"/>
          <statusCode code="active"/>
          <subject1>
            <manufacturedProduct>
              <manufacturedProduct>
                <name><part value="${esc(jp.brandName)}"/></name>
                <ingredient>
                  <ingredientSubstance>
                    <name code="jp_jan" codeSystem="${oids.jpSubstanceNameType ?? ''}"><part value="${esc(jp.janName)}"/></name>
                  </ingredientSubstance>
                </ingredient>
              </manufacturedProduct>
            </manufacturedProduct>
          </subject1>
          <holder>
            <applicant>
              <sponsorOrganization><name><part value="${esc(jp.applicantName || s.applicant?.name)}"/></name></sponsorOrganization>
            </applicant>
          </holder>
          <subject2>
            <productCategory><code code="${esc(jp.productCategory || 'jp_1_1')}" codeSystem="${oids.jpProductCategory ?? ''}"/></productCategory>
          </subject2>
        </review>
      </subject2>
      <componentOf>
        <application><id><item root="${uuidFrom(`${project.id}|application`)}"/></id></application>
      </componentOf>
    </submission>
  </componentOf1>
</submissionUnit>
`;
  const xmlSum = sha256(xml);
  const shaTxt = [`${xmlSum}  submissionunit.xml`, ...files.filter((f) => f.sha256 && f.sha256 !== '—').map((f) => `${f.sha256}  ${f.path}`)].join('\n') + '\n';
  return { xml, shaTxt, files, xmlSum, reused: files.filter((f) => f.op === 'reuse').length };
}

export function v4FolderTree(project, seq, unit) {
  const root = { name: `${project.settings.jp?.receptionNumber || '[reception no.]'}/${seqInt(seq.number)}`, children: {}, files: [] };
  const add = (path, meta) => {
    const parts = path.split('/');
    const file = parts.pop();
    let cur = root;
    for (const p of parts) cur = (cur.children[p] ??= { name: p, children: {}, files: [] });
    cur.files.push({ name: file, ...meta });
  };
  add('submissionunit.xml', { kind: 'xml' });
  add('sha256.txt', { kind: 'txt' });
  for (const f of unit.files) if (!f.path.startsWith('(')) add(f.path, { kind: 'pdf', op: f.op });
  return root;
}

export { ancestors };
