// Review simulator: a mock gateway with staged acknowledgments, a region review clock, and a
// questions engine that raises questions from the dossier's own weaknesses and checks the
// responses. Everything is a simplified teaching model; nothing here talks to a real system.
import data from '../data/review.json' with { type: 'json' };
import { displayCode, isPlaceable } from './tree.js';
import { docForLeaf, isRetireOp, lifecycleState, makeDoc, makeLeaf, seqByNumber, sortedSequences, touch, uid } from './model.js';
import { validate } from './validate.js';
import { consistencyMatrix } from './consistency.js';
import { createSequence, addCoverLetter } from './ops.js';

export const CLOCKS = data.clocks;
export const GATEWAY = data.gateway;
export const REJECTION = data.rejection;
export const RESPONSE_NODE = data.responseNode;
export const WEAKNESSES = data.weaknesses;

const seqLabel = (p, n) => (p.ectdVersion === '4.0' ? `unit ${parseInt(n, 10)}` : `sequence ${n}`);

export function ensureReview(p) {
  p.review ??= { submissions: {}, clock: { started: false, day: 0, idx: -1, stopped: false, outcome: null }, questions: [], events: [] };
  return p.review;
}

export const clockFor = (p) => CLOCKS[p.region] ?? CLOCKS.US;

// Is this sequence a response to questions, by region convention?
export function isResponseSeq(p, seq) {
  if (p.region === 'EU') return seq.subType === 'response';
  if (p.region === 'IN') return seq.subType === 'query-response';
  if (p.region === 'JP') return sortedSequences(p)[0]?.id !== seq.id;
  return seq.subType === 'amendment';
}
const isApplicationSeq = (p, seq) => sortedSequences(p)[0]?.id === seq.id || ['application', 'initial', 'jp_ctd'].includes(seq.subType) && !isResponseSeq(p, seq);

function event(p, kind, text) {
  const r = ensureReview(p);
  r.events.push({ id: uid('e'), day: r.clock.started ? r.clock.day : null, kind, text, at: new Date().toISOString() });
}

// Sends a published sequence through the mock gateway. Returns the submission record.
export function gatewaySubmit(p, seqNumber) {
  const r = ensureReview(p);
  const seq = seqByNumber(p, seqNumber);
  if (!seq) throw new Error('No such sequence.');
  if (seq.status !== 'published') throw new Error(`Publish ${seqLabel(p, seqNumber)} before sending it.`);
  const prev = r.submissions[seqNumber];
  if (prev?.outcome === 'accepted') throw new Error(`${seqLabel(p, seqNumber)} was already accepted.`);
  const v = validate(p, seqNumber);
  const highs = v.findings.filter((f) => f.severity === 'High');
  const changed = v.findings.filter((f) => f.ruleId === 'LC-06');
  const stages = [];
  for (const st of GATEWAY[p.region] ?? GATEWAY.US) {
    let ok = true;
    let detail = st.detail;
    if (st.id === 'ack1' && changed.length) { ok = false; detail = `Checksum mismatch: ${changed.length} file${changed.length > 1 ? 's' : ''} changed after publishing.`; }
    if (st.id === 'ack2' && p.region === 'IN') {
      const missing = v.findings.filter((f) => f.family?.startsWith('Module 1') && f.severity !== 'Low');
      if (missing.length) { ok = false; detail = `Missing: ${missing.slice(0, 3).map((f) => f.message).join(' ')}`; }
    }
    if (st.id === 'ack3' && highs.length) { ok = false; detail = `${highs.length} High finding${highs.length > 1 ? 's' : ''}: ${highs.slice(0, 3).map((f) => `${f.ruleId} ${f.title}`).join('; ')}.`; }
    stages.push({ id: st.id, label: st.label, ok, detail });
    if (!ok) break;
  }
  const accepted = stages.every((s) => s.ok) && stages.length === (GATEWAY[p.region] ?? GATEWAY.US).length;
  const rec = { seq: seqNumber, attempt: (prev?.attempt ?? 0) + 1, stages, outcome: accepted ? 'accepted' : 'rejected', day: r.clock.started ? r.clock.day : 0, at: new Date().toISOString(), response: isResponseSeq(p, seq) };
  r.submissions[seqNumber] = rec;
  seq.gateway = rec.outcome;
  event(p, accepted ? 'gateway' : 'rejected', accepted ? `${seqLabel(p, seqNumber)} accepted by the gateway.` : `${seqLabel(p, seqNumber)} rejected: ${stages[stages.length - 1].detail}`);
  if (accepted) {
    if (!r.clock.started && isApplicationSeq(p, seq)) {
      r.clock = { started: true, day: clockFor(p).milestones[0].day, idx: 0, stopped: false, outcome: null, baseSeq: seqNumber };
      event(p, 'clock', `${clockFor(p).milestones[0].label}. The review clock starts.`);
    }
    if (rec.response) {
      const checked = checkResponses(p, seqNumber);
      if (r.clock.stopped) { r.clock.stopped = false; event(p, 'clock', 'Responses received. The clock restarts.'); }
      rec.checked = checked;
    }
  }
  touch(p);
  return rec;
}

