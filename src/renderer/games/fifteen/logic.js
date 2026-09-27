// The 15-puzzle (and its 3×3 and 5×5 cousins): slide the tiles back into order.
// Scrambles are random walks from the solved board, so every one is solvable.
export const meta = {
  id: 'fifteen',
  name: '15-puzzle',
  blurb: 'Slide the numbered tiles back into order, using the one empty space.',
  howTo: ['Click a tile in the same row or column as the gap to slide it.', 'Or use the arrow keys to move a tile into the gap.', 'Fewer moves score higher.'],
  skills: ['spatial', 'logic'],
  durationRange: [60, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const sizeFor = (d) => (d <= 3 ? 3 : d <= 8 ? 4 : 5);
export const scrambleFor = (d) => [12, 20, 40, 30, 50, 80, 120, 200, 150, 250][Math.min(9, d - 1)];

export const solved = (n) => [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0];
export const isSolved = (board) => board.every((v, i) => v === (i === board.length - 1 ? 0 : i + 1));

const neighbours = (i, n) => {
  const r = Math.floor(i / n), c = i % n;
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && y < n && x >= 0 && x < n).map(([y, x]) => y * n + x);
};

/** Random walk of the gap without undoing the previous step; retried until not already solved. */
export function scramble(rng, n, steps) {
  for (;;) {
    const b = solved(n);
    let gap = b.length - 1;
    let prev = -1;
    for (let s = 0; s < steps; s++) {
      const opts = neighbours(gap, n).filter((k) => k !== prev);
      const k = rng.pick(opts);
      [b[gap], b[k]] = [b[k], b[gap]];
      prev = gap;
      gap = k;
    }
    if (!isSolved(b)) return b;
  }
}

/** Solvability test (for tests): inversion parity, plus the gap's row for even widths. */
export function isSolvable(board, n) {
  const t = board.filter((v) => v);
  let inv = 0;
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i] > t[j]) inv++;
  if (n % 2) return inv % 2 === 0;
  const gapRowFromBottom = n - Math.floor(board.indexOf(0) / n);
  return (inv + gapRowFromBottom) % 2 === 1;
}

/** Slides tile(s) toward the gap if index i shares its row or column. Returns moves made (0 or more). */
export function slide(board, n, i) {
  const gap = board.indexOf(0);
  const [gr, gc, r, c] = [Math.floor(gap / n), gap % n, Math.floor(i / n), i % n];
  if (i === gap || (gr !== r && gc !== c)) return 0;
  const step = gr === r ? (c > gc ? 1 : -1) : (r > gr ? n : -n);
  let g = gap;
  let moved = 0;
  while (g !== i) {
    board[g] = board[g + step];
    board[g + step] = 0;
    g += step;
    moved += 1;
  }
  return moved;
}

/** Manhattan distance: a lower bound on the moves still needed (used for par). */
export function manhattan(board, n) {
  return board.reduce((s, v, i) => (v ? s + Math.abs(Math.floor(i / n) - Math.floor((v - 1) / n)) + Math.abs((i % n) - ((v - 1) % n)) : s), 0);
}

export function scoreRound({ moves, par, difficulty, n }) {
  const performance = Math.max(0.2, Math.min(1, (par * 1.4) / Math.max(1, moves)));
  return { score: Math.round(n * n * 20 * performance * (1 + difficulty / 10)), accuracy: 1, performance };
}
