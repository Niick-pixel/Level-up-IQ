// The Daily Mix planner (spec §5). A fixed arc, filled by weighted random choice:
//   (reviews due) → warm-up (attention) → logic → memory → [extra rounds for your weakest skills
//   while time allows] → keyword of the day (ends with explain-it-back) → a deep-thinking prompt
//   when there's time → video suggestions.
// Weights: weaker skills are favoured, games played in the last 3 days are mostly avoided, and
// Simon Tatham's 24 puzzles count as one family so they don't crowd everything else out.
// Pure and seeded: the same inputs always give the same plan.

const DAY = 24 * 3600 * 1000;
export const RECENT_DAYS = 3;
const KEYWORD_SEC = 180;
const VIDEOS_SEC = 30;
const SEC_PER_CARD = 12;
const MAX_REVIEW = 10;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** Typical time for a round: most people land nearer the low end of a game's range. */
export const estimateSec = (meta) => meta.durationRange[0] + 0.35 * (meta.durationRange[1] - meta.durationRange[0]);

/** How much a skill needs work: > 1 below your average rating, < 1 above it; unplayed = 1.5. */
export function weakness(ratings, skill) {
  const vals = Object.values(ratings).filter((x) => x.n > 0).map((x) => x.r);
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1200;
  const s = ratings[skill];
  if (!s || !s.n) return 1.5;
  return clamp(Math.exp((mean - s.r) / 250), 0.5, 3);
}

/** Weight for playing a game now. Exported for tests. */
export function gameWeight(meta, { ratings, recent, now }) {
  let w = weakness(ratings, meta.skills[0]);
  const last = recent.filter((r) => r.gameId === meta.id).reduce((m, r) => Math.max(m, r.at), 0);
  if (last && now - last < RECENT_DAYS * DAY) w *= 0.1;
  if (meta.id.startsWith('tatham-')) w *= 3 / 24;
  return w;
}

function eligible(metas, ctx) {
  return metas.filter((m) =>
    !ctx.exclude.has(m.id)
    && !(ctx.offline && m.offline === false)
    && !(m.needsCards && !ctx.hasCards)
    && m.durationRange[0] <= 8 * 60); // no 20-minute chess games inside a 10-minute mix
}

/** Games that would overrun their share of the session are down-weighted (not banned). */
const fit = (m, slotSec) => (!slotSec || estimateSec(m) <= slotSec ? 1 : (slotSec / estimateSec(m)) ** 3);

function pickFor(rng, pool, ctx, used, slotSec = 0) {
  const options = pool.filter((m) => !used.has(m.id));
  if (!options.length) return null;
  const choice = rng.weighted(options, (m) => gameWeight(m, ctx) * fit(m, slotSec));
  used.add(choice.id);
  return choice;
}

/**
 * @param {object} a
 * @param {object[]} a.metas        game metas (id, skills, durationRange, offline, needsCards)
 * @param {object} a.ratings        { skill: { r, n } }
 * @param {{gameId, at}[]} a.recent plays in the last few days
 * @param {number} a.now
 * @param {object} a.rng            seeded rng (makeRng)
 * @param {number} [a.minutes=10]
 * @param {number} [a.reviewsDue=0]
 * @param {boolean} [a.offline=false]
 * @param {boolean} [a.hasCards=false]
 * @param {string[]} [a.exclude=[]]
 * @returns {{ steps: object[], estimatedSec: number }}
 */
export function planMix({ metas, ratings, recent, now, rng, minutes = 10, reviewsDue = 0, offline = false, hasCards = false, exclude = [] }) {
  const ctx = { ratings, recent, now, offline, hasCards, exclude: new Set(exclude) };
  const pool = eligible(metas, ctx);
  const bySkill = (skill) => pool.filter((m) => m.skills[0] === skill);
  const used = new Set();
  const budget = minutes * 60;
  const steps = [];
  let sec = 0;

  if (reviewsDue > 0) {
    const n = Math.min(MAX_REVIEW, reviewsDue);
    steps.push({ kind: 'review', label: 'Review', count: n });
    sec += n * SEC_PER_CARD;
  }
  const tail = KEYWORD_SEC + VIDEOS_SEC + 180; // keyword + videos + a short think prompt
  const slot = Math.max(45, (budget - sec - tail) / 3); // the three core rounds share what's left
  const add = (skill, label) => {
    const g = pickFor(rng, bySkill(skill), ctx, used, slot);
    if (g) { steps.push({ kind: 'game', gameId: g.id, label, skill }); sec += estimateSec(g); }
    return g;
  };
  add('attention', 'Warm-up');
  add('logic', 'Logic');
  add('memory', 'Memory');

  // extra rounds, weakest skills first (weighted), while there's time
  const extras = ['math', 'language', 'spatial', 'strategy', 'knowledge'];
  let guard = 0;
  while (sec + tail < budget && guard++ < 8) {
    const remaining = extras.filter((s) => bySkill(s).some((m) => !used.has(m.id)));
    if (!remaining.length) break;
    const skill = rng.weighted(remaining, (s) => weakness(ratings, s));
    const g = pickFor(rng, bySkill(skill).filter((m) => sec + estimateSec(m) + tail <= budget + 60), ctx, used);
    if (!g) { extras.splice(extras.indexOf(skill), 1); continue; }
    steps.push({ kind: 'game', gameId: g.id, label: skill[0].toUpperCase() + skill.slice(1), skill });
    sec += estimateSec(g);
  }

  steps.push({ kind: 'keyword', label: 'Keyword of the day' });
  sec += KEYWORD_SEC;
  // the keyword step already ends with explain-it-back; a separate think prompt only if it fits
  const think = pickFor(rng, bySkill('deep-thinking').filter((m) => m.id !== 'explain-back' && sec + m.durationRange[0] + VIDEOS_SEC <= budget + 90), ctx, used);
  if (think) { steps.push({ kind: 'game', gameId: think.id, label: 'Think', skill: 'deep-thinking' }); sec += think.durationRange[0]; }
  if (!offline) { steps.push({ kind: 'videos', label: 'Something to watch' }); sec += VIDEOS_SEC; }
  return { steps, estimatedSec: Math.round(sec) };
}

/** Next game for Marathon mode: the same weighting, any skill, never the last few games. */
export function nextMarathonGame({ metas, ratings, recent, now, rng, offline = false, hasCards = false, lastIds = [] }) {
  const ctx = { ratings, recent, now, offline, hasCards, exclude: new Set(lastIds.slice(-5)) };
  const pool = eligible(metas, ctx);
  return pool.length ? rng.weighted(pool, (m) => gameWeight(m, ctx)).id : null;
}
