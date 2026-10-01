// Named difficulty (1.1). Levels are 1–10 everywhere; a difficulty mode keeps the level the
// app suggests inside a band, still adapting to you within it. "Adaptive" uses the full range.

export const DIFFICULTY_BANDS = {
  adaptive: [1, 10],
  easy: [1, 3],
  medium: [4, 6],
  hard: [6, 8],
  expert: [8, 10],
};

export const MODE_LABELS = { adaptive: 'Adaptive', easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

/** What a level is called: 1–3 Easy, 4–5 Medium, 6–7 Hard, 8–9 Expert, 10 Genius. */
export function levelName(d) {
  return d <= 3 ? 'Easy' : d <= 5 ? 'Medium' : d <= 7 ? 'Hard' : d <= 9 ? 'Expert' : 'Genius';
}

/** Clamps a suggested level into the mode's band and the game's own range. */
export function applyMode(level, mode = 'adaptive', range = [1, 10]) {
  const [lo, hi] = DIFFICULTY_BANDS[mode] || DIFFICULTY_BANDS.adaptive;
  const banded = Math.min(hi, Math.max(lo, level));
  return Math.min(range[1], Math.max(range[0], banded));
}
