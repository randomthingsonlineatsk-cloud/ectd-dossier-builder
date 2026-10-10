// Planning and tracking (a small regulatory information management layer): a content plan
// per sequence, a dependency timeline with its critical path, a registration tracker,
// commitments, a correspondence log, and reuse of Modules 2-5 for another country.
import { INDEX, REGION_LABEL, displayCode, inRegion, M1_ROOT } from './tree.js';
import { createProject, docForLeaf, isRetireOp, lifecycleState, seqByNumber, sortedSequences, touch, uid, makeLeaf, productOptions, PRODUCTS } from './model.js';
import { requiredFor, m1Checklist } from './validate.js';

export const FUNCTIONS = ['Regulatory affairs', 'CMC drug substance', 'CMC drug product', 'Nonclinical', 'Clinical', 'Biostatistics', 'Labeling', 'Publishing'];
export const PLAN_STATUS = ['planned', 'authoring', 'in review', 'approved', 'placed'];
export const REG_STATUS = ['planned', 'in preparation', 'submitted', 'under review', 'approved', 'withdrawn', 'refused'];

export function ownerFor(code) {
  const n = INDEX.map[code];
  if (!n) return 'Regulatory affairs';
  if (n.isM1) return /label|1\.14|1\.3\.1|1\.8/.test(`${n.title} ${n.code}`.toLowerCase()) ? 'Labeling' : 'Regulatory affairs';
  if (/^3\.2\.S|^2\.3\.S/.test(code)) return 'CMC drug substance';
  if (/^3|^2\.3/.test(code)) return 'CMC drug product';
  if (/^4|^2\.4|^2\.6/.test(code)) return 'Nonclinical';
  if (/^5\.3\.5\.3|^2\.7\.3|^2\.7\.4/.test(code)) return 'Biostatistics';
  return 'Clinical';
}

const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, d) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

export function ensurePlan(p) {
  p.plan ??= {};
  p.plan.sequences ??= {};
  p.plan.registrations ??= [{ id: uid('r'), country: REGION_LABEL[p.region], procedure: p.appType.toUpperCase(), status: 'in preparation', submitted: '', approved: '', projectId: p.id, note: '' }];
  p.plan.commitments ??= [];
  p.plan.correspondence ??= [];
  p.plan.start ??= today();
  p.plan.tasks ??= defaultTasks();
  p.plan.changeControl ??= '';
  return p.plan;
}

// The content plan lists every heading that must or does hold a document in this sequence.
export function contentPlan(p, seqNumber) {
  const plan = ensurePlan(p);
  const seq = seqByNumber(p, seqNumber);
  const sp = (plan.sequences[seqNumber] ??= { target: addDays(today(), 60), rows: {} });
  const codes = new Set([...requiredFor(p, seq)].filter((c) => inRegion(c, p.region)));
  for (const it of m1Checklist(p, seq)) if (it.level === 'mandatory') codes.add(it.section);
  for (const l of seq.leaves) if (!isRetireOp(l.operation)) codes.add(l.nodeCode);
  for (const c of Object.keys(sp.rows)) codes.add(c);
  const placed = new Set(seq.leaves.filter((l) => !isRetireOp(l.operation)).map((l) => l.nodeCode));
  const rows = [...codes].filter((c) => INDEX.map[c]).sort((a, b) => INDEX.order.indexOf(a) - INDEX.order.indexOf(b)).map((code) => {
    const saved = sp.rows[code] ?? {};
    const isPlaced = placed.has(code);
    const due = saved.due ?? sp.target;
    const status = isPlaced ? 'placed' : saved.status ?? 'planned';
    const late = !isPlaced && due < today();
    return { code, title: INDEX.map[code].title, owner: saved.owner ?? ownerFor(code), due, status, late, required: codes.has(code) && !saved.extra, placed: isPlaced };
  });
  return { target: sp.target, rows, done: rows.filter((r) => r.placed).length };
}

export function setPlanRow(p, seqNumber, code, patch) {
  const plan = ensurePlan(p);
  const sp = (plan.sequences[seqNumber] ??= { target: addDays(today(), 60), rows: {} });
  sp.rows[code] = { ...(sp.rows[code] ?? {}), ...patch };
  touch(p);
}
export function setPlanTarget(p, seqNumber, target) {
  const plan = ensurePlan(p);
  (plan.sequences[seqNumber] ??= { rows: {} }).target = target;
  touch(p);
}

// A dossier-preparation network. Durations are working estimates in calendar days.
export function defaultTasks() {
  return [
    { id: 't-ds', name: 'Module 3 drug substance sections', owner: 'CMC drug substance', days: 25, deps: [] },
    { id: 't-dp', name: 'Module 3 drug product sections', owner: 'CMC drug product', days: 30, deps: [] },
    { id: 't-stab', name: 'Stability data cut-off and tables', owner: 'CMC drug product', days: 20, deps: [] },
    { id: 't-nc', name: 'Module 4 study reports final', owner: 'Nonclinical', days: 15, deps: [] },
    { id: 't-csr', name: 'Module 5 clinical study reports final', owner: 'Clinical', days: 35, deps: [] },
    { id: 't-ise', name: 'Integrated summaries of efficacy and safety', owner: 'Biostatistics', days: 20, deps: ['t-csr'] },
    { id: 't-qos', name: 'Quality overall summary (2.3)', owner: 'CMC drug product', days: 12, deps: ['t-ds', 't-dp', 't-stab'] },
    { id: 't-ncs', name: 'Nonclinical overview and summaries (2.4, 2.6)', owner: 'Nonclinical', days: 15, deps: ['t-nc'] },
    { id: 't-cos', name: 'Clinical overview and summaries (2.5, 2.7)', owner: 'Clinical', days: 20, deps: ['t-ise'] },
    { id: 't-lab', name: 'Labeling and product information', owner: 'Labeling', days: 10, deps: ['t-cos'] },
    { id: 't-m1', name: 'Module 1 forms and cover letter', owner: 'Regulatory affairs', days: 5, deps: ['t-lab'] },
    { id: 't-pub', name: 'Publishing, hyperlinking and QC', owner: 'Publishing', days: 7, deps: ['t-qos', 't-ncs', 't-cos', 't-m1'] },
    { id: 't-val', name: 'Validation and dispatch', owner: 'Publishing', days: 2, deps: ['t-pub'] },
  ];
}