// A technically invalid sequence is fixed and sent again with the same number.
export function reopenRejected(p, seqNumber) {
  const r = ensureReview(p);
  const seq = seqByNumber(p, seqNumber);
  if (r.submissions[seqNumber]?.outcome !== 'rejected') throw new Error('Only a rejected sequence can be reopened.');
  seq.status = 'draft';
  seq.publishedAt = null;
  seq.publishSummary = null;
  seq.gateway = null;
  r.submissions[seqNumber].reopened = true;
  for (const l of seq.leaves) delete l.frozenDoc;
  event(p, 'reopen', `${seqLabel(p, seqNumber)} reopened as a draft with the same number.`);
  touch(p);
}

const nextMilestone = (p) => clockFor(p).milestones[ensureReview(p).clock.idx + 1] ?? null;

export function canAdvance(p) {
  const c = ensureReview(p).clock;
  if (!c.started) return { ok: false, why: 'The clock starts when the gateway accepts the initial application.' };
  if (c.outcome) return { ok: false, why: 'The review has ended.' };
  if (c.stopped) return { ok: false, why: 'The clock is stopped until a response is accepted by the gateway.' };
  if (!nextMilestone(p)) return { ok: false, why: 'No more milestones.' };
  return { ok: true };
}

// Moves the clock to the next milestone and applies what happens there.
export function advanceClock(p) {
  const r = ensureReview(p);
  const can = canAdvance(p);
  if (!can.ok) throw new Error(can.why);
  const clock = clockFor(p);
  const m = nextMilestone(p);
  r.clock.idx += 1;
  r.clock.day = m.day;
  event(p, 'milestone', `${m.label}.`);
  const latest = latestAccepted(p);
  if (m.rtf) {
    const missing = validate(p, latest).findings.filter((f) => f.ruleId === 'CT-01' || (f.family?.startsWith('Module 1') && f.severity === 'High'));
    if (missing.length >= 3) {
      r.clock.outcome = { positive: false, text: `Refuse to file: ${missing.length} required items are missing (for example ${missing.slice(0, 2).map((f) => displayCode(f.nodeCode ?? '') || f.ruleId).join(', ')}).` };
      event(p, 'outcome', r.clock.outcome.text);
      touch(p);
      return { milestone: m, outcome: r.clock.outcome };
    }
    event(p, 'milestone', 'The application is filed for review.');
  }
  let raised = [];
  if (m.questions === 'new') raised = raiseQuestions(p, m, latest);
  if (m.questions === 'outstanding') raised = carryOutstanding(p, m);
  if (raised.length && clock.stops) { r.clock.stopped = true; event(p, 'clock', `${raised.length} question${raised.length > 1 ? 's' : ''} sent. The clock stops until the response.`); }
  else if (raised.length) event(p, 'questions', `${raised.length} question${raised.length > 1 ? 's' : ''} sent. The clock keeps running; respond before the goal date.`);
  else if (m.questions) event(p, 'questions', 'No questions at this point.');
  if (m.final) {
    const open = r.questions.filter((q) => q.status !== 'resolved');
    const positive = open.length === 0;
    r.clock.outcome = { positive, text: positive ? clock.positive : `${clock.negative} ${open.length} question${open.length > 1 ? 's' : ''} not resolved.` };
    event(p, 'outcome', r.clock.outcome.text);
  }
  touch(p);
  return { milestone: m, raised, outcome: r.clock.outcome };
}

