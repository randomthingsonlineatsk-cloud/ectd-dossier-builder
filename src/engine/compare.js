// Region comparison exercises: where one Module 1 item lives in each region, and how the
// ICH CTD maps onto the ASEAN ACTD.
import data from '../data/compare.json' with { type: 'json' };
import { INDEX, displayCode } from './tree.js';

export const COMPARE = data;
export const NONE = 'none';
export const NONE_LABEL = 'No matching heading';

const listFor = (region) => (data.headings ?? {})[region] ?? [];

export function headingLabel(region, code) {
  if (code == null || code === NONE) return NONE_LABEL;
  const pack = data.regions.find((r) => r.id === region)?.pack;
  if (pack) {
    const n = INDEX.map[code];
    if (!n) return code;
    const dc = displayCode(code);
    return /^\d/.test(dc) ? `${dc} ${n.title}` : n.title;
  }
  const h = listFor(region).find(([c]) => c === code);
  return h ? (h[0] === 'responses' ? h[1] : `${h[0]} ${h[1]}`) : code;
}

// Every heading code an item can land on in a region, for the one-item-six-regions drill.
export function headingsFor(region) {
  const pack = data.regions.find((r) => r.id === region)?.pack;
  const codes = pack
    ? INDEX.order.filter((c) => { const n = INDEX.map[c]; return n.isM1 && n.region === region && n.children.length === 0; })
    : listFor(region).map(([c]) => c);
  // Keep the headings the items use even when they have sub-headings (e.g. US 1.16, 1.9, 1.11).
  for (const it of data.items) { const c = it.map[region]; if (c && !codes.includes(c)) codes.push(c); }
  return codes;
}

// Small seeded random so a quiz can be rebuilt from its seed.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// "Where does it go?": item + region, four options from that region's headings.
export function whereQuiz(n = 10, seed = Date.now()) {
  const r = rng(seed);
  const pairs = shuffle(data.items.flatMap((it) => data.regions.map((rg) => ({ it, rg }))), r).slice(0, n);
  return pairs.map(({ it, rg }, i) => {
    const answer = it.map[rg.id] ?? NONE;
    const pool = [...new Set(data.items.map((x) => x.map[rg.id]).filter((c) => c && c !== answer))];
    const opts = shuffle([answer, ...shuffle(pool, r).slice(0, 3)], r);
    if (!opts.includes(NONE) && answer !== NONE && r() < 0.5) opts[opts.findIndex((o) => o !== answer)] = NONE;
    return { id: `w${i}`, item: it, region: rg, answer, options: opts.map((c) => ({ code: c, label: headingLabel(rg.id, c) })) };
  });
}

export const scoreWhere = (qs, answers) => qs.filter((q) => answers[q.id] === q.answer).length;

export function checkItemRow(itemId, picks) {
  const it = data.items.find((x) => x.id === itemId);
  return Object.fromEntries(data.regions.map((rg) => [rg.id, (picks[rg.id] ?? '') === (it.map[rg.id] ?? NONE)]));
}

export function scoreActd(answers) {
  const res = data.actd.pairs.map((p, i) => answers[i] === p.answer);
  return { res, right: res.filter(Boolean).length, total: res.length };
}
