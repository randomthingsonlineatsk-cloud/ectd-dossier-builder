// Phase 4 engine tests: node tests/phase4.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { setFontLoader, md5Bytes } from '../src/engine/pdfgen.js';
import { createProject, seqByNumber } from '../src/engine/model.js';
import { INDEX } from '../src/engine/tree.js';
import { seedMission, buildComplete, missionById, MISSIONS } from '../src/engine/missions.js';
import { publishWithFiles, createSequence, placeDoc, addCoverLetter } from '../src/engine/ops.js';
import { COMPARE, headingsFor, whereQuiz, scoreWhere, checkItemRow, scoreActd, NONE } from '../src/engine/compare.js';
import { allQuestions, buildSet, scoreSet } from '../src/engine/quiz.js';
import { certificateStatus } from '../src/engine/progress.js';
import { certificatePdf, progressStatementPdf, verificationCode } from '../src/engine/certpdf.js';
import { dossierZip } from '../src/engine/zipexport.js';
import { submissionPayload, verifyProject } from '../src/engine/classroom.js';

setFontLoader(async () => fs.readFileSync(new URL('../src/assets/fonts/public-sans-latin-400.ttf', import.meta.url)));
const user = { userId: 'u-test', classId: null };
let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('ok -', name); };

await t('comparison data points at real headings in the app packs', async () => {
  for (const it of COMPARE.items) for (const r of COMPARE.regions) {
    const c = it.map[r.id];
    if (c == null) continue;
    if (r.pack) assert.ok(INDEX.map[c] && INDEX.map[c].region === r.id, `${it.id} ${r.id} ${c}`);
    else assert.ok(COMPARE.headings[r.id].some(([h]) => h === c), `${it.id} ${r.id} ${c}`);
    assert.ok(headingsFor(r.id).includes(c));
  }
});

await t('comparison exercises score correctly', async () => {
  const qs = whereQuiz(10, 42);
  assert.equal(qs.length, 10);
  for (const q of qs) assert.ok(q.options.some((o) => o.code === q.answer), 'answer is offered');
  assert.equal(scoreWhere(qs, Object.fromEntries(qs.map((q) => [q.id, q.answer]))), 10);
  const it = COMPARE.items.find((x) => x.id === 'rmp');
  const row = checkItemRow('rmp', Object.fromEntries(COMPARE.regions.map((r) => [r.id, it.map[r.id] ?? NONE])));
  assert.ok(Object.values(row).every(Boolean));
  assert.equal(scoreActd(Object.fromEntries(COMPARE.actd.pairs.map((p, i) => [i, p.answer]))).right, COMPARE.actd.pairs.length);
});

await t('quiz bank: over 100 well-formed questions with unique ids', async () => {
  const all = allQuestions();
  assert.ok(all.length >= 100, `${all.length}`);
  assert.equal(new Set(all.map((q) => q.id)).size, all.length);
  for (const q of all) assert.ok(q.answer >= 0 && q.answer < q.options.length && q.why, q.id);
  const set = buildSet({ topics: ['v4'], n: 5, seed: 7 });
  assert.ok(set.every((q) => q.topic === 'v4'));
  const res = scoreSet(set, Object.fromEntries(set.map((q) => [q.id, q.answer])));
  assert.equal(res.score, 100);
});

