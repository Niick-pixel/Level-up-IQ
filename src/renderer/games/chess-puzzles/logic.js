// Chess puzzles from the Lichess puzzle database (CC0), picked near a rating that rises with
// the level. Each puzzle starts with the opponent's move; then find the best reply (and the
// follow-ups).
export const meta = {
  id: 'chess-puzzles',
  name: 'Chess puzzles',
  blurb: 'Find the winning move (and the next ones). Rated puzzles from the Lichess database.',
  howTo: ['Your opponent moves first; then it is your turn.', 'Click a piece, then its square (or arrows + Enter).', 'Any move that mates also counts.'],
  skills: ['strategy', 'logic'],
  durationRange: [60, 420],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const PER_ROUND = 3;
export const targetRating = (d) => 400 + (d - 1) * 250;

/** Pack rows are [id, fen, moves, rating, themes]. */
export function pickPuzzles(rng, d, pack, n = PER_ROUND) {
  const target = targetRating(d);
  let near = [];
  for (let spread = 100; near.length < n * 4 && spread <= 1200; spread += 100) {
    near = pack.puzzles.filter((p) => Math.abs(p[3] - target) <= spread);
  }
  return rng.shuffle(near).slice(0, n).map(([id, fen, moves, rating, themes]) => ({
    id, fen, moves: moves.split(' '), rating, themes: themes.split(' '),
  }));
}

/** Readable theme tags from Lichess's camelCase names ("mateIn2" → "mate in 2"). */
export const themeLabel = (t) => t.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();

export const CREDIT = { clean: 1, mistakes: 0.4, revealed: 0 };

export function scoreRound(results, difficulty) {
  const credit = results.reduce((s, r) => s + CREDIT[r.outcome], 0);
  const accuracy = results.length ? credit / results.length : 0;
  return { score: Math.round(results.reduce((s, r) => s + CREDIT[r.outcome] * r.rating, 0) / 10), accuracy, performance: accuracy };
}
