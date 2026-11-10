// The M4Q(R2) what-if: where would this dossier's quality documents go under the revised CTD
// quality structure? ICH M4Q(R2) is a Step 2 draft (endorsed 14 May 2025); public consultation
// closed in March 2026 and the ICH work plan (July 2026) targets Step 4 in June 2027. No region
// accepts R2 dossiers yet, and the eCTD support for it (ICH M8) is still to be decided.
//
// In R2, Module 2.3 is no longer a summary: it holds the core quality information (2.3.3) that
// supports the assessment, plus the overall development and control strategy (2.3.2), the
// development summary and justifications (2.3.4) and product lifecycle management (2.3.5).
// Module 3 holds the supporting data, organised by material (drug substances, starting
// materials, raw materials, excipients, reference standards, impurities, drug products,
// analytical procedures, facilities), each in the D/M/C/S pattern: Description, Manufacture,
// Control, Storage. The mapping below is this app's, drawn from the section descriptions in the
// Step 2 draft; ICH published its own mapping of R1 to R2 (December 2025) for real work.
import { INDEX, displayCode, nodeLabel } from './tree.js';
import { lifecycleState, sortedSequences, isRetireOp } from './model.js';

export const M4Q_STATUS = {
  step: 'Step 2 draft', endorsed: '2025-05-14', consultationClosed: '2026-03', step4Target: '2027-06', workPlan: '2026-07-10',
  text: 'ICH M4Q(R2) is a draft (Step 2, endorsed 14 May 2025). Public consultation closed in March 2026 with more than 2,500 comments; the ICH work plan of July 2026 targets Step 4 in June 2027. No region accepts R2 dossiers yet, and how eCTD will carry the new structure (ICH M8) is still to be decided. This is a what-if: the project is not changed.',
};

// R2 headings used below (Step 2 draft table of contents).
export const R2 = {
  '2.3.1': 'General Information',
  '2.3.2': 'Overall Development and Overall Control Strategy',
  '2.3.2.1': 'Quality Target Product Profile',
  '2.3.2.2': 'Overall Development Strategy',
  '2.3.2.3': 'Overall Control Strategy Representation',
  '2.3.3.DS': 'Core Quality Information: Drug Substances',
  '2.3.3.SI': 'Core Quality Information: Substance Intermediates',
  '2.3.3.SM': 'Core Quality Information: Starting/Source Materials',
  '2.3.3.RM': 'Core Quality Information: Raw Materials',
  '2.3.3.EX': 'Core Quality Information: Excipients',
  '2.3.3.RS': 'Core Quality Information: Reference Standards and/or Materials',
  '2.3.3.DP': 'Core Quality Information: Drug Products',
  '2.3.3.PI': 'Core Quality Information: Product Intermediates',
  '2.3.3.MD': 'Core Quality Information: Medical Devices',
  '2.3.3.AP': 'Core Quality Information: Analytical Procedures',
  '2.3.3.FA': 'Core Quality Information: Facilities',
  '2.3.4.IN': 'Integrated Development and Justifications',
  '2.3.4.DS': 'Development Summary and Justification: Drug Substances',
  '2.3.4.DP': 'Development Summary and Justification: Drug Products',
  '2.3.4.AP': 'Development Summary and Justification: Analytical Procedures',
  '2.3.5.1': 'Change Summary and Justifications',
  '2.3.5.2': 'Product Lifecycle Management Document (PLCM)',
  '2.3.5.3': 'Content of Post-Approval Change Management Protocols',
  '2.3.6': 'Product Quality Benefit Risk (optional)',
  '3.2.DS': 'Drug Substances', '3.2.SI': 'Substance Intermediates', '3.2.SM': 'Starting/Source Materials', '3.2.RM': 'Raw Materials', '3.2.EX': 'Excipients',
  '3.2.RS': 'Reference Standards and/or Materials', '3.2.IM': 'Impurities', '3.2.DP': 'Drug Products', '3.2.PI': 'Product Intermediates', '3.2.MD': 'Medical Devices',
  '3.2.AP': 'Analytical Procedures', '3.2.FA': 'Facilities',
};

