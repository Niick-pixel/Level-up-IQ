// Trail making (after the Trail Making Test): connect scattered circles in order as fast as you
// can. From level 4 the trail alternates numbers and letters (1 → A → 2 → B …), which makes you
// hold two sequences and switch between them: a classic test of executive function.

export const meta = {
  id: 'trail-making',
  name: 'Trail making',
  blurb: 'Connect the circles in order. Later: 1 → A → 2 → B → 3 …',
  howTo: ['Click the circles in order.', 'From level 4, alternate numbers and letters: 1, A, 2, B, 3, C…', 'Keyboard: Tab to a circle, Enter to pick.'],
  skills: ['attention', 'logic'],
  durationRange: [30, 150],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const alternating = (d) => d >= 4;
export const count = (d) => (alternating(d) ? 10 + 2 * (d - 4) : 10 + 2 * d);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The labels in order: 1,2,3… or 1,A,2,B… */
export function labels(d) {
  const n = count(d);
  if (!alternating(d)) return Array.from({ length: n }, (_, i) => String(i + 1));
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? String(i / 2 + 1) : LETTERS[(i - 1) / 2]));
}

/** Positions in a 100 × 64 field, at least `gap` apart (percent units). */
export function layout(rng, n, gap = 11) {
  for (let g = gap; g > 4; g -= 0.5) {
    const pts = [];
    let guard = 0;
    while (pts.length < n && guard++ < 3000) {
      const p = { x: 6 + rng.next() * 88, y: 6 + rng.next() * 52 };
      if (pts.every((q) => Math.hypot(q.x - p.x, (q.y - p.y) * 1.2) >= g)) pts.push(p);
    }
    if (pts.length === n) return pts;
  }
  throw new Error('Could not place the circles');
}

export const parSeconds = (d) => count(d) * (alternating(d) ? 1.9 : 1.2);

export function scoreRound({ d, timeMs, mistakes }) {
  const n = count(d);
  const accuracy = n / (n + mistakes);
  const speed = Math.min(1, parSeconds(d) / Math.max(1, timeMs / 1000));
  return {
    accuracy,
    performance: Math.min(1, accuracy * speed * 1.15),
    score: Math.round((n * 1000) / Math.max(1, timeMs / 1000) * accuracy * (1 + d / 10)),
  };
}
