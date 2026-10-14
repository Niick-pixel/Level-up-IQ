// Play a full game against Stockfish. Strength follows the level through Stockfish's own
// "Skill Level" option plus a search-depth cap, so level 1 blunders like a beginner and
// level 10 is far stronger than almost any human.
export const meta = {
  id: 'chess-engine',
  name: 'Play vs Stockfish',
  blurb: 'A full game of chess against the Stockfish engine, at a strength that fits your level.',
  howTo: ['Pick your colour; with the coach on you get hints, take-backs, a live evaluation and a review of your game.', 'Click a piece, then a square (or arrows + Enter).', 'The engine (GPL-3.0) downloads once, about 1.8 MB. Win = full marks, draw = half; coach help lowers the score a little.'],
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

/** Result for the player: 1 win, 0.5 draw, 0 loss; each hint or take-back costs a little. */
export function scoreGame({ outcome, plies, difficulty, help = 0 }) {
  const result = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  // a long, hard-fought loss says more than a quick one
  const effort = outcome === 'loss' ? Math.min(0.25, plies / 400) : 0;
  const performance = Math.max(0, Math.min(1, (result + effort) * (1 - Math.min(0.5, help * 0.06))));
  return { score: Math.round(performance * 100 * difficulty), accuracy: result, performance };
}

/** UCI "info ... score cp 34 | score mate -3" → centipawns for the side to move (mate = ±10000 − distance). */
export function parseScore(line) {
  const m = / score (cp|mate) (-?\d+)/.exec(line);
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === 'cp' ? n : n > 0 ? 10000 - n : n < 0 ? -10000 - n : 0;
}

/** Centipawns → share of the bar for White (0..1), on the usual logistic curve. */
export const whiteShare = (cp) => 1 / (1 + Math.exp(-cp / 400));

/** "+1.3", "−0.4", "M3", "−M2" from White's point of view. */
export function fmtEval(cp) {
  if (Math.abs(cp) >= 9000) return `${cp < 0 ? '−' : ''}M${10000 - Math.abs(cp)}`;
  const v = (cp / 100).toFixed(1);
  return cp > 0 ? `+${v}` : cp < 0 ? `−${v.slice(1)}` : '0.0';
}

/** How much a move lost, in centipawns from the mover's view (mates capped), → a label. */
export function classify(loss, isBest) {
  if (isBest || loss <= 15) return 'best';
  if (loss <= 50) return 'good';
  if (loss <= 110) return 'inaccuracy';
  if (loss <= 260) return 'mistake';
  return 'blunder';
}
export const capCp = (cp) => Math.max(-1500, Math.min(1500, cp));