// R1 heading -> { core: R2 Module 2.3 places, data: R2 Module 3 place, action, note }.
// action: 'move' (same content, new place), 'split' (core part to 2.3, data to Module 3),
// 'rewrite' (becomes new R2 content), 'none' (no place in the draft).
const M = (core, data, action = 'split', note = '') => ({ core, data, action, note });
export const MAP = {
  '2.3': M(['2.3.1', '2.3.2', '2.3.3.DS', '2.3.3.DP', '2.3.4.DS', '2.3.4.DP'], null, 'rewrite', 'The R1 Quality Overall Summary summarises Module 3. In R2, Module 2.3 is the core quality information itself: rewrite it into 2.3.1 to 2.3.5 rather than moving it.'),
  '3.2': M([], null, 'none', 'A document filed at 3.2 itself has no single place in R2: put it under the material it is about.'),
  '3.2.S': M(['2.3.3.DS'], '3.2.DS', 'split', 'The drug substance becomes one material of R2, in the D/M/C/S pattern.'),
  '3.2.S.2': M(['2.3.3.DS'], '3.2.DS', 'split', 'Manufacture (M).'),
  '3.2.S.3': M(['2.3.3.DS'], '3.2.DS', 'split', 'Characterisation feeds the description (D) and impurities (3.2.IM).'),
  '3.2.S.4': M(['2.3.3.DS'], '3.2.DS', 'split', 'Control (C).'),
  '3.2.S.7': M(['2.3.3.DS'], '3.2.DS', 'split', 'Storage (S).'),
  '3.2.P': M(['2.3.3.DP'], '3.2.DP', 'split', 'The drug product becomes one material of R2, in the D/M/C/S pattern.'),
  '3.2.P.3': M(['2.3.3.DP'], '3.2.DP', 'split', 'Manufacture (M).'),
  '3.2.P.5': M(['2.3.3.DP'], '3.2.DP', 'split', 'Control (C).'),
  '3.2.A': M(['2.3.3.FA'], '3.2.FA', 'split', 'The appendices are spread over facilities, raw materials and excipients.'),
  '3.2.S.1': M(['2.3.3.DS'], '3.2.DS', 'split', 'Description (D) of the drug substance.'),
  '3.2.S.1.1': M(['2.3.3.DS'], '3.2.DS', 'move', 'Description (D).'),
  '3.2.S.1.2': M(['2.3.3.DS'], '3.2.DS', 'move', 'Description (D).'),
  '3.2.S.1.3': M(['2.3.3.DS'], '3.2.DS', 'move', 'Description (D).'),
  '3.2.S.2.1': M(['2.3.3.FA'], '3.2.FA', 'move', 'Sites now sit with facilities.'),
  '3.2.S.2.2': M(['2.3.3.DS'], '3.2.DS', 'split', 'Manufacture (M): the process and its controls are core information; detail goes to 3.2.DS.'),
  '3.2.S.2.3': M(['2.3.3.SM', '2.3.3.RM'], '3.2.SM', 'split', 'Starting/source materials and raw materials get their own sections (3.2.SM, 3.2.RM).'),
  '3.2.S.2.4': M(['2.3.3.DS', '2.3.3.SI'], '3.2.SI', 'split', 'Controls of critical steps are core; intermediates get their own section if applicable.'),
  '3.2.S.2.5': M(['2.3.4.DS'], '3.2.DS', 'split', 'Validation data stay in Module 3; their summary and justification go to 2.3.4.'),
  '3.2.S.2.6': M(['2.3.4.DS', '2.3.2.2'], '3.2.DS', 'split', 'Development becomes the development summary and justification.'),
  '3.2.S.3.1': M(['2.3.3.DS'], '3.2.DS', 'split', 'Characteristics feed the description (D).'),
  '3.2.S.3.2': M(['2.3.4.DS'], '3.2.IM', 'split', 'Impurities get their own Module 3 section (3.2.IM).'),
  '3.2.S.4.1': M(['2.3.3.DS'], '3.2.DS', 'move', 'Control (C): the specification is core quality information.'),
  '3.2.S.4.2': M(['2.3.3.AP'], '3.2.AP', 'move', 'Analytical procedures are their own material in R2.'),
  '3.2.S.4.3': M(['2.3.4.AP'], '3.2.AP', 'split', 'Validation summary to 2.3.4.AP, data to 3.2.AP.'),
  '3.2.S.4.4': M([], '3.2.DS', 'move', 'Batch data are supporting data.'),
  '3.2.S.4.5': M(['2.3.4.DS'], null, 'move', 'Justifications go to the development summary.'),
  '3.2.S.5': M(['2.3.3.RS'], '3.2.RS', 'move', 'Reference standards are their own material in R2.'),
  '3.2.S.6': M(['2.3.3.DS'], '3.2.DS', 'move', 'Storage (S): the container closure system.'),
  '3.2.S.7.1': M(['2.3.3.DS', '2.3.4.DS'], '3.2.DS', 'split', 'Storage (S): retest period and storage conditions are core; the justification goes to 2.3.4.'),
  '3.2.S.7.2': M(['2.3.3.DS', '2.3.5.1'], '3.2.DS', 'split', 'The post-approval protocol and commitments link to lifecycle management (2.3.5).'),
  '3.2.S.7.3': M([], '3.2.DS', 'move', 'Stability data are supporting data.'),
  '3.2.P.1': M(['2.3.3.DP'], '3.2.DP', 'move', 'Description (D) and composition of the drug product.'),
  '3.2.P.2': M(['2.3.2.1', '2.3.2.2', '2.3.2.3', '2.3.4.DP'], '3.2.DP', 'rewrite', 'Pharmaceutical development becomes the QTPP, the overall development and control strategy (2.3.2) and the development summary (2.3.4.DP).'),
  '3.2.P.3.1': M(['2.3.3.FA'], '3.2.FA', 'move', 'Sites now sit with facilities.'),
  '3.2.P.3.2': M(['2.3.3.DP'], '3.2.DP', 'move', 'Batch formula: description and manufacture.'),
  '3.2.P.3.3': M(['2.3.3.DP'], '3.2.DP', 'split', 'Manufacture (M): process and controls are core; detail goes to 3.2.DP.'),
  '3.2.P.3.4': M(['2.3.3.DP', '2.3.3.PI'], '3.2.PI', 'split', 'Controls of critical steps are core; product intermediates get their own section if applicable.'),
  '3.2.P.3.5': M(['2.3.4.DP'], '3.2.DP', 'split', 'Validation data stay in Module 3; summary and justification go to 2.3.4.'),
  '3.2.P.4': M(['2.3.3.EX'], '3.2.EX', 'move', 'Excipients are their own material in R2.'),
  '3.2.P.4.1': M(['2.3.3.EX'], '3.2.EX', 'move', 'Control (C) of the excipient.'),
  '3.2.P.4.2': M(['2.3.3.AP'], '3.2.AP', 'move', 'Analytical procedures are their own material.'),
  '3.2.P.4.3': M(['2.3.4.AP'], '3.2.AP', 'split', 'Validation summary to 2.3.4.AP.'),
  '3.2.P.4.4': M(['2.3.4.DP'], '3.2.EX', 'split', 'Justification to the development summary.'),
  '3.2.P.4.5': M(['2.3.3.EX'], '3.2.EX', 'move', 'Human or animal origin: with the excipient.'),
  '3.2.P.4.6': M(['2.3.3.EX'], '3.2.EX', 'move', 'Novel excipients: with the excipient.'),
  '3.2.P.5.1': M(['2.3.3.DP'], '3.2.DP', 'move', 'Control (C): the specification is core quality information.'),
  '3.2.P.5.2': M(['2.3.3.AP'], '3.2.AP', 'move', 'Analytical procedures are their own material.'),
  '3.2.P.5.3': M(['2.3.4.AP'], '3.2.AP', 'split', 'Validation summary to 2.3.4.AP.'),
  '3.2.P.5.4': M([], '3.2.DP', 'move', 'Batch data are supporting data.'),
  '3.2.P.5.5': M(['2.3.4.DP'], '3.2.IM', 'split', 'Impurities get their own Module 3 section.'),
  '3.2.P.5.6': M(['2.3.4.DP'], null, 'move', 'Justifications go to the development summary.'),
  '3.2.P.6': M(['2.3.3.RS'], '3.2.RS', 'move', 'Reference standards are their own material.'),
  '3.2.P.7': M(['2.3.3.DP', '2.3.3.MD'], '3.2.DP', 'split', 'Storage (S): container closure; a device that is part of the product goes to 2.3.3.MD and 3.2.MD.'),
  '3.2.P.8': M(['2.3.3.DP', '2.3.4.DP'], '3.2.DP', 'split', 'Storage (S): shelf life and conditions are core; the justification goes to 2.3.4.'),
  '3.2.P.8.1': M(['2.3.3.DP', '2.3.4.DP'], '3.2.DP', 'split', 'Storage (S): shelf life and conditions are core; the justification goes to 2.3.4.'),
  '3.2.P.8.2': M(['2.3.3.DP', '2.3.5.1'], '3.2.DP', 'split', 'The post-approval protocol and commitments link to lifecycle management.'),
  '3.2.P.8.3': M([], '3.2.DP', 'move', 'Stability data are supporting data.'),
  '3.2.A.1': M(['2.3.3.FA'], '3.2.FA', 'move', 'Facilities are their own section in R2.'),
  '3.2.A.2': M(['2.3.4.IN', '2.3.3.RM'], '3.2.RM', 'split', 'Closest place: the viral and TSE safety of materials sits with raw materials and the integrated justification. Check the ICH mapping.'),
  '3.2.A.3': M(['2.3.3.EX'], '3.2.EX', 'move', 'Novel excipients: with the excipient.'),
  '3.2.R': M([], null, 'none', 'The draft has no regional section: regional information goes into the relevant section only where a regional requirement cannot be avoided.'),
  '3.3': M([], null, 'none', 'Literature references are not in the draft\'s Module 3 table of contents; check the final guideline.'),
};

