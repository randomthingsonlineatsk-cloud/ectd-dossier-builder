// Change packages for Canada, Switzerland and Japan, made by the Variations Classifier
// (Phase 4 of that app; fixtures made with its tools/make-fixtures.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProject } from '../src/engine/model.js';
import { parseChangePackage, importChangePackage } from '../src/engine/changepkg.js';
import { REGION_PACKS } from '../src/engine/tree.js';

const load = (r) => parseChangePackage(readFileSync(new URL(`./fixtures/change-package-${r}.json`, import.meta.url), 'utf8'));
let n = 0;
for (const [r, region, type] of [['ca', 'CA', 'level-iii'], ['ch', 'CH', 'var-type1b'], ['jp', 'JP', 'jp_partial-change']]) {
  const pkg = load(r);
  assert.equal(pkg.region, region);
  const p = createProject({ name: r, productId: 'nce-tablet', region, user: { userId: 'u-1' } });
  const { seq, warnings } = importChangePackage(p, pkg);
  assert.equal(seq.submissionType, type);
  assert.ok(REGION_PACKS[region].submissionTypes.some((t) => t.value === type), `${region} knows ${type}`);
  assert.deepEqual(warnings.filter((w) => /not in this app/.test(w)), [], `${region}: every section is in the tree`);
  assert.ok(seq.changePackage.todo.length >= 5);
  n++;
}
console.log(`phase 7 tests: ${n} passed`);
