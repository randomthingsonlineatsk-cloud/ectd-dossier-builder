// Light helpers shared by the UI and the PDF generator (no pdf-lib import, so the
// heavy generator can be loaded only when a PDF is actually built).
import { INDEX } from './tree.js';

let fontLoader = null;
let fontBytesPromise = null;
export function setFontLoader(fn) { fontLoader = fn; fontBytesPromise = null; }
export async function fontBytes() {
  if (!fontLoader) return null;
  fontBytesPromise ??= fontLoader();
  return fontBytesPromise;
}

const E3 = ['Synopsis', 'Table of Contents', 'List of Abbreviations', 'Ethics', 'Investigators and Study Administrative Structure', 'Introduction', 'Study Objectives', 'Investigational Plan', 'Study Patients', 'Efficacy Evaluation', 'Safety Evaluation', 'Discussion and Overall Conclusions', 'Tables, Figures and Graphs', 'Reference List', 'Appendices'];
const NONCLIN = ['Summary', 'Introduction', 'Materials and Methods', 'Results', 'Discussion', 'Conclusion', 'References', 'Tables', 'Figures', 'Appendices'];
const QUALITY = ['Introduction', 'Summary', 'Methods', 'Results', 'Tables', 'Conclusions', 'Appendices'];
const QOS = ['Introduction', '2.3.S.1 General Information', '2.3.S.2 Manufacture', '2.3.S.3 Characterisation', '2.3.S.4 Control of Drug Substance', '2.3.S.5 Reference Standards', '2.3.S.6 Container Closure System', '2.3.S.7 Stability', '2.3.P.1 Description and Composition', '2.3.P.2 Pharmaceutical Development', '2.3.P.3 Manufacture', '2.3.P.4 Control of Excipients', '2.3.P.5 Control of Drug Product', '2.3.P.6 Reference Standards', '2.3.P.7 Container Closure System', '2.3.P.8 Stability', '2.3.A Appendices', '2.3.R Regional Information'];
const SUMMARY = ['Introduction', 'Overview', 'Methods', 'Findings', 'Benefits and Risks', 'Conclusions', 'References'];

// Realistic default bookmarks: ICH E3 headings for clinical reports, the QOS structure for 2.3,
// and section-appropriate headings elsewhere. Extra bookmarks become numbered tables/appendices.
export function defaultHeadings(doc) {
  const n = Math.max(0, doc.bookmarks ?? 0);
  if (!n) return [];
  const code = String(doc.section ?? '');
  const base = code === '2.3' ? QOS : code.startsWith('5.3') ? E3.map((h, i) => `${i + 1}. ${h}`)
    : code.startsWith('4.2') ? NONCLIN : code.startsWith('2.') ? SUMMARY : code.startsWith('3.') ? QUALITY
      : [INDEX.map[code]?.title ?? doc.title, ...SUMMARY.slice(1)];
  const out = base.slice(0, n);
  const extraLabel = code.startsWith('5.3') ? (k) => `Appendix 16.${Math.floor(k / 10) + 1}.${(k % 10) + 1}` : (k) => `Table ${k + 1}`;
  for (let k = 0; out.length < n; k++) out.push(extraLabel(k));
  return out;
}

export const bookmarkTitles = (doc) => (doc.bookmarkList?.length ? doc.bookmarkList : defaultHeadings(doc));