export function latestAccepted(p) {
  const r = ensureReview(p);
  const acc = sortedSequences(p).filter((s) => r.submissions[s.number]?.outcome === 'accepted');
  return acc[acc.length - 1]?.number ?? sortedSequences(p)[0].number;
}

// Questions come from three places: required sections that are missing, contradictions
// between documents, and the product's known scientific weaknesses.
export function raiseQuestions(p, milestone, seqNumber) {
  const r = ensureReview(p);
  const round = (r.questions.reduce((m, q) => Math.max(m, q.round), 0) || 0) + 1;
  const out = [];
  const push = (q) => out.push({ id: uid('q'), n: r.questions.length + out.length + 1, round, milestone: milestone.id, raisedDay: r.clock.day, raisedAfter: seqNumber, status: 'open', ...q });
  const v = validate(p, seqNumber);
  for (const f of v.findings.filter((x) => x.ruleId === 'CT-01').slice(0, 2)) {
    push({ kind: 'missing', module: 'Dossier', section: f.nodeCode, text: `Section ${displayCode(f.nodeCode)} is missing. Provide it.` });
  }
  const seen = new Set();
  for (const iss of consistencyMatrix(p, seqNumber).issues) {
    if (seen.has(iss.fact.key) || seen.size >= 2) continue;
    seen.add(iss.fact.key);
    push({ kind: 'consistency', module: 'Consistency', factKey: iss.fact.key, section: iss.leaf.nodeCode,
      text: `${iss.fact.label}: ${displayCode(iss.leaf.nodeCode)} states "${iss.value}" but the rest of the dossier states "${iss.expected}". Clarify which is correct and correct the dossier.` });
  }
  for (const w of (WEAKNESSES[p.productId] ?? []).slice(0, 2)) {
    if (r.questions.some((q) => q.weakness === w.id)) continue;
    const id = `rq-${w.id}`;
    if (!p.documents[id] && isPlaceable(w.section)) {
      p.documents[id] = makeDoc({ id, section: w.section, title: w.fixTitle, fileName: w.fixFile, pages: w.pages, generated: true, responseFor: w.id,
        note: 'Prepared for the response to questions.', content: `${w.fixTitle}\n\nPrepared in response to the question:\n${w.text}\n\nSummary of the new data:\n${w.answer}\n\nTRAINING ONLY. Fictional content.` });
    }
    push({ kind: 'weakness', module: w.module, weakness: w.id, section: w.section, fixDocId: id, text: w.text });
  }
  r.questions.push(...out);
  return out;
}

function carryOutstanding(p, milestone) {
  const r = ensureReview(p);
  const out = [];
  for (const q of r.questions) if (q.status === 'unresolved' || (q.status === 'open' && q.milestone !== milestone.id)) {
    q.status = 'open';
    q.outstanding = true;
    q.milestone = milestone.id;
    out.push(q);
  }
  return out;
}

// Was the question answered in the dossier by sequence seqNumber?
export function questionMet(p, q, seqNumber) {
  const st = lifecycleState(p, seqNumber);
  const current = [...st.entries.values()].filter((e) => e.status === 'current' && !isRetireOp(e.leaf.operation));
  if (q.kind === 'missing') return current.some((e) => e.leaf.nodeCode === q.section);
  if (q.kind === 'consistency') return !consistencyMatrix(p, seqNumber).issues.some((i) => i.fact.key === q.factKey);
  if (q.kind === 'weakness') return current.some((e) => e.leaf.docId === q.fixDocId && e.leaf.nodeCode === q.section);
  return false;
}

// A response sequence must carry a response document at the region's response heading.
export function hasResponseDoc(p, seqNumber) {
  const node = RESPONSE_NODE[p.region];
  const seq = seqByNumber(p, seqNumber);
  const ok = (l) => !isRetireOp(l.operation) && (p.region === 'US' ? /^1\.11\.[1-4]$/.test(l.nodeCode) : l.nodeCode === node);
  return !!seq?.leaves.some(ok);
}