// Critical path method: earliest and latest start, slack, and the zero-slack chain.
export function schedule(tasks, start) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const order = [];
  const seen = new Set();
  const visiting = new Set();
  const visit = (t) => {
    if (seen.has(t.id)) return;
    if (visiting.has(t.id)) throw new Error(`Circular dependency at "${t.name}".`);
    visiting.add(t.id);
    for (const d of t.deps) if (byId[d]) visit(byId[d]);
    visiting.delete(t.id);
    seen.add(t.id);
    order.push(t);
  };
  tasks.forEach(visit);
  const es = {}, ef = {};
  for (const t of order) { es[t.id] = Math.max(0, ...t.deps.filter((d) => byId[d]).map((d) => ef[d])); ef[t.id] = es[t.id] + Number(t.days || 0); }
  const end = Math.max(0, ...Object.values(ef));
  const lf = {}, ls = {};
  for (const t of [...order].reverse()) {
    const succ = tasks.filter((x) => x.deps.includes(t.id));
    lf[t.id] = succ.length ? Math.min(...succ.map((x) => ls[x.id])) : end;
    ls[t.id] = lf[t.id] - Number(t.days || 0);
  }
  const rows = tasks.map((t) => ({ ...t, es: es[t.id], ef: ef[t.id], ls: ls[t.id], lf: lf[t.id], slack: ls[t.id] - es[t.id], critical: ls[t.id] - es[t.id] === 0, startDate: addDays(start, es[t.id]), endDate: addDays(start, ef[t.id]) }));
  return { rows, end, endDate: addDays(start, end), critical: rows.filter((r) => r.critical).map((r) => r.id) };
}

export function addRow(p, list, row) { ensurePlan(p)[list].push({ id: uid(list[0]), ...row }); touch(p); }
export function updateRow(p, list, id, patch) { const r = ensurePlan(p)[list].find((x) => x.id === id); if (r) Object.assign(r, patch); touch(p); }
export function removeRow(p, list, id) { const pl = ensurePlan(p); pl[list] = pl[list].filter((x) => x.id !== id); touch(p); }

// Correspondence: manual entries plus everything the review simulator recorded.
export function correspondenceLog(p) {
  const plan = ensurePlan(p);
  const auto = (p.review?.events ?? []).filter((e) => ['gateway', 'rejected', 'milestone', 'questions', 'responses', 'outcome'].includes(e.kind))
    .map((e) => ({ id: e.id, date: e.at.slice(0, 10), direction: ['gateway', 'rejected', 'questions', 'outcome'].includes(e.kind) ? 'from agency' : e.kind === 'responses' ? 'to agency' : 'note', subject: e.text, auto: true, day: e.day }));
  return [...plan.correspondence, ...auto].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Copies the current Modules 2-5 into a new project for another region, placed as new.
export function reuseForCountry(src, region, user) {
  const opt = productOptions(src.productId).find((o) => o.region === region);
  if (!opt) throw new Error(`${PRODUCTS[src.productId].product.brandName} has no ${REGION_LABEL[region]} option in this app.`);
  if (region === src.region) throw new Error('Choose a different region.');
  const p = createProject({ name: `${src.name} (${REGION_LABEL[region]} reuse)`, productId: src.productId, region, appType: opt.appType, user });
  const last = sortedSequences(src).filter((s) => s.status === 'published').pop() ?? sortedSequences(src).pop();
  const st = lifecycleState(src, last.number);
  const seq = p.sequences[0];
  let n = 0;
  for (const e of [...st.entries.values()].sort((a, b) => INDEX.order.indexOf(a.leaf.nodeCode) - INDEX.order.indexOf(b.leaf.nodeCode))) {
    if (e.status !== 'current' || isRetireOp(e.leaf.operation) || INDEX.map[e.leaf.nodeCode]?.isM1) continue;
    const d = docForLeaf(src, e.leaf);
    if (!d) continue;
    const copy = structuredClone(d);
    delete copy.md5; delete copy.md5Key; delete copy.sha256; delete copy.sha256Key;
    p.documents[copy.id] = copy;
    const leaf = makeLeaf(p, copy, e.leaf.nodeCode, 'new');
    leaf.title = e.leaf.title;
    if (e.leaf.study) leaf.study = structuredClone(e.leaf.study);
    seq.leaves.push(leaf);
    n++;
  }
  p.plan = { reusedFrom: { projectId: src.id, name: src.name, seq: last.number, documents: n } };
  ensurePlan(p);
  ensurePlan(src).registrations.push({ id: uid('r'), country: REGION_LABEL[region], procedure: opt.appType.toUpperCase(), status: 'in preparation', submitted: '', approved: '', projectId: p.id, note: `Reused Modules 2-5 from ${last.number}` });
  touch(src);
  return { project: p, count: n, root: M1_ROOT[region] };
}

export function csv(rows, cols) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.map((c) => q(c[1])).join(','), ...rows.map((r) => cols.map((c) => q(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))].join('\n') + '\n';
}

export { displayCode, daysBetween };
