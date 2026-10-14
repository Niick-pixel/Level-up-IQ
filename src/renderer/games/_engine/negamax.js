// A small game-tree search for the board games against the computer (Reversi, Checkers,
// Mancala): negamax with alpha-beta pruning. A game supplies four pure functions; scores are
// always from the point of view of the side to move.
//
//   moves(state) → move[]              (empty = no move; the game decides what that means)
//   play(state, move) → state          (a new state; never mutate the old one)
//   evaluate(state) → number           (good for the side to move = positive)
//   over(state) → null | number        (final score for the side to move, or null if not over)
//   sameSide?(before, after) → bool    (Mancala's extra turn: the same player moves again)

export const WIN = 1e6;

/**
 * Best move for the side to move.
 * @param {object} g     the game functions above
 * @param {object} state
 * @param {number} depth plies to look ahead
 * @param {{ rng?, slip?: number, budget?: number }} opts  slip = chance of picking a weaker move
 * @returns {{ move, score, scored: {move, score}[] }}
 */
export function bestMove(g, state, depth, { rng = null, slip = 0, budget = 400000 } = {}) {
  let nodes = 0;
  const search = (s, d, alpha, beta) => {
    nodes += 1;
    const end = g.over(s);
    if (end != null) return end;
    if (d <= 0 || nodes > budget) return g.evaluate(s);
    const ms = g.moves(s);
    let best = -Infinity;
    for (const m of ms) {
      const next = g.play(s, m);
      const keep = g.sameSide?.(s, next);
      const v = keep ? search(next, d - 1, alpha, beta) : -search(next, d - 1, -beta, -alpha);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  };

  const moves = g.moves(state);
  const scored = moves.map((m) => {
    const next = g.play(state, m);
    const keep = g.sameSide?.(state, next);
    const v = keep ? search(next, depth - 1, -Infinity, Infinity) : -search(next, depth - 1, -Infinity, Infinity);
    return { move: m, score: v };
  }).sort((a, b) => b.score - a.score);
  if (!scored.length) return { move: null, score: g.evaluate(state), scored };
  // a deliberate slip at low levels: one of the next-best moves, never a move into a lost position
  // when something better exists
  if (rng && slip > 0 && scored.length > 1 && rng.chance(slip)) {
    const ok = scored.filter((x) => x.score > -WIN / 2);
    const pool = (ok.length > 1 ? ok : scored).slice(1, 4);
    if (pool.length) return { ...rng.pick(pool), scored };
  }
  // among equally good moves, vary (seeded) so games differ
  const top = scored.filter((x) => x.score === scored[0].score);
  return { ...(rng ? rng.pick(top) : top[0]), scored };
}
