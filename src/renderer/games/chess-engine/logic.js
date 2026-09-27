// Play a full game against Stockfish. Strength follows the level through Stockfish's own
// "Skill Level" option plus a search-depth cap, so level 1 blunders like a beginner and
// level 10 is far stronger than almost any human.
export const meta = {
  id: 'chess-engine',
  name: 'Play vs Stockfish',
  blurb: 'A full game of chess against the Stockfish engine, at a strength that fits your level.',
  howTo: ['Click a piece, then a square (or arrows + Enter).', 'The engine (GPL-3.0) downloads once, about 1.8 MB.', 'Win = full marks, draw = half.'],
  skills: ['strategy'],
  durationRange: [300, 2400],
  difficultyRange: [1, 10],
  offline: true, // after the one-time download
  lang: [],
};

/** Stockfish settings for a level: Skill Level 0–20, a depth cap and a thinking time. */
export function strength(d) {
  const level = Math.min(10, Math.max(1, d));
  return {
    skill: [0, 1, 3, 5, 7, 9, 12, 15, 18, 20][level - 1],
    depth: [1, 2, 3, 5, 6, 8, 10, 12, 16, 22][level - 1],
    movetime: [100, 150, 200, 300, 400, 500, 700, 900, 1200, 1500][level - 1],
  };
}

/** Result for the player: 1 win, 0.5 draw, 0 loss. */
export function scoreGame({ outcome, plies, difficulty }) {
  const performance = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  // a long, hard-fought loss says more than a quick one
  const effort = outcome === 'loss' ? Math.min(0.25, plies / 400) : 0;
  return { score: Math.round((performance + effort) * 100 * difficulty), accuracy: performance, performance: Math.min(1, performance + effort) };
}
