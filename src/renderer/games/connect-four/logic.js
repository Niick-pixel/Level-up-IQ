// Connect Four against a minimax opponent (negamax with alpha-beta pruning). Deeper search and
// fewer deliberate slips as the level rises.
export const meta = {
  id: 'connect-four',
  name: 'Connect Four',
  blurb: 'Drop discs to line up four in a row before the computer does.',
  howTo: ['Click a column (or press 1–7) to drop a disc.', 'Four in a row (across, down or diagonal) wins.'],
  skills: ['strategy', 'spatial'],
  durationRange: [60, 400],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const COLS = 7;
export const ROWS = 6;
export const depthFor = (d) => [1, 2, 2, 3, 4, 5, 6, 7, 8, 9][Math.min(9, Math.max(0, d - 1))];
export const slipFor = (d) => [0.45, 0.35, 0.25, 0.2, 0.15, 0.1, 0.06, 0.03, 0, 0][Math.min(9, Math.max(0, d - 1))];
const ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre first: better pruning, better play

export const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
export const canDrop = (b, c) => b[0][c] === 0;
export const legal = (b) => ORDER.filter((c) => canDrop(b, c));

/** Drops a disc for player p (1 or 2); returns the row, or -1. Mutates b. */
export function drop(b, c, p) {
  for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) { b[r][c] = p; return r; }
  return -1;
}
const undo = (b, c) => { for (let r = 0; r < ROWS; r++) if (b[r][c]) { b[r][c] = 0; return; } };

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
/** The four cells of a win through (r, c), or null. */
export function winLine(b, r, c) {
  const p = b[r][c];
  if (!p) return null;
  for (const [dr, dc] of DIRS) {
    const cells = [[r, c]];
    for (const s of [1, -1]) {
      let y = r + dr * s, x = c + dc * s;
      while (y >= 0 && y < ROWS && x >= 0 && x < COLS && b[y][x] === p) { cells.push([y, x]); y += dr * s; x += dc * s; }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}
export const full = (b) => b[0].every((v) => v);

/** Static evaluation from p's point of view: open windows of 2 and 3, the centre column. */
function evaluate(b, p) {
  const q = 3 - p;
  let score = 0;
  for (let r = 0; r < ROWS; r++) if (b[r][3] === p) score += 3; else if (b[r][3] === q) score -= 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3, ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let mine = 0, theirs = 0;
        for (let k = 0; k < 4; k++) { const v = b[r + dr * k][c + dc * k]; if (v === p) mine++; else if (v === q) theirs++; }
        if (mine && theirs) continue;
        if (mine === 3) score += 5; else if (mine === 2) score += 2;
        if (theirs === 3) score -= 5; else if (theirs === 2) score -= 2;
      }
    }
  }
  return score;
}

function negamax(b, depth, alpha, beta, p) {
  const moves = legal(b);
  if (!moves.length) return 0;
  // win now?
  for (const c of moves) {
    const r = drop(b, c, p);
    const won = winLine(b, r, c);
    undo(b, c);
    if (won) return 100000 + depth;
  }
  if (depth === 0) return evaluate(b, p);
  let best = -Infinity;
  for (const c of moves) {
    drop(b, c, p);
    const v = -negamax(b, depth - 1, -beta, -alpha, 3 - p);
    undo(b, c);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's column for player p. Occasionally (lower levels) a random non-losing slip. */
export function bestMove(b, p, d, rng) {
  const moves = legal(b);
  const depth = depthFor(d);
  const scored = moves.map((c) => {
    const r = drop(b, c, p);
    const v = winLine(b, r, c) ? 1e6 : -negamax(b, depth - 1, -Infinity, Infinity, 3 - p);
    undo(b, c);
    return { c, v };
  });
  const top = Math.max(...scored.map((s) => s.v));
  if (top < 1e5 && rng.chance(slipFor(d))) {
    const safe = scored.filter((s) => s.v > -1e5);
    if (safe.length) return rng.pick(safe).c;
  }
  const best = scored.filter((s) => s.v === top);
  return rng.pick(best).c;
}
