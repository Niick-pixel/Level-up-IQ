// Kakuro: fill white cells with 1–9 so each run adds up to its clue, with no repeats in a run.
// The generator makes a random well-formed grid, fills it, then adds given digits until the
// solver proves the puzzle has exactly one solution.

export const meta = {
  id: 'kakuro',
  name: 'Kakuro',
  blurb: 'A crossword of sums: each run of white cells adds up to its clue, using 1–9 with no repeats.',
  howTo: ['Click a cell and type a digit (arrow keys move, Backspace clears).', 'Clues: the number above the slash is for the run going down, below it for the run going across.'],
  skills: ['math', 'logic'],
  durationRange: [120, 900],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const sizeFor = (d) => (d <= 3 ? 4 : d <= 6 ? 5 : d <= 8 ? 6 : 7);

// Every subset of 1..9 as a bitmask (bit k = digit k), with its size and sum.
const SUBSETS = [...Array(512).keys()].map((m) => {
  let size = 0, sum = 0;
  for (let k = 1; k <= 9; k++) if (m & (1 << (k - 1))) { size += 1; sum += k; }
  return { m, size, sum };
});
const bitOf = (digit) => 1 << (digit - 1);

/** Digits that can still go in a run with `left` empty cells summing to `rest`, excluding `used`. */
function runOptions(left, rest, used) {
  let out = 0;
  for (const s of SUBSETS) if (s.size === left && s.sum === rest && !(s.m & used)) out |= s.m;
  return out;
}

/**
 * Builds the grid shape: (n+1)×(n+1) with row 0 and column 0 black. Every white cell sits in
 * an across run and a down run of length 2–9, and all white cells connect.
 */
export function makeShape(rng, n) {
  const N = n + 1;
  for (let attempt = 0; attempt < 500; attempt++) {
    const white = [...Array(N)].map((_, r) => [...Array(N)].map((_, c) => r > 0 && c > 0));
    for (let r = 1; r < N; r++) {
      for (let c = 1; c < N; c++) {
        if (rng.chance(0.22)) {
          white[r][c] = false;
          white[N - r][N - c] = false; // keep the pattern symmetric, like published puzzles
        }
      }
    }
    // remove runs of length 1 until stable
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 1; r < N; r++) {
        for (let c = 1; c < N; c++) {
          if (!white[r][c]) continue;
          const across = (white[r][c - 1] ? 1 : 0) + (white[r][c + 1] ? 1 : 0);
          const down = (white[r - 1]?.[c] ? 1 : 0) + (white[r + 1]?.[c] ? 1 : 0);
          if (!across || !down) { white[r][c] = false; changed = true; }
        }
      }
    }
    const cells = [];
    for (let r = 1; r < N; r++) for (let c = 1; c < N; c++) if (white[r][c]) cells.push([r, c]);
    if (cells.length < n * n * 0.55) continue;
    // connected?
    const seen = new Set([cells[0].join()]);
    const stack = [cells[0]];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${r + dr},${c + dc}`;
        if (white[r + dr]?.[c + dc] && !seen.has(k)) { seen.add(k); stack.push([r + dr, c + dc]); }
      }
    }
    if (seen.size === cells.length) return white;
  }
  throw new Error('Could not make a Kakuro grid');
}

/** Runs of white cells: { cells: [[r,c]…], dir: 'across'|'down', head: [r,c] (the clue cell) }. */
export function runsOf(white) {
  const N = white.length;
  const runs = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (white[r][c]) continue;
      for (const [dir, dr, dc] of [['across', 0, 1], ['down', 1, 0]]) {
        const cells = [];
        for (let rr = r + dr, cc = c + dc; white[rr]?.[cc]; rr += dr, cc += dc) cells.push([rr, cc]);
        if (cells.length >= 2) runs.push({ dir, head: [r, c], cells });
      }
    }
  }
  return runs;
}

/** Counts solutions (up to `limit`) given run sums and fixed digits. */
export function countSolutions(white, runs, givens = {}, limit = 2) {
  const cells = [];
  const idx = new Map();
  white.forEach((row, r) => row.forEach((w, c) => { if (w) { idx.set(`${r},${c}`, cells.length); cells.push([r, c]); } }));
  const cellRuns = cells.map(() => []);
  runs.forEach((run, i) => run.cells.forEach(([r, c]) => cellRuns[idx.get(`${r},${c}`)].push(i)));
  const val = cells.map(([r, c]) => givens[`${r},${c}`] || 0);
  let found = 0;

  function options(ci) {
    let m = 511;
    for (const ri of cellRuns[ci]) {
      const run = runs[ri];
      let used = 0, rest = run.sum, left = 0;
      for (const [r, c] of run.cells) {
        const v = val[idx.get(`${r},${c}`)];
        if (v) { used |= bitOf(v); rest -= v; } else left += 1;
      }
      m &= runOptions(left, rest, used);
    }
    return m;
  }
  function rec() {
    if (found >= limit) return;
    let best = -1, bestOpts = 0, bestCount = 10;
    for (let i = 0; i < cells.length; i++) {
      if (val[i]) continue;
      const o = options(i);
      const k = SUBSETS[o].size;
      if (k === 0) return;
      if (k < bestCount) { best = i; bestOpts = o; bestCount = k; }
    }
    if (best < 0) {
      found += 1;
      return;
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestOpts & bitOf(d))) continue;
      val[best] = d;
      rec();
      val[best] = 0;
      if (found >= limit) return;
    }
  }
  // givens must be consistent to start with
  rec();
  return found;
}

/** Fills the shape with digits (no repeats within a run), randomly. */
function fill(rng, white, runs) {
  const cells = [];
  white.forEach((row, r) => row.forEach((w, c) => { if (w) cells.push([r, c]); }));
  const val = {};
  const runsFor = (r, c) => runs.filter((run) => run.cells.some(([rr, cc]) => rr === r && cc === c));
  const cr = cells.map(([r, c]) => runsFor(r, c));
  function rec(i) {
    if (i === cells.length) return true;
    const [r, c] = cells[i];
    for (const d of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (cr[i].some((run) => run.cells.some(([rr, cc]) => val[`${rr},${cc}`] === d))) continue;
      val[`${r},${c}`] = d;
      if (rec(i + 1)) return true;
      delete val[`${r},${c}`];
    }
    return false;
  }
  return rec(0) ? val : null;
}

export function generate(rng, d) {
  const n = sizeFor(d);
  let best = null;
  for (let attempt = 0; attempt < 60 && !(best && attempt >= 10); attempt++) {
    const white = makeShape(rng, n);
    const runs = runsOf(white);
    const solution = fill(rng, white, runs);
    if (!solution) continue;
    for (const run of runs) run.sum = run.cells.reduce((a, [r, c]) => a + solution[`${r},${c}`], 0);
    const givens = {};
    const keys = rng.shuffle(Object.keys(solution));
    let k = 0;
    while (countSolutions(white, runs, givens) !== 1 && k < keys.length) {
      givens[keys[k]] = solution[keys[k]];
      k += 1;
    }
    // drop givens that turned out not to be needed
    for (const key of Object.keys(givens)) {
      const v = givens[key];
      delete givens[key];
      if (countSolutions(white, runs, givens) !== 1) givens[key] = v;
    }
    const ratio = Object.keys(givens).length / keys.length;
    if (!best || ratio < best.ratio) best = { white, runs, solution, givens, ratio };
  }
  if (!best) throw new Error('Could not generate Kakuro');
  // easier levels: a few extra givens
  const extra = d <= 2 ? 3 : d <= 4 ? 1 : 0;
  const free = rng.shuffle(Object.keys(best.solution).filter((key) => !(key in best.givens)));
  for (const key of free.slice(0, extra)) best.givens[key] = best.solution[key];
  const { white, runs, solution, givens } = best;
  return { white, runs, solution, givens };
}
