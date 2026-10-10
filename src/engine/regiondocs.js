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
  ].map((d) => ({ ...d, region: 'EU' }));
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

export function regionDocs(p, region) {
  const gen = p.generateRegionDocs ?? {};
  if (region === 'EU' && gen.EU) return euDocs(p);
  if (region === 'US' && gen.US === 'nda') return usNdaDocs(p);
  return [];
}
