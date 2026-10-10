// Generates a product's regional Module 1 documents from its data, so every product
// gets a consistent EU Module 1 set (and a US NDA set when its file does not list one).
// File names follow each region's conventions; all content is fictional.

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const LANG_NAME = { en: 'English', nl: 'Dutch', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', sv: 'Swedish', da: 'Danish', pl: 'Polish', pt: 'Portuguese' };
const STATE_LANG = { nl: 'nl', de: 'de', fr: 'fr', ie: 'en', be: 'nl', es: 'es', it: 'it', se: 'sv', at: 'de', dk: 'da', pl: 'pl', pt: 'pt' };

// EU documents for a non-centralised procedure: country folders instead of 'ema', national
// product information for every receiving member state, and the centralised set left as a trap.
function euNationalDocs(p, eu) {
  const states = eu.procedureType === 'national' ? [eu.rms] : [eu.rms, ...(eu.cms ?? [])];
  const base = euDocs(p).map((d) => {
    if (d.id === 'eu-pi') return { ...d, id: 'eu-pi-ema', country: 'ema', title: `${d.title} (centralised, EMA folder)`, decoy: 'wrong-procedure', coach: 'This is the product information for a centralised procedure, filed in the "ema" folder. In a decentralised procedure each member state gets its own product information in its own folder and language.' };
    if (d.id === 'eu-eaf') return { ...d, country: eu.rms, fileName: d.fileName.replace(/^ema-/, `${eu.rms}-`) };
    return { ...d, fileName: d.fileName.replace(/^ema-/, 'common-'), country: /^ema-/.test(d.fileName) ? 'common' : undefined };
  });
  const form = slug(p.product.dosageForm.split(',')[0]).split('-').pop();
  const str = slug(p.product.strengths.map((x) => x.replace(/\s+/g, '').replace(/\//g, 'per')).join('-'));
  const national = states.filter(Boolean).map((cc) => ({
    id: `eu-pi-${cc}`, section: 'eu:1.3.1', region: 'EU', country: cc, lang: STATE_LANG[cc] ?? 'en',
    title: `SmPC, Labelling and Package Leaflet (${LANG_NAME[STATE_LANG[cc]] ?? 'English'}) - ${p.product.brandName} - ${cc.toUpperCase()}`,
    fileName: `${cc}-combined-${form}${str}.pdf`, pages: 46, bookmarks: 16,
  }));
  return [...base, ...national];
}

export function euDocs(p) {
  const form = slug(p.product.dosageForm.split(',')[0]).split('-').pop();
  const str = slug(p.product.strengths.map((x) => x.replace(/\s+/g, '').replace(/\//g, 'per')).join('-'));
  return [
    { id: 'eu-eaf', section: 'eu:1.2', form: 'eaf', title: 'Electronic Application Form (eAF)', fileName: 'ema-form-eaf.pdf', pages: 34, bookmarks: 12 },
    { id: 'eu-eaf-annexes', section: 'eu:1.2', title: 'Application Form Annexes (proof of payment, GMP certificates, letters of access)', fileName: 'ema-form-annexes.pdf', pages: 22, bookmarks: 9 },
    { id: 'eu-pi', section: 'eu:1.3.1', title: `SmPC, Annex II, Labelling and Package Leaflet (English) - ${p.product.brandName}`, fileName: `ema-combined-${form}${str}.pdf`, pages: 46, bookmarks: 16 },
    { id: 'eu-mockup', section: 'eu:1.3.2', title: 'Mock-ups: Outer Carton and Immediate Packaging', fileName: `ema-outer-${form}${str}.pdf`, pages: 6 },
    { id: 'eu-consult', section: 'eu:1.3.4', title: 'User Consultation (Readability Test) Report', fileName: 'ema-consultation.pdf', pages: 28, bookmarks: 8 },
    { id: 'eu-exp-q', section: 'eu:1.4.1', title: 'Information about the Expert - Quality', fileName: 'quality.pdf', pages: 3 },
    { id: 'eu-exp-nc', section: 'eu:1.4.2', title: 'Information about the Expert - Non-Clinical', fileName: 'nonclinical.pdf', pages: 3 },
    { id: 'eu-exp-c', section: 'eu:1.4.3', title: 'Information about the Expert - Clinical', fileName: 'clinical.pdf', pages: 3 },
    { id: 'eu-era', section: 'eu:1.6.1', title: 'Environmental Risk Assessment', fileName: 'nongmo.pdf', pages: 14, bookmarks: 6 },
    { id: 'eu-pv', section: 'eu:1.8.1', title: 'Summary of the Applicant\'s Pharmacovigilance System', fileName: 'phvig-system.pdf', pages: 4 },
    { id: 'eu-rmp', section: 'eu:1.8.2', title: `EU Risk Management Plan - ${p.product.brandName}`, fileName: 'riskmgt-system.pdf', pages: 64, bookmarks: 22 },
    { id: 'eu-paed', section: 'eu:1.10', title: 'Paediatric Investigation Plan Decision and Compliance', fileName: 'paediatrics.pdf', pages: 6, bookmarks: 3 },
  ].concat(p.euExtras ?? []).map((d) => ({ ...d, region: 'EU' }));
}

export function usNdaDocs(p) {
  return [
    { id: 'us-356h', section: '1.1', form: 'fda-356h', title: 'Form FDA 356h', fileName: 'fda-356h.pdf', pages: 4 },
    { id: 'us-3397', section: '1.1', form: 'fda-3397', title: 'Form FDA 3397 User Fee Coversheet', fileName: 'fda-3397.pdf', pages: 1 },
    { id: 'us-3674', section: '1.1', form: 'fda-3674', title: 'Form FDA 3674 Certification of Compliance', fileName: 'fda-3674.pdf', pages: 2 },
    { id: 'us-fieldcopy', section: '1.3.2', title: 'Field Copy Certification', fileName: 'field-copy-certification.pdf', pages: 1 },
    { id: 'us-debar', section: '1.3.3', title: 'Debarment Certification', fileName: 'debarment-certification.pdf', pages: 1 },
    { id: 'us-findisc', section: '1.3.4', title: 'Financial Certification (Form FDA 3454)', fileName: 'financial-certification.pdf', pages: 3 },
    { id: 'us-patent', section: '1.3.5.1', form: 'fda-3542a', title: 'Patent Information (Form FDA 3542a)', fileName: 'patent-information.pdf', pages: 5 },
    { id: 'us-envir', section: '1.12.14', title: 'Claim of Categorical Exclusion from Environmental Assessment', fileName: 'environmental-analysis.pdf', pages: 2 },
    { id: 'us-carton', section: '1.14.1.1', title: 'Draft Carton and Container Labels', fileName: 'draft-carton-container-labels.pdf', pages: 4 },
    { id: 'us-pi', section: '1.14.1.3', title: 'Draft Prescribing Information', fileName: 'draft-labeling-text.pdf', pages: 22, bookmarks: 17 },
  ].map((d) => ({ ...d, region: 'US' }));
}

// Japan: Module 1 in Japanese, plus Japanese translations of every Module 2 document.
// The English Module 2 originals stay in the library, so the publisher must pick the right one.
export function jpDocs(p) {
  const m1 = [
    ['jp:1.1.1', 'Table of Contents (Japanese)', 'toc.pdf', 4],
    ['jp:1.2', 'Copy of the Application Form (Japanese)', 'application-form.pdf', 6, { form: 'jp-form' }],
    ['jp:1.3', 'Certification Documents and Affidavit for Scanned Pages', 'certificates.pdf', 8],
    ['jp:1.4', 'Patent Status (Japanese)', 'patent-status.pdf', 3],
    ['jp:1.5', 'Origin or Discovery and Development History (Japanese)', 'development-history.pdf', 14],
    ['jp:1.6', 'Information on Use in Foreign Countries (Japanese)', 'foreign-use.pdf', 12],
    ['jp:1.7', 'List of Similar Drugs (Japanese)', 'similar-drugs.pdf', 6],
    ['jp:1.8', 'Draft Package Insert (Japanese)', 'package-insert-draft.pdf', 10],
    ['jp:1.9', 'Documents Related to the Non-proprietary Name (JAN)', 'jan-documents.pdf', 3],
    ['jp:1.10', 'Summary for Poisonous/Powerful Drug Designation (Japanese)', 'poisonous-powerful-summary.pdf', 4],
    ['jp:1.11', 'Draft Risk Management Plan (Japanese)', 'rmp-draft.pdf', 30],
    ['jp:1.12', 'List of Attached Documents (Japanese)', 'attachments-list.pdf', 5],
  ].map(([section, title, fileName, pages, extra]) => ({ id: `jp-${section.slice(3).replace(/\./g, '-')}`, section, title, fileName, pages, lang: 'ja', region: 'JP', ...(extra ?? {}) }));
  const m2 = p.documents.filter((d) => String(d.section).startsWith('2.') && !d.decoy && !d.irOnly)
    .map((d) => ({ ...d, id: `${d.id}-ja`, title: `${d.title} (Japanese)`, lang: 'ja', region: 'JP', note: 'Japanese translation of the Module 2 document.' }));
  return [...m1, ...m2];
}

// India clinical trial application (Form CT-04) for a multinational phase 3 study.
export function inCtaDocs(p) {
  const study = Object.keys(p.studies ?? {}).find((k) => /3\d\d$/.test(k)) ?? 'STUDY-301';
  return [
    ['in:1.2.1', 'Brief Introduction about the Sponsor', 'sponsor-introduction.pdf', 3],
    ['in:1.2.2', 'Form CT-04: Application for Permission to Conduct a Clinical Trial of a New Drug', 'form-ct-04.pdf', 6, { form: 'ct-04' }],
    ['in:1.2.2', 'Fee Payment Receipt (Sixth Schedule, Phase III)', 'fee-receipt.pdf', 1, { form: 'fee' }],
    ['in:1.2.2', 'Form CT-18: Application for Permission to Import a New Drug for Sale or Distribution', 'form-ct-18.pdf', 6, { form: 'ct-18', decoy: 'wrong-form', coach: 'CT-18 is for permission to import a new drug for sale. A clinical trial is applied for in Form CT-04.' }],
    ['in:1.2.3', 'Authorisation of the Indian Representative (Clinical Research Organisation)', 'representative-authorisation.pdf', 2],
    ['in:1.2.4', 'Coordinates: Sponsor Contact and Trial Sites in India', 'coordinates.pdf', 3],
    ['in:1.5', 'Regulatory Status of the Trial in Other Countries', 'regulatory-status.pdf', 4],
    ['in:ct.1', `Clinical Trial Protocol ${study} (India sites)`, `${study.toLowerCase()}-protocol.pdf`, 120, { bookmarks: 16 }],
    ['in:ct.2', `Investigator's Brochure - ${p.product.inn} (Edition 4)`, 'investigators-brochure.pdf', 140, { bookmarks: 14 }],
    ['in:ct.3', 'Participant Information Sheet and Informed Consent Form (English, Hindi, Marathi)', 'informed-consent-documents.pdf', 18],
    ['in:ct.4', "Investigators' Undertakings (all India sites)", 'investigator-undertakings.pdf', 12],
    ['in:ct.5', 'Ethics Committee Approval (lead site)', 'ethics-committee-approval.pdf', 3, { later: true, note: 'Arrives after the application; the trial cannot start without it.' }],
  ].map(([section, title, fileName, pages, extra], i) => ({ id: `in-ct-${i + 1}`, section, title, fileName, pages, region: 'IN', ...(extra ?? {}) }));
}

export function inDocs(p) {
  return [
    ['in:1.2.1', 'Brief Introduction about the Applicant Company', 'applicant-introduction.pdf', 3],
    ['in:1.2.2', 'Form CT-18: Application for Permission to Import a New Drug for Sale or Distribution', 'form-ct-18.pdf', 6, { form: 'ct-18' }],
    ['in:1.2.2', 'Form CT-21: Application for Permission to Manufacture a New Drug for Sale or Distribution', 'form-ct-21.pdf', 6, { form: 'ct-21' }],
    ['in:1.2.2', 'Fee Payment Receipt', 'fee-receipt.pdf', 1, { form: 'fee' }],
    ['in:1.2.3', 'Power of Attorney: Authorisation of the Indian Agent', 'agent-authorisation.pdf', 3],
    ['in:1.2.3', 'Certificate of Pharmaceutical Product and GMP Certificates', 'copp-gmp-certificates.pdf', 8],
    ['in:1.2.4', 'Coordinates: Responsible Officials and Authorised Agent in India', 'coordinates.pdf', 2],
    ['in:1.3', 'Prescribing Information, Labels and Carton Drafts', 'prescribing-information-labels.pdf', 18],
    ['in:1.4', 'Summary of Testing Protocols for Quality Control', 'qc-testing-protocols.pdf', 9],
    ['in:1.5', 'Regulatory Status in Other Countries and Request to Waive the Local Clinical Trial', 'regulatory-status-waiver.pdf', 7],
    ['in:1.6', 'Domestic Price in the Country of Origin (INR)', 'price-country-of-origin.pdf', 1],
    ['in:1.7', 'Profile of the Manufacturer\'s Research Activity', 'research-profile.pdf', 4],
    ['in:1.8', 'Profile of the Manufacturer\'s Business Activity', 'business-profile.pdf', 4],
  ].map(([section, title, fileName, pages, extra], i) => ({ id: `in-${i + 1}`, section, title, fileName, pages, region: 'IN', ...(extra ?? {}) }));
}

// US IND: the initial IND's Module 1 plus the first-in-human protocol and investigator's brochure.
export function usIndDocs(p) {
  const first = Object.keys(p.studies ?? {})[0] ?? 'STUDY-101';
  return [
    { id: 'ind-1571', section: '1.1', form: 'fda-1571', title: 'Form FDA 1571 Investigational New Drug Application', fileName: 'fda-1571.pdf', pages: 2 },
    { id: 'ind-1572', section: '1.1', form: 'fda-1572', title: 'Form FDA 1572 Statement of Investigator', fileName: 'fda-1572.pdf', pages: 2 },
    { id: 'ind-3674', section: '1.1', form: 'fda-3674', title: 'Form FDA 3674 Certification of Compliance', fileName: 'fda-3674.pdf', pages: 2 },
    { id: 'ind-plan', section: '1.20', title: 'Introductory Statement and General Investigational Plan', fileName: 'general-investigational-plan.pdf', pages: 9, bookmarks: 4 },
    { id: 'ind-ib', section: '1.14.4.1', title: `Investigator's Brochure - ${p.product.inn} (Edition 1)`, fileName: 'investigators-brochure.pdf', pages: 64, bookmarks: 12 },
    { id: 'ind-envir', section: '1.12.14', title: 'Claim of Categorical Exclusion from Environmental Assessment (21 CFR 25.31(e))', fileName: 'environmental-analysis.pdf', pages: 1 },
    { id: 'ind-protocol', section: '5.3.3.1', title: `Study ${first}: Protocol - first-in-human single and multiple ascending dose study`, fileName: `${first.toLowerCase()}-protocol.pdf`, pages: 86, bookmarks: 14, fileTag: 'protocol-or-amendment', study: first },
    { id: 'ind-nda-356h', section: '1.1', form: 'fda-356h', title: 'Form FDA 356h', fileName: 'fda-356h.pdf', pages: 4, decoy: 'wrong-form', coach: 'Form FDA 356h is the marketing application form. An IND uses Form FDA 1571.' },
  ].map((d) => ({ ...d, region: 'US' }));
}

// US Type II DMF: the holder's own submission for the drug substance.
export function usDmfDocs(p) {
  const holder = p.substanceManufacturer;
  return [
    { id: 'dmf-3938', section: '1.1', form: 'fda-3938', title: 'Form FDA 3938 Drug Master File Submission', fileName: 'fda-3938.pdf', pages: 2 },
    { id: 'dmf-loa', section: '1.4.1', title: `Letter of Authorization - ${p.applicant.name} (${p.product.brandName} NDA)`, fileName: 'letter-of-authorization.pdf', pages: 1, later: true, note: 'Filed when Corvane authorizes a customer to reference the DMF.' },
    { id: 'dmf-qos', section: '2.3', title: `Quality Overall Summary - Drug Substance (${p.product.inn}, ${holder.name})`, fileName: 'quality-overall-summary.pdf', pages: 38, bookmarks: 9, links: ['3.2.S.4.1', '3.2.S.7.1'] },
  ].map((d) => ({ ...d, region: 'US' }));
}

// Library bases for variants: which of the product's own documents a variant starts from.
export function libraryBase(p, kind) {
  const docs = p.documents.filter((d) => !d.decoy);
  if (kind === 'ind') {
    const notYet = ['3.2.S.2.5', '3.2.P.3.5', '3.2.A.1', '3.2.R', '4.2.3.4.1', '4.2.3.4.2', '4.2.3.5.3'];
    return docs.filter((d) => /^(3\.2\.|4\.)/.test(d.section) && !notYet.includes(d.section));
  }
  if (kind === 'dmf') return docs.filter((d) => d.section.startsWith('3.2.S'));
  if (kind === 'asmf') return asmfDocs(p);
  if (kind === 'cta') {
    const later = ['3.2.S.2.5', '3.2.P.3.5', '3.2.R', '3.2.A.1'];
    return docs.filter((d) => /^(3\.2\.|4\.)/.test(d.section) && !later.includes(d.section));
  }
  return p.documents;
}

// EU ASMF: the active substance manufacturer's own dossier, split into the applicant's part
// (AP, shared with the MA applicant) and the restricted part (RP, for the authorities only).
const RP_ONLY = ['3.2.S.2.3', '3.2.S.2.4', '3.2.S.2.5', '3.2.S.2.6'];
const BOTH = ['3.2.S.2.2', '3.2.S.3.2'];
export function asmfDocs(p) {
  const holder = p.substanceManufacturer;
  const sDocs = p.documents.filter((d) => d.section.startsWith('3.2.S') && !d.decoy);
  const mk = (d, part, extra = {}) => ({ ...d, id: `${part}-${d.id}`, part, title: `${d.title} - ${part.toUpperCase()}`, fileName: d.fileName.replace(/\.pdf$/, `-${part}.pdf`), ...extra });
  const out = [];
  for (const d of sDocs) {
    if (!RP_ONLY.includes(d.section)) out.push(mk(d, 'ap', BOTH.includes(d.section) ? { title: `${d.title} (outline) - AP` } : {}));
    if (RP_ONLY.includes(d.section) || BOTH.includes(d.section)) out.push(mk(d, 'rp', BOTH.includes(d.section) ? { title: `${d.title} (detailed) - RP`, pages: (d.pages ?? 10) * 2 } : {}));
  }
  const s23 = sDocs.find((d) => d.section === '3.2.S.2.3');
  if (s23) out.push({ ...mk(s23, 'ap'), id: 'ap-trap-s23', title: `${s23.title} (full supplier and route details) - AP`, decoy: 'rp-in-ap', coach: 'The full detail of materials and the route of synthesis is confidential: it belongs in the restricted part, which the MA applicant never sees.' });
  return [
    { id: 'asmf-qos-ap', section: '2.3', part: 'ap', title: `Quality Overall Summary - ${p.product.inn} - AP`, fileName: 'quality-overall-summary-ap.pdf', pages: 24, bookmarks: 8 },
    { id: 'asmf-qos-rp', section: '2.3', part: 'rp', title: `Quality Overall Summary - ${p.product.inn} - RP`, fileName: 'quality-overall-summary-rp.pdf', pages: 18, bookmarks: 6 },
    { id: 'asmf-expert', section: 'eu:1.4.1', region: 'EU', title: `Information about the Expert - Quality (${holder.name})`, fileName: 'quality.pdf', pages: 3 },
    ...out,
  ];
}

// Canada: the Canadian Module 1 for a new drug submission.
export function caDocs(p) {
  return [
    ['ca:1.0.2', 'Life Cycle Management Table', 'life-cycle-management-table.pdf', 2],
    ['ca:1.2.4.1', 'Patent List (Form IV)', 'patent-list.pdf', 3],
    ['ca:1.2.4.2', 'Data Protection Information (innovative drug)', 'data-protection.pdf', 2],
    ['ca:1.2.5', 'Compliance and Site Information (manufacturing and testing sites)', 'site-information.pdf', 8],
    ['ca:1.2.7', 'International Information (decisions of other regulators)', 'international-information.pdf', 6],
    ['ca:1.3.1', `Product Monograph - ${p.product.brandName}`, 'product-monograph.pdf', 48, { bookmarks: 20 }],
    ['ca:1.3.2', 'Inner and Outer Labels (English and French)', 'labels.pdf', 6],
    ['ca:1.3.3', 'Non-Canadian Labelling (US prescribing information and EU SmPC)', 'non-canadian-labelling.pdf', 60],
    ['ca:1.3.6', 'Certified Product Information Document - Chemical Entities (CPID-CE)', 'cpid-ce.pdf', 22, { bookmarks: 8 }],
    ['ca:1.3.8.2', 'Risk Management Plan (with Canadian addendum)', 'risk-management-plan.pdf', 70, { bookmarks: 18 }],
    ['ca:1.2.2', 'Fee Form for Drug Submissions', 'fee-form.pdf', 2, { decoy: 'no-docs', coach: "Health Canada's guidance says to place no documents in 1.2.2: the fee form is part of the regulatory transaction." }],
    ['ca:1.5', 'Environmental Assessment Statement', 'environmental-assessment.pdf', 2, { decoy: 'no-docs', coach: "Health Canada's guidance says to place no documents in 1.5." }],
  ].map(([section, title, fileName, pages, extra], i) => ({ id: `ca-${i + 1}`, section, title, fileName, pages, region: 'CA', ...(extra ?? {}) }));
}

// Switzerland: the Swiss Module 1 for a new active substance.
export function chDocs(p) {
  return [
    ['ch:1.2.1', 'Application Form (new authorisation)', 'application-form.pdf', 8],
    ['ch:1.2.2', 'Additional Forms (full declaration, manufacturer information)', 'additional-forms.pdf', 10],
    ['ch:1.2.4', 'Annexes - Manufacturing (GMP certificates)', 'gmp-certificates.pdf', 6],
    ['ch:1.3.1', 'Information for Professionals (German)', 'information-professionals-de.pdf', 30, { bookmarks: 12 }],
    ['ch:1.3.1', 'Information for Professionals (French)', 'information-professionals-fr.pdf', 30, { bookmarks: 12 }],
    ['ch:1.3.2', 'Patient Information (German, French, Italian)', 'patient-information.pdf', 18],
    ['ch:1.3.3', 'Packaging Information', 'packaging-information.pdf', 6],
    ['ch:1.3.4', 'Information for Professionals from Other Countries (EU SmPC, US prescribing information)', 'information-other-countries.pdf', 60],
    ['ch:1.4.1', 'Information about the Expert - Quality', 'expert-quality.pdf', 3],
    ['ch:1.4.2', 'Information about the Expert - Nonclinical', 'expert-nonclinical.pdf', 3],
    ['ch:1.4.3', 'Information about the Expert - Clinical', 'expert-clinical.pdf', 3],
    ['ch:1.6.1', 'Environmental Risk Assessment (non-GMO)', 'environmental-risk.pdf', 12],
    ['ch:1.7', 'Decisions of Foreign Authorities (EU and US approvals, assessment reports)', 'foreign-decisions.pdf', 140, { bookmarks: 10, later: true, note: 'Needed when the application relies on a foreign authorisation (Article 13).' }],
    ['ch:1.8.2', 'Risk Management Plan', 'risk-management-plan.pdf', 64, { bookmarks: 18 }],
    ['ch:1.10', 'Information Relating to Paediatrics', 'paediatrics.pdf', 4],
  ].map(([section, title, fileName, pages, extra], i) => ({ id: `ch-${i + 1}`, section, title, fileName, pages, region: 'CH', ...(extra ?? {}) }));
}

export function regionDocs(p, region, opt = null) {
  if (region === 'CA' && (p.generateRegionDocs ?? {}).CA) return caDocs(p);
  if (region === 'CH' && (p.generateRegionDocs ?? {}).CH) return chDocs(p);
  if (region === 'EU' && opt?.library === 'asmf') return [];
  if (region === 'EU' && opt?.settings?.eu?.procedureType && opt.settings.eu.procedureType !== 'centralised') return euNationalDocs(p, opt.settings.eu).map((d) => ({ ...d, region: 'EU' }));
  if (region === 'US' && opt?.library === 'ind') return usIndDocs(p);
  if (region === 'US' && opt?.library === 'dmf') return usDmfDocs(p);
  const gen = p.generateRegionDocs ?? {};
  if (region === 'JP' && gen.JP) return jpDocs(p);
  if (region === 'IN' && opt?.library === 'cta') return inCtaDocs(p);
  if (region === 'IN' && gen.IN) return inDocs(p);
  if (region === 'EU' && gen.EU) return euDocs(p);
  if (region === 'US' && gen.US === 'nda') return usNdaDocs(p);
  return [];
}
