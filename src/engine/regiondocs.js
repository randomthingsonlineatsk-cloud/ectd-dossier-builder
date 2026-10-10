// Generates a product's regional Module 1 documents from its data, so every product
// gets a consistent EU Module 1 set (and a US NDA set when its file does not list one).
// File names follow each region's conventions; all content is fictional.

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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

export function regionDocs(p, region) {
  const gen = p.generateRegionDocs ?? {};
  if (region === 'JP' && gen.JP) return jpDocs(p);
  if (region === 'IN' && gen.IN) return inDocs(p);
  if (region === 'EU' && gen.EU) return euDocs(p);
  if (region === 'US' && gen.US === 'nda') return usNdaDocs(p);
  return [];
}
