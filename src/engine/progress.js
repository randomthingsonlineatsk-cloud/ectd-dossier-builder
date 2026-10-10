// Career levels, badges and the progress summary, computed from projects, mission
// attempts and lesson scores already stored in the browser (nothing extra is saved).
import { MISSIONS } from './missions.js';
import { validate } from './validate.js';

export const LEVELS = [
  { id: 'associate', label: 'Associate', rule: 'Where everyone starts.' },
  { id: 'specialist', label: 'Specialist', rule: '3 missions scored 70% or more.' },
  { id: 'senior', label: 'Senior Specialist', rule: '6 missions scored 80% or more, at least one at standard or expert level.' },
  { id: 'lead', label: 'Lead', rule: '10 missions scored 80% or more, including 3 at expert level.' },
];

export const BADGES = [
  { id: 'first-valid', label: 'First valid sequence', about: 'Publish a sequence with no High findings.' },
  { id: 'zero-error', label: 'Zero-error publish', about: 'Publish a sequence with no findings at all.' },
  { id: 'all-regions', label: 'All regions', about: 'Publish sequences for both the US and the EU.' },
  { id: 'lifecycle', label: 'Lifecycle hand', about: 'Score 80% or more on missions 4, 5 and 6.' },
  { id: 'reviewer-eye', label: "Reviewer's eye", about: 'Find every contradiction in reviewer\'s eye mode before revealing.' },
  { id: 'rescuer', label: 'Rescuer', about: 'Score 80% or more on mission 11.' },
  { id: 'speed', label: 'Against the clock', about: 'Finish an expert mission within its time with 80% or more.' },
  { id: 'scholar', label: 'Scholar', about: 'Score 80% or more on every lesson quiz.' },
];

export function bestByMission(attempts) {
  const best = {};
  for (const a of attempts) {
    if (a.kind !== 'mission' || a.score == null) continue;
    const b = best[a.missionId];
    if (!b || a.score > b.score) best[a.missionId] = a;
  }
  return best;
}

export function progressSummary({ projects, attempts, lessonProgress, lessonCount }) {
  const done = attempts.filter((a) => a.kind === 'mission' && a.score != null);
  const best = bestByMission(done);
  const scored = (min) => Object.values(best).filter((a) => a.score >= min);
  const harder = done.filter((a) => a.score >= 80 && a.difficulty !== 'guided');
  const expert = new Set(done.filter((a) => a.score >= 80 && a.difficulty === 'expert').map((a) => a.missionId));

  let level = LEVELS[0];
  if (scored(70).length >= 3) level = LEVELS[1];
  if (scored(80).length >= 6 && harder.length >= 1) level = LEVELS[2];
  if (scored(80).length >= 10 && expert.size >= 3) level = LEVELS[3];

  const published = [];
  for (const p of projects) for (const s of p.sequences) if (s.status === 'published') published.push({ p, s, counts: s.publishSummary?.counts ?? validate(p, s.number).counts });
  const ok = (id, min = 80) => (best[id]?.score ?? 0) >= min;
  const earned = {
    'first-valid': published.some((x) => x.counts.High === 0),
    'zero-error': published.some((x) => x.counts.High + x.counts.Medium + x.counts.Low === 0),
    'all-regions': ['US', 'EU'].every((r) => published.some((x) => x.p.region === r)),
    lifecycle: ok(4) && ok(5) && ok(6),
    'reviewer-eye': projects.some((p) => p.reviewerEye?.score === 100),
    rescuer: ok(11),
    speed: done.some((a) => a.difficulty === 'expert' && a.score >= 80 && a.withinTime),
    scholar: lessonCount > 0 && Array.from({ length: lessonCount }, (_, i) => lessonProgress[i + 1]?.best ?? 0).every((b) => b >= 80),
  };

  // Strengths and weak areas from the four scoring axes of recorded attempts.
  const axes = { technical: [], lifecycle: [], consistency: [], time: [] };
  for (const a of done) for (const k of Object.keys(axes)) if (a.axes?.[k] != null) axes[k].push(a.axes[k]);
  const avg = Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null]));

  const missions = MISSIONS.map((m) => ({ ...m, best: best[m.id] ?? null, tries: done.filter((a) => a.missionId === m.id).length }));
  return { level, best, earned, avg, missions, publishedCount: published.length };
}
