// Skills Passport record: a small JSON file that carries a certificate to the Regulatory Skills
// Passport on the pharmolecule hub. It holds the exact text the verification code was made from
// (the basis), the code, the criteria and a seal (a hash of everything else in the record). The
// Passport recomputes both, so an edited name, score or date shows as not verified. Anyone can
// recompute these hashes: it shows a record is unchanged, not who earned it.
// Keep in step with pharmolecule/passport.html (schema 1) and the other apps' passport files.
import { sha256 } from './sha256.js';

export const PASSPORT_KIND = 'pharmolecule/passport-record';
export const PASSPORT_SCHEMA = 1;
export const PASSPORT_PAGE = 'https://randomthingsonlineatsk-cloud.github.io/pharmolecule/passport.html';
const NOTICE = 'Portfolio certificate from a training app. Not an accreditation.';

export const sealOf = (rec) => { const { seal, ...rest } = rec; return sha256(JSON.stringify(rest)); };

// fields: app, appName, certificate, appUrl, name, userId, issued, basis, code, criteria [{ label, met }], distinction
export function passportRecord(fields) {
  const rec = { kind: PASSPORT_KIND, schema: PASSPORT_SCHEMA, ...fields, alg: 'sha256', notice: NOTICE };
  return { ...rec, seal: sealOf(rec) };
}

import { verificationBasis, verificationCode } from './certpdf.js';
export function ectdRecord({ name, userId, status, date }) {
  return passportRecord({
    app: 'ectd-dossier-builder', appName: 'eCTD Dossier Builder', certificate: 'Completion certificate',
    appUrl: 'https://randomthingsonlineatsk-cloud.github.io/ectd-dossier-builder/',
    name: name.trim(), userId, issued: date,
    basis: verificationBasis({ name, userId, status, date }), code: verificationCode({ name, userId, status, date }),
    criteria: status.criteria.map((c) => ({ label: c.label, met: !!c.met })), distinction: !!status.distinction,
  });
}
