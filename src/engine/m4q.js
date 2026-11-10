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
  rows.sort((a, b) => INDEX.order.indexOf(a.nodeCode) - INDEX.order.indexOf(b.nodeCode));
  const have = new Set(rows.map((r) => r.nodeCode));
  const gaps = NEW_IN_R2.map((g) => ({ ...g, label: label(g.code), sources: g.from.filter((c) => [...have].some((h) => h === c || h.startsWith(`${c}.`))) }));
  const count = (a) => rows.filter((r) => r.action === a).length;
  const placed = rows.filter((r) => r.action !== 'none').length;
  return {
    status: M4Q_STATUS, rows, gaps,
    move: count('move'), split: count('split'), rewrite: count('rewrite'), none: count('none'),
    coverage: rows.length ? Math.round((100 * placed) / rows.length) : 0,
    published: seqs.filter((s) => s.status === 'published').length,
    r2Sections: [...new Set(rows.flatMap((r) => [...r.core, r.data].filter(Boolean)))].sort(),
  };
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function m4qCsv(project, a) {
  const head = ['Sequence', 'R1 heading', 'Document', 'Action', 'R2 Module 2.3', 'R2 Module 3', 'Note'];
  const lines = [head.map(q).join(','), ...a.rows.map((r) => [r.seq, r.r1, r.title, r.action, r.core.join('; '), r.data, r.note].map(q).join(','))];
  lines.push('', q('New in R2, to be written') , ...a.gaps.map((g) => [q(''), q(g.label), q(g.why), q('write'), q(g.sources.length ? `Draw on ${g.sources.map(displayCode).join(', ')}` : 'No source in this dossier'), q(''), q('')].join(',')));
  lines.push('', q(`What-if under the ICH M4Q(R2) Step 2 draft. ${project.name}. Training material, fictional product.`));
  return lines.join('\r\n');
}
