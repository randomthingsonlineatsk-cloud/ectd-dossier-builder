// Quiz bank: the written bank plus every lesson quiz, mission quiz and lifecycle drill,
// normalised to one shape and tagged by topic, lesson and mission.
import bank from '../data/quizbank.json' with { type: 'json' };
import lessons from '../data/lessons.json' with { type: 'json' };
import drills from '../data/drills.json' with { type: 'json' };
import missionsData from '../data/missions.json' with { type: 'json' };
import { rng } from './compare.js';

export const TOPICS = bank.topics;
const LESSON_TOPIC = { 1: 'ctd', 2: 'formats', 3: 'granularity', 4: 'backbone', 5: 'lifecycle', 6: 'v4', 7: 'regions' };
const MISSION_TOPIC = { 3: 'v4', 6: 'postapproval', 7: 'postapproval', 8: 'us', 9: 'us', 12: 'us', 13: 'biologics', 14: 'india', 15: 'eu', 16: 'us' };

let cache = null;
export function allQuestions() {
  if (cache) return cache;
  const out = bank.questions.map((q) => ({ ...q, source: 'Quiz bank' }));
  for (const l of lessons) (l.quiz ?? []).forEach((q, i) => out.push({ id: `l${l.id}-${i}`, topic: LESSON_TOPIC[l.id] ?? 'ctd', links: [`lesson:${l.id}`], q: q.q, options: q.options, answer: q.answer, why: q.why, source: `Lesson ${l.id}` }));
  for (const m of missionsData.missions) (m.quiz ?? []).forEach((q) => out.push({ id: `m${m.id}-${q.id}`, topic: MISSION_TOPIC[m.id] ?? 'us', links: [`mission:${m.id}`], q: q.q, options: q.options, answer: q.answer, why: q.why, source: `Mission ${m.id}` }));
  for (const d of drills) out.push({ id: `d-${d.id}`, topic: 'lifecycle', links: ['lesson:5'], q: `${d.situation} ${d.question}`, options: d.options, answer: d.answer, why: d.why, source: 'Lifecycle drill', context: d.current });
  cache = out;
  return out;
}

export const countByTopic = () => allQuestions().reduce((m, q) => ({ ...m, [q.topic]: (m[q.topic] ?? 0) + 1 }), {});

const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A set of questions. Options are shuffled too, with the answer index remapped.
export function buildSet({ topics = [], n = 10, seed = Date.now(), link = null } = {}) {
  const r = rng(seed);
  let pool = allQuestions();
  if (topics.length) pool = pool.filter((q) => topics.includes(q.topic));
  if (link) pool = pool.filter((q) => q.links?.includes(link));
  return shuffle(pool, r).slice(0, n).map((q) => {
    const order = shuffle(q.options.map((_, i) => i), r);
    return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
  });
}

export function scoreSet(set, answers) {
  const byTopic = {};
  let right = 0;
  for (const q of set) {
    const ok = answers[q.id] === q.answer;
    if (ok) right++;
    const t = (byTopic[q.topic] ??= { right: 0, total: 0 });
    t.total++; if (ok) t.right++;
  }
  return { right, total: set.length, score: set.length ? Math.round((right / set.length) * 100) : 0, byTopic };
}

export const EXAM = { n: 30, minutes: 40, pass: 70 };
