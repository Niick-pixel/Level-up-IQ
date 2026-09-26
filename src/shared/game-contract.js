// The contract every game follows. See docs/PHASE0_PLAN.md §2.1.
//
//   export const meta = { id, name, blurb, skills, durationRange, difficultyRange, offline, lang };
//   export function start(root, ctx) → { pause(), resume(), destroy() }
//
// ctx = { difficulty, seed, rng, settings, hints, onFinish, onProgress }
// onFinish({ score, accuracy, timeMs, difficulty, performance })
//   accuracy    0..1, share of correct answers
//   performance 0..1, how well the round went for rating purposes (defaults to accuracy)

export const SKILLS = [
  'logic', 'math', 'language', 'memory', 'attention', 'spatial', 'strategy', 'knowledge', 'deep-thinking',
];

export const SKILL_LABELS = {
  logic: 'Logic',
  math: 'Math',
  language: 'Language',
  memory: 'Memory',
  attention: 'Attention',
  spatial: 'Spatial',
  strategy: 'Strategy',
  knowledge: 'Knowledge',
  'deep-thinking': 'Deep thinking',
};

/** Returns a list of problems with a game's meta (empty = valid). */
export function validateMeta(meta) {
  const errors = [];
  if (!meta || typeof meta !== 'object') return ['meta missing'];
  if (!/^[a-z0-9-]+$/.test(meta.id || '')) errors.push('id must be kebab-case');
  if (!meta.name) errors.push('name missing');
  if (!Array.isArray(meta.skills) || !meta.skills.length) errors.push('skills missing');
  else for (const s of meta.skills) if (!SKILLS.includes(s)) errors.push(`unknown skill ${s}`);
  const range = (r) => Array.isArray(r) && r.length === 2 && r[0] <= r[1];
  if (!range(meta.durationRange)) errors.push('durationRange must be [min, max] seconds');
  if (!range(meta.difficultyRange) || meta.difficultyRange[0] < 1 || meta.difficultyRange[1] > 10) {
    errors.push('difficultyRange must be within [1, 10]');
  }
  if (typeof meta.offline !== 'boolean') errors.push('offline must be a boolean');
  return errors;
}

/** Normalizes what a game reports so stats and ratings can trust it. */
export function normalizeResult(r, meta) {
  const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
  const accuracy = clamp01(r.accuracy);
  return {
    gameId: meta.id,
    skills: meta.skills.slice(),
    difficulty: Math.min(10, Math.max(1, Math.round(r.difficulty) || 1)),
    score: Math.max(0, Math.round(Number(r.score) || 0)),
    accuracy,
    performance: clamp01(r.performance ?? accuracy),
    timeMs: Math.max(0, Math.round(Number(r.timeMs) || 0)),
    seed: String(r.seed ?? ''),
  };
}
