// Generates fictional stub PDFs with pdf-lib. Each stub has a title page, a table of
// contents when requested, bookmarks, cross-document hyperlinks, and the document's
// planted defects built into the file where a PDF can carry them:
//   - PDF version      -> written into the file header
//   - fonts            -> embedded subset font, or a non-embedded standard font
//   - text searchable  -> scanned stubs draw image-like bars and contain no text
//   - bookmarks / TOC  -> real outline entries and internal links
//   - hyperlinks       -> GoToR links to other files; broken links point to missing files
// pdf-lib cannot encrypt, so "security set" is simulated with a banner and a metadata flag.
import { PDFDocument, StandardFonts, PDFName, PDFHexString, PDFString, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import SparkMD5 from 'spark-md5';
import { INDEX, filePath, displayCode } from './tree.js';
import { lifecycleState, PRODUCTS, docForLeaf, seqByNumber } from './model.js';
import { fileContentKey } from './backbone.js';
import { factsForDoc, FACTS } from './consistency.js';
import { sha256Bytes } from './sha256.js';

import { fontBytes, defaultHeadings, bookmarkTitles } from './pdfmeta.js';
export { setFontLoader, defaultHeadings, bookmarkTitles } from './pdfmeta.js';

const FIXED_DATE = new Date('2026-01-01T00:00:00Z');
const MAX_STUB_PAGES = 6;
const PAGE = [612, 792];

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

const BANK = {
  1: ['This administrative document is provided for the fictional application described on the title page.', 'All names, addresses and identifiers are invented for training.', 'Signature blocks are intentionally left as placeholders.'],
  2: ['This summary integrates the findings presented in the corresponding Module 3, 4 or 5 reports.', 'Cross-references point to the full reports where the data are presented in detail.', 'Conclusions are stated for the proposed indication and dosing regimen.'],
  3: ['Three primary batches were manufactured at commercial scale using the process described in this section.', 'Acceptance criteria were set on the basis of batch data, stability trends and pharmacopoeial requirements.', 'All results complied with the proposed specification.', 'The analytical procedures were validated in line with ICH Q2.'],
  4: ['Animals were dosed once daily by oral gavage for the period stated in the study design.', 'Toxicokinetic sampling confirmed systemic exposure at all dose levels.', 'The no-observed-adverse-effect level was established at the mid dose.'],
  5: ['Subjects were randomised in a 1:1:1 ratio to placebo or one of two doses.', 'The primary endpoint was met with statistical significance at both doses.', 'Adverse events were mostly mild and resolved without intervention.', 'Pharmacokinetic parameters were derived by non-compartmental analysis.'],
};

function relativePath(fromDir, to) {
  const a = fromDir.split('/').filter(Boolean);
  const b = to.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
}

// Resolves a document's hyperlinks against the current view of the dossier for a sequence.
export function linkTargets(project, doc, seqNumber, sourcePath) {
  const st = lifecycleState(project, seqNumber);
  const current = [...st.entries.values()].filter((e) => e.status === 'current' && e.leaf.operation !== 'delete');
  const fromDir = sourcePath ? sourcePath.split('/').slice(0, -1).join('/') : `${seqNumber}`;
  const out = [];
  for (const code of doc.links ?? []) {
    const hit = current.find((e) => e.leaf.nodeCode === code);
    const label = `${displayCode(code)} ${INDEX.map[code]?.title ?? ''}`.trim();
    if (hit) out.push({ label, href: relativePath(fromDir, `${hit.seq}/${filePath(hit.leaf.nodeCode, hit.leaf.fileName, project.settings)}`), ok: true });
    else out.push({ label, href: relativePath(fromDir, `${seqNumber}/missing/${code.replace(/[^a-z0-9]/gi, '')}.pdf`), ok: false });
  }
  for (let i = 0; i < (doc.brokenLinks ?? 0); i++) out.push({ label: `Appendix ${i + 1} (moved)`, href: `old-appendix-${i + 1}.pdf`, ok: false });
  return out;
}

function addOutline(pdf, items) {
  if (!items.length) return;
  const ctx = pdf.context;
  const pages = pdf.getPages();
  const outlinesRef = ctx.nextRef();
  const refs = items.map(() => ctx.nextRef());
  items.forEach((it, i) => {
    const d = {
      Title: PDFHexString.fromText(it.title),
      Parent: outlinesRef,
      Dest: [pages[it.page].ref, 'XYZ', null, null, null],
    };
    if (i > 0) d.Prev = refs[i - 1];
    if (i < items.length - 1) d.Next = refs[i + 1];
    ctx.assign(refs[i], ctx.obj(d));
  });
  ctx.assign(outlinesRef, ctx.obj({ Type: 'Outlines', First: refs[0], Last: refs[refs.length - 1], Count: items.length }));
  pdf.catalog.set(PDFName.of('Outlines'), outlinesRef);
  pdf.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

function addLink(pdf, page, rect, action) {
  const ctx = pdf.context;
  const annot = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0], A: action }));
  const annots = page.node.lookup(PDFName.of('Annots'));
  if (annots) annots.push(annot); else page.node.set(PDFName.of('Annots'), ctx.obj([annot]));
}

