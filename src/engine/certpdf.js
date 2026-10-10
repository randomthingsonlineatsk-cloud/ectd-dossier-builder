// Completion certificate and progress statement as PDF. Loaded only when one is made.
// Both are labelled as a portfolio exercise and not an accreditation.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fontBytes } from './pdfmeta.js';
import { sha256 } from './sha256.js';

const A4L = [841.89, 595.28];
const INK = rgb(0.11, 0.14, 0.2);
const MUTED = rgb(0.38, 0.42, 0.48);
const ACCENT = rgb(0.137, 0.329, 0.549);

// A short code that ties the certificate to the results it was made from. Anyone can
// recompute it from an exported project file; it is not a security feature.
export function verificationCode({ name, userId, status, date }) {
  const basis = JSON.stringify({ name: name.trim(), userId, date, missions: status.missionScores.map((m) => [m.id, m.score]), exam: status.exam?.score ?? null });
  const h = sha256(basis).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

async function setup() {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const bytes = await fontBytes();
  const font = bytes ? await pdf.embedFont(bytes, { subset: true }) : await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle('eCTD Dossier Builder - portfolio certificate');
  pdf.setAuthor('eCTD Dossier Builder');
  pdf.setSubject('Portfolio exercise. Not an accreditation.');
  pdf.setCreator('eCTD Dossier Builder (built by Khan Gulrez Shagufa Fazal Ahmed)');
  return { pdf, font, bold };
}

const centre = (page, text, f, size, y, color = INK) => {
  const w = f.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font: f, color });
};

export async function certificatePdf({ name, userId, status, date = new Date().toISOString().slice(0, 10) }) {
  const { pdf, font, bold } = await setup();
  const page = pdf.addPage(A4L);
  const { width: W, height: H } = page.getSize();
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: ACCENT, borderWidth: 2 });
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: ACCENT, borderWidth: 0.5 });
  ['#7a4ea8', '#2e7d74', '#b5651d', '#3b6ea8', '#a33b5a'].forEach((hex, i) => {
    const c = rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
    page.drawRectangle({ x: W / 2 - 50 + i * 20, y: H - 78, width: 16, height: 6, color: c });
  });
  centre(page, 'eCTD DOSSIER BUILDER', bold, 13, H - 104, ACCENT);
  centre(page, 'Certificate of completion', font, 30, H - 150);
  centre(page, 'This certifies that', font, 12, H - 190, MUTED);
  centre(page, name.trim(), font, 28, H - 228);
  const lines = [
    `completed every lesson, all ${status.missionScores.length} dossier missions, the mock exam and the region comparison exercises`,
    'in the eCTD Dossier Builder, a browser-based practice platform for regulatory publishing:',
    'CTD structure, eCTD v3.2.2 and v4.0, lifecycle, validation, and US, EU, Japan and India Module 1.',
  ];
  lines.forEach((t, i) => centre(page, t, font, 11.5, H - 268 - i * 17));
  if (status.distinction) centre(page, `With distinction: ${status.expertCount} missions scored at expert level.`, bold, 11.5, H - 330, ACCENT);
  const code = verificationCode({ name, userId, status, date });
  page.drawText(`Date: ${date}`, { x: 70, y: 120, size: 11, font, color: INK });
  page.drawText(`Verification code: ${code}`, { x: 70, y: 102, size: 11, font, color: INK });
  page.drawText(`Mock exam: ${status.exam?.score ?? '-'}%`, { x: 70, y: 84, size: 11, font, color: INK });
  const r = 'Built by Khan Gulrez Shagufa Fazal Ahmed';
  page.drawText(r, { x: W - 70 - font.widthOfTextAtSize(r, 11), y: 102, size: 11, font, color: INK });
  centre(page, 'PORTFOLIO EXERCISE. NOT AN ACCREDITATION OR A PROFESSIONAL QUALIFICATION.', bold, 10, 56, rgb(0.6, 0.15, 0.15));
  centre(page, 'All products, companies and documents in the exercises are fictional.', font, 9, 44, MUTED);
  pageTwo(pdf, font, bold, { name, status, code, date });
  return pdf.save();
}

function pageTwo(pdf, font, bold, { name, status, code, date }) {
  const page = pdf.addPage(A4L);
  const { width: W, height: H } = page.getSize();
  page.drawText('Record of results', { x: 60, y: H - 70, size: 18, font: bold, color: INK });
  page.drawText(`${name.trim()} · ${date} · verification code ${code}`, { x: 60, y: H - 92, size: 10, font, color: MUTED });
  let y = H - 125;
  const col = (x, t, f = font, c = INK) => page.drawText(String(t), { x, y, size: 10, font: f, color: c });
  col(60, 'Mission', bold); col(560, 'Best score', bold); col(650, 'Level', bold);
  y -= 16;
  for (const m of status.missionScores) {
    col(60, `${m.id}. ${m.title}`); col(560, m.score == null ? '-' : `${m.score}%`); col(650, m.difficulty ?? '-');
    y -= 15;
  }
  y -= 10;
  for (const c of status.criteria) { col(60, `${c.met ? '[x]' : '[ ]'} ${c.label}${c.detail ? ` (${c.detail})` : ''}`); y -= 15; }
  page.drawText('Portfolio exercise. Not an accreditation. Results come from the holder\'s own browser and can be checked against an exported project file.', { x: 60, y: 44, size: 9, font, color: MUTED });
}

// A statement of progress, available at any time, that makes no claim of completion.
export async function progressStatementPdf({ name, status, date = new Date().toISOString().slice(0, 10) }) {
  const { pdf, font, bold } = await setup();
  const page = pdf.addPage(A4L);
  const { height: H } = page.getSize();
  page.drawText('eCTD Dossier Builder: statement of progress', { x: 60, y: H - 70, size: 18, font: bold, color: INK });
  page.drawText(`${name.trim() || 'Learner'} · ${date} · not a certificate of completion`, { x: 60, y: H - 92, size: 10, font, color: MUTED });
  let y = H - 125;
  for (const c of status.criteria) { page.drawText(`${c.met ? '[x]' : '[ ]'} ${c.label}${c.detail ? ` (${c.detail})` : ''}`, { x: 60, y, size: 11, font, color: INK }); y -= 18; }
  y -= 8;
  for (const m of status.missionScores) { page.drawText(`${m.id}. ${m.title}: ${m.score == null ? '-' : `${m.score}% (${m.difficulty})`}`, { x: 60, y, size: 10, font, color: INK }); y -= 14; }
  page.drawText('Portfolio exercise. Not an accreditation.', { x: 60, y: 44, size: 9, font, color: MUTED });
  return pdf.save();
}
