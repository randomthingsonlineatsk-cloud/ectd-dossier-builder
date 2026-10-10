// Writes sample stub PDFs for inspection: node tests/pdf-sample.mjs <outdir>
import fs from 'node:fs';
import { setFontLoader, leafPdf } from '../src/engine/pdfgen.js';
import { seedMission } from '../src/engine/missions.js';
setFontLoader(async () => fs.readFileSync(new URL('../src/assets/fonts/public-sans-latin-400.ttf', import.meta.url)));
const out = process.argv[2] ?? '.';
const p = await seedMission(11, 'guided', { userId: 'u', classId: null });
const seq = p.sequences[0];
for (const id of ['d-qos', 'd-s32', 'd-266', 'd-s43', 'd-p53', 'd-5351b', 'd-p83']) {
  const leaf = seq.leaves.find((l) => l.docId === id);
  const b = await leafPdf(p, '0000', leaf);
  fs.writeFileSync(`${out}/${id}.pdf`, b);
}
console.log('written');
