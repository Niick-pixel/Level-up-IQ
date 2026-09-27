// Corsi blocks: the spatial twin of digit span. Blocks light up in turn; tap them in the same order.
export const meta = {
  id: 'corsi',
  name: 'Corsi blocks',
  blurb: 'Blocks light up one after another. Tap them in the same order.',
  howTo: ['Watch the blocks light up.', 'Then click (or Tab + Enter) them in the same order.', 'Get one right and the next sequence is longer.'],
  skills: ['memory', 'spatial'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const BLOCKS = 9;
export const startSpan = (d) => Math.min(7, 2 + Math.ceil(d / 2));
export const msPerBlock = (d) => Math.max(550, 950 - d * 40);

/** Block positions (percent of the board), scattered but never overlapping. */
export function layout(rng, n = BLOCKS) {
  for (;;) {
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries++ < 2000) {
      const p = { x: rng.int(4, 84), y: rng.int(4, 84) };
      if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 19)) pts.push(p);
    }
    if (pts.length === n) return pts;
  }
}

/** A sequence of distinct blocks. */
export const genSequence = (rng, span, n = BLOCKS) => rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, Math.min(span, n));