await t('certificate: criteria, deterministic verification code, valid PDFs', async () => {
  const lessonProgress = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, { best: 100 }]));
  const attempts = [
    ...MISSIONS.map((m) => ({ kind: 'mission', missionId: m.id, score: 95, difficulty: 'expert' })),
    { kind: 'quiz', mode: 'exam', score: 80 },
    { kind: 'compare', exercise: 'where', score: 90 }, { kind: 'compare', exercise: 'actd', score: 100 },
  ];
  const st = certificateStatus({ attempts, lessonProgress, lessonCount: 7 });
  assert.equal(st.eligible, true);
  assert.equal(st.distinction, true);
  const not = certificateStatus({ attempts: attempts.slice(1), lessonProgress, lessonCount: 7 });
  assert.equal(not.eligible, false);
  const a = verificationCode({ name: 'Asha Rao', userId: 'u1', status: st, date: '2026-10-10' });
  assert.equal(a, verificationCode({ name: 'Asha Rao ', userId: 'u1', status: st, date: '2026-10-10' }));
  assert.match(a, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  const pdf = await PDFDocument.load(await certificatePdf({ name: 'Asha Rao', userId: 'u1', status: st }));
  assert.equal(pdf.getPageCount(), 2);
  assert.match(pdf.getSubject(), /Not an accreditation/);
  assert.equal((await PDFDocument.load(await progressStatementPdf({ name: 'Asha', status: not }))).getPageCount(), 1);
});

await t('zip export: folder layout, README, and checksums that match the backbone', async () => {
  const p = createProject({ name: 'Zip test', user });
  buildComplete(p);
  await publishWithFiles(p, '0000');
  const r = await dossierZip(p);
  assert.deepEqual(r.notes, []);
  const files = unzipSync(r.zip);
  assert.match(strFromU8(files['zip-test/README-TRAINING-ONLY.txt']), /TRAINING ONLY - NOT FOR SUBMISSION/);
  const index = strFromU8(files['zip-test/0000/index.xml']);
  const pdfs = Object.keys(files).filter((k) => k.endsWith('.pdf'));
  const m2to5 = pdfs.filter((k) => !k.includes('/m1/'));
  assert.ok(pdfs.length > 90);
  for (const k of m2to5.slice(0, 15)) {
    const href = k.replace('zip-test/0000/', '');
    const m = index.match(new RegExp(`checksum="([0-9a-f]{32})"[^>]*xlink:href="${href.replace(/[.]/g, '\\.')}"`));
    assert.ok(m, `leaf for ${href}`);
    assert.equal(md5Bytes(files[k]), m[1], href);
  }
});

await t('zip export: v4.0 unit leaves reused documents out', async () => {
  const p = createProject({ name: 'jp zip', region: 'JP', user });
  buildComplete(p);
  await publishWithFiles(p, '0001');
  createSequence(p, {});
  placeDoc(p, '0002', 'd-43', '5.4');
  addCoverLetter(p, '0002');
  await publishWithFiles(p, '0002');
  const files = unzipSync((await dossierZip(p, { sequences: ['0002'] })).zip);
  const keys = Object.keys(files);
  assert.ok(keys.includes('jp-zip/2/submissionunit.xml'));
  assert.ok(!keys.some((k) => k.includes('/m4/') || k.includes('/m5/')), 'reused document is not sent again');
});

await t('classroom: the submission payload scores the project, and re-scoring agrees', async () => {
  const p = await seedMission(16, 'expert', user);
  createSequence(p, { submissionType: 'original-application', subType: 'amendment' });
  addCoverLetter(p, '0001');
  placeDoc(p, '0001', 'd-356h-wd', '1.1');
  placeDoc(p, '0001', 'd-withdraw', '1.5.5');
  for (const q of missionById(16).quiz) p.mission.answers[q.id] = q.answer;
  await publishWithFiles(p, '0001');
  const payload = submissionPayload(p, []);
  assert.equal(payload.score, 100);
  assert.equal(payload.counts.High, 0);
  assert.equal(payload.project.project.mission.id, 16);
  assert.ok(JSON.stringify(payload).length < 1_500_000);
  // A student who edits the reported score cannot fool the instructor's re-score.
  assert.equal(verifyProject({ ...payload.project, project: { ...payload.project.project, sequences: [seqByNumber(p, '0000')] } }).score < 100, true);
  assert.equal(verifyProject(payload.project).score, 100);
});

console.log(`\n${pass} phase 4 tests passed`);
