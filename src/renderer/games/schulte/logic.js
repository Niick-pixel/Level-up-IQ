// Schulte table: find the numbers in order, as fast as you can. Trains visual search and
// peripheral attention: try to keep your eyes on the centre.

export const meta = {
  id: 'schulte',
  name: 'Schulte table',
  blurb: 'Find 1, 2, 3… in order as fast as you can. Keep your eyes near the centre.',
  howTo: ['Click the numbers in order.', 'Keyboard: arrow keys move, Enter or Space picks.'],
  skills: ['attention', 'spatial'],
  durationRange: [15, 120],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const gridSize = (d) => [3, 3, 4, 4, 4, 5, 5, 5, 6, 6][d - 1];

/** Seconds a practised player needs for a size×size table. */
export const parSeconds = (size) => size * size * 1.1;

/** Numbers 1..size² in a shuffled grid (row-major). */
export function genGrid(rng, size) {
  return rng.shuffle(Array.from({ length: size * size }, (_, i) => i + 1));
}

export function scoreRound({ size, timeMs, mistakes, difficulty }) {
  const cells = size * size;
  const accuracy = cells / (cells + mistakes);
  const speed = Math.min(1, (0.75 * parSeconds(size)) / Math.max(1, timeMs / 1000));
  return {
    accuracy,
    performance: Math.min(1, accuracy * speed * 1.2),
    score: Math.round((cells * 1000) / Math.max(1, timeMs / 1000) * accuracy * (1 + difficulty / 10)),
  };
}
