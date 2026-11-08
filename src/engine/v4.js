// eCTD v4.0: one submission unit message (submissionunit.xml) per sequence, modelled on the
// ICH eCTD v4.0 Implementation Guide, PMDA's eCTD v4.0 Implementation Guide in Japan, FDA's
// eCTD v4.0 Technical Conformance Guide (revision 1.5, June 2026) for the US and EMA's EU eCTD
// v4.0 practical guidance for the EU (centralised procedure). Where the app knows the real
// controlled-vocabulary value (ICH contexts of use, Japan, and the EU values EMA's guidance
// shows) it uses it; other US and EU Module 1 values are written by name with a code system
// marked TRAINING, and the XML says so.
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
// A project made by the v4.0 Migration Lab keeps the identifiers of the project it came from.
const seedOf = (project) => project.couSeed ?? project.id;
export const couId = (project, leafId) => uuidFrom(`${seedOf(project)}|cou|${leafId}`);
export const docUuid = (project, docId) => uuidFrom(`${seedOf(project)}|doc|${docId}`);
// Sequences carried over from v3.2.2 by the Migration Lab: their content is referenced, never resent.
export const isLegacy = (seq) => !!seq?.legacy;

export function couCode(nodeCode) {
  const n = INDEX.map[nodeCode];
  if (!n) return null;
  if (n.cou) return n.cou;
  if (!n.isM1) return `ich_${n.code.toLowerCase()}`;
  // US and EU Module 1: the heading, by name (the real codes are in the regional CV packages).
  if (n.region === 'US') return `us_${n.code}`;
  if (n.region === 'EU') return `eu_${n.display ?? n.code.replace(/^eu:/, '')}`;
  return null;
}
export const TRAINING_CS = (what) => `TRAINING-${what}`;