const WIN_ANSI_SAFE = (s) => String(s ?? '').replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

function wrap(text, font, size, width) {
  const words = text.split(/\s+/);
  const space = font.widthOfTextAtSize(' ', size);
  const lines = [];
  let line = '';
  let lw = 0;
  for (const w of words) {
    const ww = font.widthOfTextAtSize(w, size);
    if (line && lw + space + ww > width) { lines.push(line); line = w; lw = ww; } else { line = line ? `${line} ${w}` : w; lw = line === w ? ww : lw + space + ww; }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateStubPdf(project, doc, opts = {}) {
  const p = PRODUCTS[project.productId];
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title || doc.fileName, { showInWindowTitleBar: true });
  pdf.setAuthor(project.settings.applicant?.name ?? 'Fictional applicant');
  pdf.setSubject(`${displayCode(doc.section)} - TRAINING ONLY, fictional, not for submission`);
  pdf.setCreator('eCTD Dossier Builder (training)');
  pdf.setProducer('eCTD Dossier Builder stub generator');
  pdf.setKeywords(['training', 'fictional', displayCode(doc.section)]);
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  pdf.setLanguage('en-US');

  let font, bold;
  const fb = doc.fontsEmbedded ? await fontBytes() : null;
  if (fb) {
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(fb, { subset: true });
    bold = font;
  } else {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  const T = fb ? (s) => String(s ?? '') : WIN_ANSI_SAFE;
  const scanned = !doc.textSearchable;
  const ink = rgb(0.11, 0.14, 0.2);
  const grey = rgb(0.45, 0.48, 0.55);
  const rnd = seeded(doc.id + (doc.version ?? 1));

  const stubPages = Math.max(1, Math.min(doc.pages ?? 1, MAX_STUB_PAGES));
  const headings = bookmarkTitles(doc);
  const hasToc = !!doc.toc && stubPages > 1;
  for (let i = 0; i < stubPages; i++) pdf.addPage(PAGE);
  const pages = pdf.getPages();
  const contentStart = hasToc ? 2 : 1;
  const contentPages = Math.max(1, stubPages - contentStart);

  // Text or, for scanned stubs, image-like bars with no text objects.
  const text = (page, s, x, y, size, f = font, color = ink) => {
    if (scanned) {
      const w = Math.min(470, f.widthOfTextAtSize(T(s), size));
      page.drawRectangle({ x, y: y - 1, width: w, height: size * 0.7, color: rgb(0.55, 0.55, 0.55), opacity: 0.55 });
      return;
    }
    page.drawText(T(s), { x, y, size, font: f, color });
  };

  pages.forEach((page, i) => {
    if (scanned) page.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: rgb(0.96, 0.95, 0.92) });
    if (!scanned) page.drawText('TRAINING ONLY', { x: 140, y: 300, size: 64, font: bold, color: rgb(0.85, 0.87, 0.9), rotate: degrees(35), opacity: 0.6 });
    text(page, `${doc.fileName} | stub page ${i + 1} of ${stubPages} (represents ${doc.pages} pages) | fictional training document`, 50, 30, 8, font, grey);
  });

  // Title page
  const tp = pages[0];
  text(tp, 'TRAINING ONLY - FICTIONAL - NOT FOR SUBMISSION', 50, 740, 10, bold, rgb(0.72, 0.2, 0.16));
  text(tp, project.settings.applicant?.name ?? '', 50, 700, 12, font, grey);
  text(tp, `${p.product.brandName} (${p.product.inn}) ${p.product.dosageForm}, ${p.product.strengths.join(', ')}`, 50, 680, 12, font, grey);
  text(tp, `${displayCode(doc.section)}  ${INDEX.map[doc.section]?.title ?? ''}`, 50, 620, 14, bold);
  const titleLines = wrap(T(doc.title || doc.fileName), bold, 22, 500);
  titleLines.forEach((l, i) => text(tp, l, 50, 585 - i * 28, 22, bold));
  let y = 585 - titleLines.length * 28 - 20;
  text(tp, `Version ${doc.version ?? 1}`, 50, y, 11, font, grey);
  y -= 18;
  text(tp, `File: ${doc.fileName}`, 50, y, 11, font, grey);
  if (doc.lang === 'ja') { y -= 18; text(tp, 'Japanese-language document (stub content shown in English for training)', 50, y, 10, font, rgb(0.42, 0.36, 0.65)); }
  if (doc.secured) {
    tp.drawRectangle({ x: 45, y: 120, width: 520, height: 46, color: rgb(0.98, 0.9, 0.88) });
    text(tp, 'Simulated document security: a password is set to restrict editing and copying.', 55, 148, 10, bold, rgb(0.72, 0.2, 0.16));
    text(tp, 'Reviewers cannot annotate or copy from secured files. Remove security before publishing.', 55, 132, 9, font, rgb(0.72, 0.2, 0.16));
  }
  if (doc.content) {
    const ls = doc.content.split('\n');
    let yy = y - 30;
    for (const raw of ls) for (const l of wrap(T(raw) || ' ', font, 9.5, 500)) { if (yy < 60) break; text(tp, l, 50, yy, 9.5); yy -= 13; }
  }

  // Table of contents with internal links
  // Headings are spread over the content pages in order, so bookmarks follow the document.
  const outline = headings.map((h, i) => {
    const pg = contentStart + Math.floor((i * contentPages) / Math.max(1, headings.length));
    return { title: h, page: pg < stubPages ? pg : 0 };
  });
  if (hasToc) {
    const toc = pages[1];
    text(toc, 'Table of Contents', 50, 730, 16, bold);
    let ty = 700;
    outline.slice(0, 40).forEach((o) => {
      if (ty < 60) return;
      text(toc, o.title, 60, ty, 10);
      text(toc, String(o.page + 1), 540, ty, 10);
      if (!scanned) addLink(pdf, toc, [55, ty - 3, 560, ty + 11], { S: 'GoTo', D: [pages[o.page].ref, 'XYZ', null, null, null] });
      ty -= 16;
    });
  }

  // Structured facts this document states (compared by the consistency QC), boxed at the
  // top of the first content page.
  const facts = factsForDoc(project, doc);
  const factKeys = Object.keys(facts);
  let factsBottom = 760;
  if (factKeys.length && stubPages > contentStart) {
    const fp = pages[contentStart];
    const boxH = 24 + factKeys.length * 14;
    if (!scanned) fp.drawRectangle({ x: 45, y: 752 - boxH, width: 520, height: boxH, color: rgb(0.95, 0.96, 0.97), borderColor: rgb(0.8, 0.83, 0.87), borderWidth: 0.5 });
    text(fp, 'Key facts stated in this document', 55, 736, 10.5, bold);
    factKeys.forEach((k, i) => text(fp, `${FACTS.find((f) => f.key === k).label}: ${facts[k]}`, 55, 720 - i * 14, 9.5));
    factsBottom = 752 - boxH - 10;
  }

  // Content pages: headings and invented text
  const mod = String(doc.section).split('.')[0];
  const bank = BANK[mod] ?? BANK[2];
  for (let pi = contentStart; pi < stubPages; pi++) {
    const page = pages[pi];
    let cy = pi === contentStart ? Math.min(740, factsBottom - 14) : 740;
    const hs = outline.filter((o) => o.page === pi).slice(0, 5);
    const list = hs.length ? hs : [{ title: `${doc.section} (continued)` }];
    for (const h of list) {
      text(page, h.title, 50, cy, 13, bold); cy -= 22;
      const n = 3 + Math.floor(rnd() * 3);
      const para = Array.from({ length: n }, () => bank[Math.floor(rnd() * bank.length)]).join(' ');
      for (const l of wrap(T(para), font, 10.5, 510)) { if (cy < 80) break; text(page, l, 50, cy, 10.5); cy -= 15; }
      cy -= 14;
      if (cy < 120) break;
    }
  }

  // Cross-document hyperlinks on the last page
  const links = opts.links ?? [];
  if (links.length) {
    const lp = pages[stubPages - 1];
    let ly = 190;
    text(lp, 'Cross-references', 50, ly, 12, bold); ly -= 18;
    for (const l of links) {
      text(lp, `See ${l.label}`, 60, ly, 10, font, rgb(0.14, 0.33, 0.55));
      if (!scanned) addLink(pdf, lp, [55, ly - 3, 400, ly + 11], { S: 'GoToR', F: PDFString.of(l.href), D: [0, 'Fit'] });
      ly -= 15;
      if (ly < 50) break;
    }
  }

  addOutline(pdf, (doc.bookmarks ?? 0) > 0 && headings.length ? outline : []);
  if (doc.secured) pdf.getInfoDict().set(PDFName.of('TrainingSecurity'), PDFString.of('simulated: password set'));

  const bytes = await pdf.save({ useObjectStreams: false });
  // Write the declared PDF version into the header (%PDF-1.x).
  const v = /^1\.[0-9]$/.test(doc.pdfVersion) ? doc.pdfVersion : '1.7';
  bytes[5] = v.charCodeAt(0); bytes[7] = v.charCodeAt(2);
  return bytes;
}

export const md5Bytes = (bytes) => SparkMD5.ArrayBuffer.hash(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

export async function leafPdf(project, seqNumber, leaf) {
  const doc = docForLeaf(project, leaf);
  if (!doc) return null;
  const path = `${seqNumber}/${filePath(leaf.nodeCode, leaf.fileName, project.settings)}`;
  return generateStubPdf(project, doc, { links: linkTargets(project, doc, seqNumber, path) });
}

// Generates every file in a sequence and records its real MD5 on the document, so the
// backbone carries checksums of the actual bytes. Call before publishing.
export async function computeSequenceChecksums(project, seqNumber) {
  const seq = seqByNumber(project, seqNumber);
  for (const leaf of seq.leaves) {
    if (leaf.operation === 'delete' || leaf.operation === 'suspend' || leaf.frozenDoc) continue;
    const doc = project.documents[leaf.docId];
    if (!doc) continue;
    const bytes = await leafPdf(project, seqNumber, leaf);
    doc.md5 = md5Bytes(bytes);
    doc.md5Key = fileContentKey(doc);
    if (project.ectdVersion === '4.0') { doc.sha256 = sha256Bytes(bytes); doc.sha256Key = doc.md5Key; }
    doc.byteSize = bytes.length;
  }
}
