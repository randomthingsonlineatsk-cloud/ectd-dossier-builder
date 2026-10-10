// Validation report export as CSV and PDF.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { RULES } from './validate.js';
import { PRODUCTS } from './model.js';

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function validationCsv(project, seq, result) {
  const rows = [['Sequence', 'Severity', 'Rule', 'Family', 'Rule title', 'Heading', 'Finding', 'How to fix']];
  for (const f of result.findings) rows.push([seq.number, f.severity, f.ruleId, f.family, f.title, f.nodeCode ?? '', f.message, RULES[f.ruleId]?.fix ?? '']);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const SAFE = (s) => String(s ?? '').replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

export async function validationPdf(project, seq, result) {
  const p = PRODUCTS[project.productId];
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Validation report - sequence ${seq.number}`);
  pdf.setCreator('eCTD Dossier Builder (training)');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 612; const H = 792; const M = 50;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const colors = { High: rgb(0.72, 0.2, 0.16), Medium: rgb(0.6, 0.42, 0), Low: rgb(0.3, 0.36, 0.48) };
  const line = (text, size = 10, f = font, color = rgb(0.11, 0.14, 0.2), indent = 0) => {
    const words = SAFE(text).split(/\s+/);
    let cur = '';
    const flush = () => {
      if (y < M + 20) { page = pdf.addPage([W, H]); y = H - M; }
      page.drawText(cur, { x: M + indent, y, size, font: f, color });
      y -= size * 1.35;
      cur = '';
    };
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > W - 2 * M - indent && cur) { flush(); cur = w; } else cur = t;
    }
    if (cur) flush();
  };
  line('TRAINING ONLY - fictional dossier, not for submission', 9, bold, colors.High);
  y -= 6;
  line(`Validation report: sequence ${seq.number}`, 18, bold);
  line(`${project.name} | ${p.product.brandName} (${p.product.inn}) | ${project.region} ${project.appType.toUpperCase()} | eCTD ${project.ectdVersion}`, 10);
  line(`Profile: US eCTD v3.2.2 core rules | Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, 9);
  y -= 8;
  line(result.verdict.text, 12, bold, result.counts.High ? colors.High : result.counts.Medium ? colors.Medium : rgb(0.18, 0.48, 0.27));
  line(`High ${result.counts.High}   Medium ${result.counts.Medium}   Low ${result.counts.Low}`, 10);
  y -= 10;
  if (!result.findings.length) line('No findings.', 11);
  for (const f of result.findings) {
    if (y < M + 60) { page = pdf.addPage([W, H]); y = H - M; }
    line(`${f.severity.toUpperCase()}  ${f.ruleId}  ${f.title}`, 10.5, bold, colors[f.severity]);
    line(`${f.nodeCode ? `[${f.nodeCode}] ` : ''}${f.message}`, 9.5, font, undefined, 12);
    line(`Fix: ${RULES[f.ruleId]?.fix ?? ''}`, 9, font, rgb(0.42, 0.46, 0.54), 12);
    y -= 6;
  }
  pdf.getPages().forEach((pg, i, all) => pg.drawText(`Built by Khan Gulrez Shagufa Fazal Ahmed | eCTD Dossier Builder | page ${i + 1} of ${all.length}`, { x: M, y: 25, size: 8, font, color: rgb(0.45, 0.48, 0.55) }));
  return pdf.save();
}