// The EU values EMA's practical guidance shows (SPOR RMS term identifiers). Where the guidance
// shows a value without its code system OID, the OID is marked as not shown rather than guessed.
export const EU_V4 = {
  unitType: { initial: ['100000155047', '2.16.840.1.113883.3.6905.1.8.1', 'Initial'] },
  activity: { maa: ['100000155689', '2.16.840.1.113883.3.6905.1.11.1', 'Initial Marketing Authorisation Application'] },
  procedure: { centralised: ['100000155059', '2.16.840.1.113883.3.6905.1.7.1', 'Centralised Procedure'] },
  applicationType: { nas: ['100000116047', 'TRAINING-EU-CV-OID-NOT-SHOWN', 'New active substance (Article 8(3))'] },
  territory: ['100000000390', 'TRAINING-EU-CV-OID-NOT-SHOWN', 'European Union'],
  authority: ['100000160628', 'TRAINING-EU-CV-OID-NOT-SHOWN', 'EU-EMA'],
  productCategory: { chemical: ['100000155527', 'TRAINING-EU-CV-OID-NOT-SHOWN', 'Chemical Medicinal Product'] },
  languageCs: '2.16.840.1.113883.3.6905.1.16.1',
  countryCs: '2.16.840.1.113883.3.6905.1.1.1',
  piDocTypeCs: '2.16.840.1.113883.3.6905.1.18.1',
};
// Folder of a file in a v4.0 unit: the EU puts all of Module 1 in one m1 folder (country,
// language and product are keywords, not folders).
export function v4FilePath(project, leaf, s = project.settings) {
  const n = INDEX.map[leaf.nodeCode];
  if (project.region === 'EU' && n?.isM1) return `m1/${leaf.fileName}`;
  return filePath(leaf.nodeCode, leaf.fileName, s, leaf);
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
    const codeSystem = node.isM1 ? (oids.jpCou ?? TRAINING_CS(`${project.region}-M1-COU`)) : (oids.cou ?? '2.16.840.1.113883.3.989.2.2.1.1.2');
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
    const legacyTarget = l.target && isLegacy(seqByNumber(project, l.target.seq));
    if (l.operation === 'replace' && l.target) extra.push(`      <replacementOf typeCode="RPLC">
        <relatedContextOfUse>
          <id root="${couId(project, l.target.leafId)}"${legacyTarget ? ` extension="${esc(l.target.leafId)}"` : ''}/>${legacyTarget ? `
          <!-- leaf reference: v3.2.2 sequence ${esc(l.target.seq)}, leaf ${esc(l.target.leafId)} -->` : ''}
        </relatedContextOfUse>
      </replacementOf>`);
    if (project.region === 'EU' && l.lang) {
      extra.push(`      <referencedBy typeCode="REFR">
        <keyword>
          <code code="${esc(l.lang)}" codeSystem="${EU_V4.languageCs}"/>
        </keyword>
      </referencedBy>`);
    }
    if (project.region === 'EU' && l.country && l.country !== 'ema') {
      extra.push(`      <referencedBy typeCode="REFR">
        <keyword>
          <code code="${esc(l.country.toUpperCase())}" codeSystem="${TRAINING_CS('EU-COUNTRY')}"/>
        </keyword>
      </referencedBy>`);
    }
    if (l.study?.id) {
      const kd = uuidFrom(`${seedOf(project)}|kw|study`);
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
      const path = v4FilePath(project, l, s);
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

  const head = { JP: 'the ICH eCTD v4.0 and PMDA (Japan) implementation guides', US: 'the ICH eCTD v4.0 Implementation Guide and the FDA eCTD v4.0 Technical Conformance Guide (rev. 1.5, June 2026). US Module 1, submission and application codes are written by name in TRAINING code systems: the real values are in the FDA Module 1 controlled vocabulary package', EU: 'the ICH eCTD v4.0 Implementation Guide and EMA\'s EU eCTD v4.0 practical guidance. EU values EMA\'s guidance shows are real; other Module 1 values are written by name in TRAINING code systems: the real values are in the EU controlled vocabulary package' }[project.region] ?? 'the ICH eCTD v4.0 Implementation Guide';
  const unit = unitCode(project, seq, oids);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional content modelled on ${head}. Element order and identifiers are simplified. Not for submission. -->
<submissionUnit xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <id root="${uuidFrom(`${seedOf(project)}|su|${seq.number}`)}"/>
  <code code="${esc(unit[0])}" codeSystem="${unit[1]}"${unit[2] ? `><displayName value="${esc(unit[2])}"/></code>` : '/>'}
  <title value="${esc(seq.description || `Sequence ${seqInt(seq.number)}`)}"/>
  <statusCode code="active"/>
${comps.join('\n')}
${docs.map((d) => d.xml).join('\n')}${docs.length ? '\n' : ''}${kdXml.join('\n')}${kdXml.length ? '\n' : ''}${componentOf1(project, seq, oids, prod)}
</submissionUnit>
`;
  const xmlSum = sha256(xml);
  const shaTxt = [`${xmlSum}  submissionunit.xml`, ...files.filter((f) => f.sha256 && f.sha256 !== '—').map((f) => `${f.sha256}  ${f.path}`)].join('\n') + '\n';
  return { xml, shaTxt, files, xmlSum, reused: files.filter((f) => f.op === 'reuse').length };
}

export function v4FolderTree(project, seq, unit) {
  const top = project.region === 'EU' ? (project.settings.applicationNumber || 'EMEA/H/C/000000').replace(/[^A-Za-z0-9]/g, '').toLowerCase().replace(/^emeahc/, 'ema') : project.region === 'US' ? (project.settings.applicationNumber || '[application no.]') : (project.settings.jp?.receptionNumber || '[reception no.]');
  const root = { name: `${top}/${seqInt(seq.number)}`, children: {}, files: [] };
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

// The submission unit type of a sequence.
function unitCode(project, seq, oids) {
  if (project.region === 'JP') return [seq.subType, oids.jpSubmissionUnit ?? '', null];
  if (project.region === 'EU') return EU_V4.unitType[seq.subType] ?? [seq.subType, TRAINING_CS('EU-SUBMISSION-UNIT-TYPE'), null];
  const label = REGION_PACKS.US.submissionSubTypes?.find((t) => t.value === seq.subType)?.label ?? seq.subType;
  return [label, TRAINING_CS('FDA-SUBMISSION-UNIT-TYPE'), null];
}

// The submission (regulatory activity) and application each region's unit belongs to.
function componentOf1(project, seq, oids, prod) {
  const s = project.settings;
  const first = seq.forwardFrom ? `
    <!-- forward compatibility: first v4.0 unit after v3.2.2 sequence ${esc(seq.forwardFrom)} -->
    <sequenceNumber value="${seqInt(seq.number)}"/>` : `
    <sequenceNumber value="${seqInt(seq.number)}"/>`;
  if (project.region === 'JP') {
    const jp = s.jp ?? {};
    return `  <componentOf1>${first}
    <submission>
      <id>
        <item root="${s.eu?.uuid ?? uuidFrom(project.id)}" extension="${esc(jp.receptionNumber)}"/>
      </id>
      <code code="${esc(seq.submissionType)}" codeSystem="${oids.jpSubmission ?? ''}"/>
      <subject2>
        <review>
          <id root="${uuidFrom(`${seedOf(project)}|review`)}"/>
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
        <application><id><item root="${uuidFrom(`${seedOf(project)}|application`)}"/></id></application>
      </componentOf>
    </submission>
  </componentOf1>`;
  }
  if (project.region === 'EU') {
    const eu = s.eu ?? {};
    const act = EU_V4.activity[seq.submissionType] ?? [seq.submissionType, TRAINING_CS('EU-REGULATORY-ACTIVITY'), null];
    const proc = EU_V4.procedure[eu.procedureType ?? 'centralised'] ?? [eu.procedureType, TRAINING_CS('EU-PROCEDURE'), null];
    const appType = project.productId === 'nce-tablet' || project.productId === 'sterile-injectable' || project.productId === 'mab-infusion' ? EU_V4.applicationType.nas : [project.productId === 'generic-tablet' ? 'Generic (Article 10(1))' : project.productId === 'biosimilar-mab' ? 'Similar biological (Article 10(4))' : 'Other', TRAINING_CS('EU-APPLICATION-TYPE'), null];
    const cat = /mab/.test(project.productId) ? ['Biological Medicinal Product', TRAINING_CS('EU-PRODUCT-CATEGORY'), null] : EU_V4.productCategory.chemical;
    const cd = (c) => `<code code="${esc(c[0])}" codeSystem="${c[1]}">${c[2] ? `<displayName value="${esc(c[2])}"/>` : ''}</code>`;
    return `  <componentOf1>${first}
    <submission>
      <id><item root="${uuidFrom(`${seedOf(project)}|activity|${seq.submissionType}`)}" extension="${esc(eu.trackingNumber || 'H0000000')}"/></id>
      ${cd(act)}
      <subject2>
        <review>
          <id root="${uuidFrom(`${seedOf(project)}|review`)}"/>
          <statusCode code="active"/>
          <subject1>
            <manufacturedProduct>
              <manufacturedProduct>
                <name><part value="${esc(eu.inventedName ?? prod?.product.brandName)}"/></name>
                <ingredient><ingredientSubstance><name><part value="${esc(eu.inn ?? prod?.product.inn)}"/></name></ingredientSubstance></ingredient>
              </manufacturedProduct>
            </manufacturedProduct>
          </subject1>
          <holder><applicant><sponsorOrganization><name><part value="${esc(s.applicant?.name)}"/></name></sponsorOrganization></applicant></holder>
          <author><territorialAuthority>
            <territory>${cd(EU_V4.territory)}</territory>
            <governingAgency>${cd(EU_V4.authority)}</governingAgency>
          </territorialAuthority></author>
          <subject2><productCategory>${cd(cat)}</productCategory></subject2>
          <reviewProcedure>${cd(proc)}</reviewProcedure>
        </review>
      </subject2>
      <componentOf>
        <application>
          <id><item root="${uuidFrom(`${seedOf(project)}|application`)}" extension="${esc(s.applicationNumber || 'EMEA/H/C/000000')}"/></id>
          ${cd(appType)}
        </application>
      </componentOf>
    </submission>
  </componentOf1>`;
  }
  const sub = REGION_PACKS.US.submissionTypes.find((t) => t.value === seq.submissionType)?.label ?? seq.submissionType;
  const app = { nda: 'NDA', anda: 'ANDA', bla: 'BLA', 'bla-351k': 'BLA', ind: 'IND', dmf: 'MF' }[project.appType] ?? project.appType.toUpperCase();
  return `  <componentOf1>${first}
    <submission>
      <id><item root="${uuidFrom(`${seedOf(project)}|submission|${seq.submissionType}`)}"/></id>
      <code code="${esc(sub)}" codeSystem="${TRAINING_CS('FDA-SUBMISSION-TYPE')}"/>
      <subject2>
        <review>
          <id root="${uuidFrom(`${seedOf(project)}|review`)}"/>
          <statusCode code="active"/>
          <subject1><manufacturedProduct><manufacturedProduct><name><part value="${esc(prod?.product.brandName)}"/></name></manufacturedProduct></manufacturedProduct></subject1>
          <holder><applicant><sponsorOrganization><name><part value="${esc(s.applicant?.name)}"/></name></sponsorOrganization></applicant></holder>
        </review>
      </subject2>
      <componentOf>
        <application>
          <id><item root="${uuidFrom(`${seedOf(project)}|application`)}" extension="${esc(`${app} ${s.applicationNumber || '000000'}`)}"/></id>
          <code code="${esc(app)}" codeSystem="${TRAINING_CS('FDA-APPLICATION-TYPE')}"/>
        </application>
      </componentOf>
    </submission>
  </componentOf1>`;
}