export function checkResponses(p, seqNumber) {
  const r = ensureReview(p);
  const doc = hasResponseDoc(p, seqNumber);
  const results = [];
  for (const q of r.questions) {
    if (q.status === 'resolved') continue;
    const met = questionMet(p, q, seqNumber);
    q.status = met && doc ? 'resolved' : 'unresolved';
    q.checkedIn = seqNumber;
    q.note = met ? (doc ? 'Answered and the dossier is corrected.' : `The dossier is corrected but ${seqLabel(p, seqNumber)} has no response document at ${displayCode(RESPONSE_NODE[p.region])}.`)
      : q.kind === 'weakness' ? `The new data were not sent at ${displayCode(q.section)}.` : q.kind === 'consistency' ? 'The contradiction is still in the current dossier.' : `${displayCode(q.section)} is still missing.`;
    results.push({ id: q.id, status: q.status, note: q.note });
  }
  event(p, 'responses', `Responses in ${seqLabel(p, seqNumber)} assessed: ${results.filter((x) => x.status === 'resolved').length} of ${results.length} questions resolved.`);
  return results;
}

export function responseText(p) {
  const r = ensureReview(p);
  const open = r.questions.filter((q) => q.status !== 'resolved');
  const lines = [`RESPONSE TO QUESTIONS`, '', `Applicant: ${p.settings.applicant?.name ?? ''}`, ''];
  for (const q of open) {
    const w = (WEAKNESSES[p.productId] ?? []).find((x) => x.id === q.weakness);
    lines.push(`Question ${q.n} (${q.module}): ${q.text}`);
    lines.push(`Response: ${w ? `${w.answer} See ${displayCode(q.section)}.` : q.kind === 'consistency' ? `The document at ${displayCode(q.section)} has been corrected and is provided with a replace operation.` : `Section ${displayCode(q.section)} is now provided.`}`);
    lines.push('');
  }
  lines.push('TRAINING ONLY. Fictional content.');
  return lines.join('\n');
}

// Creates the response document for the open questions and places it in the sequence.
export function addResponseDoc(p, seqNumber) {
  const seq = seqByNumber(p, seqNumber);
  if (!seq || seq.status === 'published') throw new Error('Choose a draft sequence for the response.');
  const node = RESPONSE_NODE[p.region];
  const doc = makeDoc({ id: `gen-resp-${seqNumber}-${uid().slice(0, 4)}`, section: node, region: p.region, title: 'Response to Questions', fileName: 'response-to-questions.pdf', pages: 6, generated: true, content: responseText(p), lang: p.region === 'JP' ? 'ja' : undefined });
  p.documents[doc.id] = doc;
  const leaf = makeLeaf(p, doc, node, 'new');
  seq.leaves.push(leaf);
  touch(p);
  return { doc, leaf };
}

export function reviewSummary(p) {
  const r = ensureReview(p);
  const c = clockFor(p);
  return {
    clock: c,
    state: r.clock,
    next: r.clock.started ? c.milestones[r.clock.idx + 1] ?? null : c.milestones[0],
    open: r.questions.filter((q) => q.status === 'open').length,
    unresolved: r.questions.filter((q) => q.status === 'unresolved').length,
    resolved: r.questions.filter((q) => q.status === 'resolved').length,
  };
}

export { docForLeaf };

export const RESPONSE_SEQ = {
  US: (p, base) => ({ submissionType: seqByNumber(p, base)?.submissionType ?? 'original-application', subType: 'amendment', description: 'Response to information request' }),
  EU: (p, base) => ({ submissionType: seqByNumber(p, base)?.submissionType ?? 'maa', subType: 'response', relatedSequence: ensureReview(p).clock.baseSeq ?? base, description: 'Responses to the list of questions' }),
  JP: () => ({ description: 'Response to inquiries' }),
  IN: (p, base) => ({ submissionType: seqByNumber(p, base)?.submissionType ?? 'new-drug-import', subType: 'query-response', description: 'Response to query letter' }),
};

// Starts a response sequence of the right type with the cover letter and response document.
export function prepareResponseSequence(p) {
  const base = latestAccepted(p);
  const opts = (RESPONSE_SEQ[p.region] ?? RESPONSE_SEQ.US)(p, base);
  const seq = createSequence(p, opts);
  addCoverLetter(p, seq.number, true);
  addResponseDoc(p, seq.number);
  event(p, 'prepare', `${seqLabel(p, seq.number)} started for the response.`);
  return seq;
}