// New R2 content with no R1 heading of its own.
export const NEW_IN_R2 = [
  { code: '2.3.2.1', why: 'The quality target product profile and the critical quality attributes, stated once for the product.', from: ['3.2.P.2'] },
  { code: '2.3.2.3', why: 'A representation of the overall control strategy (for example a table linking each CQA to its controls).', from: ['3.2.P.2', '3.2.S.2.6'] },
  { code: '2.3.5.1', why: 'A summary of the changes in this submission and their justification.', from: [] },
  { code: '2.3.5.2', why: 'The PLCM document (ICH Q12), if established conditions are proposed.', from: [] },
  { code: '2.3.5.3', why: 'The content of any post-approval change management protocols.', from: ['3.2.S.7.2', '3.2.P.8.2'] },
];

// The mapping for a heading: its own entry, or the nearest ancestor's.
export function mapFor(code) {
  for (let c = code; c; c = INDEX.map[c]?.parent ?? null) if (MAP[c]) return { ...MAP[c], from: c };
  return null;
}
const inQuality = (code) => code === '2.3' || code === '3' || code.startsWith('3.');
const label = (c) => (R2[c] ? `${c} ${R2[c]}` : c);

export function analyseM4q(project) {
  const seqs = sortedSequences(project);
  const st = lifecycleState(project);
  const rows = [];
  for (const e of st.entries.values()) {
    if (e.status !== 'current' || isRetireOp(e.leaf.operation)) continue;
    const code = e.leaf.nodeCode;
    if (!inQuality(code)) continue;
    const m = mapFor(code);
    rows.push({
      seq: e.seq, leafId: e.leaf.id, nodeCode: code, r1: `${displayCode(code)} ${nodeLabel(code)}`, title: e.leaf.title,
      core: (m?.core ?? []).map(label), data: m?.data ? label(m.data) : '', action: m?.action ?? 'none', note: m?.note ?? 'No mapping.',
    });
  }
  for (const r of rows) r.placed = true;
  // Preview: library documents not placed yet, at the heading they belong under. Decoys are left
  // out, and during an unsubmitted standard or expert mission the preview stays closed, since it
  // would show where each document goes.
  const previewOpen = !project.mission || project.mission.difficulty === 'guided' || !!project.mission.submitted;
  const used = new Set([...st.entries.values()].map((e) => e.leaf.docId).filter(Boolean));
  const library = Object.values(project.documents ?? {}).filter((doc) => !doc.decoy && doc.section && inQuality(String(doc.section)) && INDEX.map[doc.section] && !used.has(doc.id));
  const preview = previewOpen ? library.map((doc) => {
    const m = mapFor(doc.section);
    return { seq: '', leafId: doc.id, nodeCode: doc.section, r1: `${displayCode(doc.section)} ${nodeLabel(doc.section)}`, title: doc.title, placed: false,
      core: (m?.core ?? []).map(label), data: m?.data ? label(m.data) : '', action: m?.action ?? 'none', note: m?.note ?? 'No mapping.' };
  }) : [];
  rows.push(...preview);
  rows.sort((a, b) => INDEX.order.indexOf(a.nodeCode) - INDEX.order.indexOf(b.nodeCode) || Number(b.placed) - Number(a.placed));
  const have = new Set(rows.map((r) => r.nodeCode));
  const placedRows = rows.filter((r) => r.placed);
  const d = project.m4q ?? {};
  const drafted = { '2.3.2.1': (d.qtpp ?? []).length > 0, '2.3.2.3': (d.cs ?? []).length > 0, '2.3.5.1': placedRows.length > 0, '2.3.5.2': (d.ec ?? []).length > 0, '2.3.5.3': (d.pacmp ?? []).length > 0 };
  const gaps = NEW_IN_R2.map((g) => ({ ...g, label: label(g.code), drafted: drafted[g.code], sources: g.from.filter((c) => [...have].some((h) => h === c || h.startsWith(`${c}.`))) }));
  const count = (a) => rows.filter((r) => r.action === a).length;
  const placed = rows.filter((r) => r.action !== 'none').length;
  const previewHidden = previewOpen ? 0 : library.length;
  return {
    status: M4Q_STATUS, rows, gaps,
    move: count('move'), split: count('split'), rewrite: count('rewrite'), none: count('none'),
    coverage: rows.length ? Math.round((100 * placed) / rows.length) : 0,
    published: seqs.filter((s) => s.status === 'published').length,
    placedCount: placedRows.length, previewCount: preview.length, previewHidden,
    r2Sections: [...new Set(rows.flatMap((r) => [...r.core, r.data].filter(Boolean)))].sort(),
  };
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function m4qCsv(project, a, d = project.m4q ?? null) {
  const head = ['Sequence', 'Status', 'R1 heading', 'Document', 'Action', 'R2 Module 2.3', 'R2 Module 3', 'D/M/C/S part', 'Note'];
  const lines = [head.map(q).join(','), ...a.rows.map((r) => [r.seq, r.placed ? 'In the dossier' : 'Library preview (not placed)', r.r1, r.title, r.action, r.core.join('; '), r.data, partOf(r.nodeCode) ? PART_LABEL[partOf(r.nodeCode)] : '', r.note].map(q).join(','))];
  lines.push('', q('New in R2, to be written') , ...a.gaps.map((g) => [q(''), q(g.label), q(g.why), q('write'), q(g.sources.length ? `Draw on ${g.sources.map(displayCode).join(', ')}` : 'No source in this dossier'), q(''), q('')].join(',')));
  if (d) {
    lines.push('', q('2.3.2.1 Quality Target Product Profile'), ['Attribute', 'Target', 'Justification', 'CQA'].map(q).join(','), ...(d.qtpp ?? []).map((r) => [r.attribute, r.target, r.justification, r.cqa ? 'Yes' : 'No'].map(q).join(',')));
    lines.push('', q('2.3.2.3 Overall Control Strategy Representation'), ['CQA', 'Material controls', 'Process controls', 'In-process controls', 'Specification', 'Supporting data (R1)'].map(q).join(','), ...(d.cs ?? []).map((r) => [r.cqa, r.materials, r.process, r.inProcess, r.specification, r.source].map(q).join(',')));
    lines.push('', q('2.3.5.2 Established conditions'), ['Element', 'Established condition', 'Reporting category', 'Justification'].map(q).join(','), ...(d.ec ?? []).map((r) => [r.element, r.isEc === false ? 'No' : 'Yes', r.category, r.justification].map(q).join(',')));
    lines.push('', q('2.3.5.3 Post-approval change management protocols'), ['Change', 'Studies', 'Acceptance criteria', 'Proposed category'].map(q).join(','), ...(d.pacmp ?? []).map((r) => [r.change, r.studies, r.criteria, r.category].map(q).join(',')));
  }
  lines.push('', q(`What-if under the ICH M4Q(R2) Step 2 draft. ${project.name}. Training material, fictional product.`));
  return lines.join('\r\n');
}

// ---------------------------------------------------------------- the R2 structure, material by material
// Which D/M/C/S part an R1 heading feeds (null when it is not part of that pattern).
const PART = [
  [/^3\.2\.S\.1/, 'D'], [/^3\.2\.S\.2\.[1-4]/, 'M'], [/^3\.2\.S\.2\.[56]/, 'M'], [/^3\.2\.S\.3/, 'D'], [/^3\.2\.S\.4/, 'C'], [/^3\.2\.S\.6/, 'S'], [/^3\.2\.S\.7/, 'S'],
  [/^3\.2\.P\.1/, 'D'], [/^3\.2\.P\.3/, 'M'], [/^3\.2\.P\.4/, 'C'], [/^3\.2\.P\.5/, 'C'], [/^3\.2\.P\.7/, 'S'], [/^3\.2\.P\.8/, 'S'],
];
export const partOf = (code) => PART.find(([re]) => re.test(code))?.[1] ?? null;
export const PART_LABEL = { D: 'Description', M: 'Manufacture', C: 'Control', S: 'Storage' };

// The R2 materials (Step 2 draft), what each holds, and whether it follows D/M/C/S.
export const MATERIALS = [
  { id: 'DS', label: 'Drug Substances', dmcs: true, holds: { D: 'Nomenclature, structure, properties and characterisation', M: 'Manufacturers, process and process controls, critical steps', C: 'Specification and its justification, batch data', S: 'Container closure, retest period or shelf life, storage' } },
  { id: 'SI', label: 'Substance Intermediates', dmcs: true, optional: true, holds: { D: 'The intermediate and its characteristics', M: 'How it is made', C: 'Its controls', S: 'Holding and storage' } },
  { id: 'SM', label: 'Starting/Source Materials', dmcs: true, holds: { D: 'The starting or source material', M: 'Its route or source', C: 'Its specification', S: 'Storage, if relevant' } },
  { id: 'RM', label: 'Raw Materials', dmcs: false, holds: { '': 'Reagents, solvents, media and other materials, with their controls; viral and TSE safety of materials of biological origin' } },
  { id: 'EX', label: 'Excipients', dmcs: true, holds: { D: 'The excipient and its function', M: 'Manufacture, for novel excipients', C: 'Specification, including human or animal origin', S: 'Storage, if relevant' } },
  { id: 'RS', label: 'Reference Standards and/or Materials', dmcs: false, holds: { '': 'Reference standards for the drug substance and drug product, their qualification and storage' } },
  { id: 'IM', label: 'Impurities', dmcs: false, module3Only: true, holds: { '': 'Characterisation of impurities in the drug substance and drug product' } },
  { id: 'DP', label: 'Drug Products', dmcs: true, holds: { D: 'Description and composition, batch formula', M: 'Manufacturers, process and process controls, validation', C: 'Specification and its justification, batch data', S: 'Container closure, shelf life, storage and in-use conditions' } },
  { id: 'PI', label: 'Product Intermediates', dmcs: true, optional: true, holds: { D: 'The intermediate', M: 'How it is made', C: 'Its controls', S: 'Hold times and storage' } },
  { id: 'MD', label: 'Medical Devices', dmcs: true, optional: true, holds: { D: 'The device or device part', M: 'Its assembly', C: 'Its performance controls', S: 'Storage' } },
  { id: 'AP', label: 'Analytical Procedures', dmcs: false, holds: { '': 'Each analytical procedure, with the summary of its validation in 2.3.4.AP and the data in 3.2.AP' } },
  { id: 'FA', label: 'Facilities', dmcs: false, holds: { '': 'Manufacturing, testing and packaging sites, and facility information such as R1 3.2.A.1' } },
];

// For each material: its parts, with the R1 documents of this dossier that feed each.
export function r2Structure(a) {
  return MATERIALS.map((m) => {
    const rows = a.rows.filter((r) => r.core.some((c) => c.startsWith(`2.3.3.${m.id} `)) || r.data.startsWith(`3.2.${m.id} `));
    const parts = m.dmcs
      ? ['D', 'M', 'C', 'S'].map((p) => ({ part: p, label: PART_LABEL[p], holds: m.holds[p], docs: rows.filter((r) => partOf(r.nodeCode) === p) }))
      : [{ part: '', label: 'Whole section', holds: m.holds[''], docs: rows }];
    if (m.dmcs) { const placed = new Set(parts.flatMap((p) => p.docs)); const rest = rows.filter((r) => !placed.has(r)); if (rest.length) parts.push({ part: '', label: 'Development and other', holds: 'Supporting development and validation data', docs: rest }); }
    return { ...m, parts, count: rows.length };
  });
}

// ---------------------------------------------------------------- drafting the new R2 content
const productKind = (productId, facts = {}) => {
  const form = String(facts.dosageForm ?? '').toLowerCase();
  return { bio: /mab|biosimilar/.test(productId), sterile: /inject|infusion|vial|sterile/.test(form), oral: /tablet|capsule/.test(form), mr: /extended|modified|delayed/.test(form) };
};

// QTPP, control strategy, ECs and PACMPs, started from the product's facts. Every row is editable.
export function starterDrafts(project, product) {
  const f = product?.facts ?? {}; const pr = product?.product ?? {};
  const k = productKind(project.productId, f);
  const row = (attribute, target, justification, cqa) => ({ attribute, target, justification, cqa });
  const qtpp = [
    row('Dosage form and strength', `${f.dosageForm ?? pr.dosageForm ?? ''}; ${f.strengths ?? (pr.strengths ?? []).join(', ')}`, 'Meets the dosing in the clinical studies.', false),
    row('Route of administration', pr.route ?? (k.sterile ? 'intravenous' : 'oral'), 'As in the pivotal studies.', false),
    row('Indication and population', f.indication ?? pr.indicationText ?? '', 'The proposed indication.', false),
    row('Shelf life and storage', `${f.shelfLife ?? ''}; ${f.storage ?? ''}`, 'Supports commercial distribution.', false),
    row('Identity', 'Positive', 'Ensures the right product.', true),
    row(k.bio ? 'Protein content' : 'Assay', f.assay ?? '', 'Delivers the labelled dose.', true),
    row(k.bio ? 'Potency' : k.oral ? (k.mr ? 'Drug release' : 'Dissolution') : 'Particulate matter', k.bio || k.oral ? f.dissolution ?? '' : 'Meets the pharmacopoeia', k.mr ? 'Controls the release profile the clinical data rest on.' : 'Linked to clinical performance.', true),
    row(k.bio ? 'Product-related variants (aggregates, charge variants)' : 'Degradation products', k.bio ? 'Within the limits supported by clinical lots' : 'Within ICH Q3B limits', 'Patient safety.', true),
  ];
  if (k.oral && !k.mr) qtpp.push(row('Uniformity of dosage units', 'Meets the pharmacopoeia', 'Each unit delivers the labelled dose.', true));
  if (k.sterile) qtpp.push(row('Sterility and bacterial endotoxins', 'Sterile; endotoxins within limits', 'Parenteral use.', true));
  else qtpp.push(row('Microbiological quality', 'Meets the pharmacopoeia', 'Patient safety.', true));
  const ctl = {
    Identity: ['Drug substance identity (3.2.S.4.1)', 'Line clearance and labelling controls', '', 'Identity test (IR or HPLC retention time)'],
    Assay: ['Drug substance assay (3.2.S.4.1)', 'Blend uniformity, compression weight control', 'Tablet weight', f.assay ?? ''],
    'Protein content': ['Drug substance protein content', 'Formulation and fill controls', 'Fill volume', f.assay ?? ''],
  };
  const cs = qtpp.filter((r) => r.cqa).map((r) => {
    const c = ctl[r.attribute] ?? ['', '', '', r.target];
    return { cqa: r.attribute, materials: c[0], process: c[1], inProcess: c[2], specification: c[3], source: k.bio ? '3.2.P.5.1, 3.2.S.2.2' : '3.2.P.5.1, 3.2.P.3.3' };
  });
  return { qtpp, cs, ec: [], pacmp: [], started: new Date().toISOString() };
}

// 2.3.5.1: the change summary, built from the dossier's own sequences.
export function changeSummary(project) {
  return sortedSequences(project).map((s) => {
    const quality = s.leaves.filter((l) => inQuality(l.nodeCode));
    return { seq: s.number, what: s.description || `${s.submissionType} / ${s.subType}`, status: s.status, quality: quality.map((l) => `${l.operation} ${displayCode(l.nodeCode)} ${l.title}`) };
  }).filter((x) => x.quality.length);
}

export const EC_CATEGORIES = ['Prior approval', 'Moderate (notify, then implement)', 'Low (annual or after implementation)'];

export function checkDrafts(d) {
  const out = [];
  const add = (sev, where, msg) => out.push({ sev, where, msg });
  if (!d) return [{ sev: 'High', where: '2.3.2', msg: 'Nothing drafted yet. Start from the product, then edit.' }];
  if ((d.qtpp ?? []).length < 5) add('Medium', '2.3.2.1', 'The QTPP has fewer than five attributes.');
  for (const r of d.qtpp ?? []) if (!String(r.target ?? '').trim()) add('High', '2.3.2.1', `"${r.attribute || 'An attribute'}" has no target.`);
  const cqas = (d.qtpp ?? []).filter((r) => r.cqa);
  if (!cqas.length) add('High', '2.3.2.1', 'No attribute is marked as a critical quality attribute.');
  for (const q of cqas) {
    const c = (d.cs ?? []).find((x) => x.cqa === q.attribute);
    if (!c) add('High', '2.3.2.3', `CQA "${q.attribute}" has no row in the control strategy.`);
    else {
      if (![c.materials, c.process, c.inProcess].some((v) => String(v ?? '').trim())) add('High', '2.3.2.3', `CQA "${q.attribute}" has no material, process or in-process control: the specification alone is not a control strategy.`);
      if (!String(c.specification ?? '').trim()) add('Medium', '2.3.2.3', `CQA "${q.attribute}" has no specification test or limit.`);
    }
  }
  for (const c of d.cs ?? []) if (!cqas.some((q) => q.attribute === c.cqa)) add('Low', '2.3.2.3', `"${c.cqa}" is in the control strategy but not a CQA in the QTPP.`);
  for (const e of d.ec ?? []) {
    if (!String(e.element ?? '').trim()) add('Medium', '2.3.5.2', 'An established condition has no element.');
    if (!EC_CATEGORIES.includes(e.category)) add('Medium', '2.3.5.2', `"${e.element || 'An element'}" has no reporting category.`);
  }
  for (const p of d.pacmp ?? []) if (!String(p.studies ?? '').trim() || !String(p.criteria ?? '').trim()) add('Medium', '2.3.5.3', `The protocol for "${p.change || 'a change'}" needs its studies and acceptance criteria.`);
  return out;
}

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const table = (head, rows) => `<table><thead><tr>${head.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${h(x)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}">None.</td></tr>`}</tbody></table>`;

// A printable page with the drafts, laid out under the R2 headings.
export function draftsHtml(project, d, product) {
  const cs = changeSummary(project);
  const pr = product?.product ?? {};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(pr.brandName ?? project.name)}: M4Q(R2) drafts</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1d2433;background:#fff}table{border-collapse:collapse;width:100%;margin:.5rem 0 1.5rem}th,td{border:1px solid #c8ccd4;padding:.35rem .5rem;text-align:left;vertical-align:top;font-size:.9rem}th{background:#eef0f4}.note{background:#fff7e0;border:1px solid #e8c770;padding:.6rem .8rem;font-size:.9rem}</style></head><body>
<p class="note">What-if under the ICH M4Q(R2) Step 2 draft (endorsed 14 May 2025; Step 4 targeted June 2027). Not for submission. Training material: fictional product and company.</p>
<h1>${h(pr.brandName ?? '')} (${h(pr.inn ?? '')}): new R2 content</h1>
<h2>2.3.2.1 Quality Target Product Profile</h2>
${table(['Attribute', 'Target', 'Justification', 'CQA'], (d.qtpp ?? []).map((r) => [r.attribute, r.target, r.justification, r.cqa ? 'Yes' : 'No']))}
<h2>2.3.2.3 Overall Control Strategy Representation</h2>
${table(['CQA', 'Material controls', 'Process controls', 'In-process controls', 'Specification', 'Supporting data (R1)'], (d.cs ?? []).map((r) => [r.cqa, r.materials, r.process, r.inProcess, r.specification, r.source]))}
<h2>2.3.5.1 Change Summary and Justifications</h2>
${table(['Sequence', 'Submission', 'Quality documents'], cs.map((x) => [x.seq, `${x.what} (${x.status})`, x.quality.join('; ')]))}
<h2>2.3.5.2 Product Lifecycle Management Document</h2>
${table(['Element', 'Established condition', 'Reporting category', 'Justification'], (d.ec ?? []).map((r) => [r.element, r.isEc === false ? 'No' : 'Yes', r.category, r.justification]))}
<h2>2.3.5.3 Content of Post-Approval Change Management Protocols</h2>
${table(['Change', 'Studies', 'Acceptance criteria', 'Proposed category'], (d.pacmp ?? []).map((r) => [r.change, r.studies, r.criteria, r.category]))}
</body></html>`;
}
