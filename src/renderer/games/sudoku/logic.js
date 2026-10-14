// Sudoku, generated here with a unique solution and graded by the techniques a human needs:
//   tier 1  singles (naked and hidden)
//   tier 2  locked candidates (pointing and claiming)
//   tier 3  naked and hidden pairs
//   tier 4  naked triples and X-wings
// The same logical solver powers the hint, which explains the next step instead of just
// filling a number in, so the hints teach the techniques.

export const meta = {
  id: 'sudoku',
  name: 'Sudoku',
  blurb: 'Classic 9×9 Sudoku, graded by technique. Hints explain the next logical step.',
  howTo: [
    'Fill every row, column and 3×3 box with 1–9.',
    'Click a cell (or use the arrows) and type a digit. N toggles notes (pencil marks).',
    'Hint shows where to look first, then explains the step.',
  ],
  skills: ['logic', 'attention'],
  durationRange: [240, 1800],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

// ---------------------------------------------------------------------------
// Geometry

export const ROW = (i) => Math.floor(i / 9);
export const COL = (i) => i % 9;
export const BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
export const UNITS = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];
const UNIT_NAME = (u) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);
export const PEERS = Array.from({ length: 81 }, (_, i) => [...new Set(UNITS.filter((u) => u.includes(i)).flat())].filter((j) => j !== i));
export const cellName = (i) => `R${ROW(i) + 1}C${COL(i) + 1}`;

const ALL = 0x3fe; // bits 1..9
const bit = (d) => 1 << d;
const digits = (mask) => { const out = []; for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d); return out; };
const popcount = (m) => { let n = 0; while (m) { m &= m - 1; n += 1; } return n; };

// ---------------------------------------------------------------------------
// Brute force (for uniqueness), and full-grid generation

/** Number of solutions, stopping at `limit`. */
export function countSolutions(grid, limit = 2) {
  const g = grid.slice();
  const rows = new Array(9).fill(0); const cols = new Array(9).fill(0); const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const b = bit(g[i]);
    if (rows[ROW(i)] & b || cols[COL(i)] & b || boxes[BOX(i)] & b) return 0;
    rows[ROW(i)] |= b; cols[COL(i)] |= b; boxes[BOX(i)] |= b;
  }
  let count = 0;
  (function rec() {
    let best = -1; let bestMask = 0; let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = ALL & ~(rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]);
      const n = popcount(mask);
      if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n <= 1) break; }
    }
    if (best === -1) { count += 1; return; }
    if (!bestMask) return;
    for (let d = 1; d <= 9 && count < limit; d++) {
      if (!(bestMask & bit(d))) continue;
      const b = bit(d);
      g[best] = d; rows[ROW(best)] |= b; cols[COL(best)] |= b; boxes[BOX(best)] |= b;
      rec();
      g[best] = 0; rows[ROW(best)] &= ~b; cols[COL(best)] &= ~b; boxes[BOX(best)] &= ~b;
    }
  }());
  return count;
}

/** A random complete, valid grid. */
export function fullGrid(rng) {
  const g = new Array(81).fill(0);
  const ok = (i, d) => PEERS[i].every((j) => g[j] !== d);
  (function rec(i) {
    if (i === 81) return true;
    for (const d of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!ok(i, d)) continue;
      g[i] = d;
      if (rec(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  }(0));
  return g;
}

// ---------------------------------------------------------------------------
// Logical solver: one human step at a time

export function candidates(grid) {
  return grid.map((v, i) => (v ? 0 : PEERS[i].reduce((m, j) => (grid[j] ? m & ~bit(grid[j]) : m), ALL)));
}

export const TECHNIQUES = {
  nakedSingle: { tier: 1, name: 'Naked single' },
  hiddenSingle: { tier: 1, name: 'Hidden single' },
  pointing: { tier: 2, name: 'Pointing (locked candidates)' },
  claiming: { tier: 2, name: 'Claiming (locked candidates)' },
  nakedPair: { tier: 3, name: 'Naked pair' },
  hiddenPair: { tier: 3, name: 'Hidden pair' },
  nakedTriple: { tier: 4, name: 'Naked triple' },
  xWing: { tier: 4, name: 'X-wing' },
  hiddenTriple: { tier: 4, name: 'Hidden triple' },
  yWing: { tier: 4, name: 'Y-wing' },
  swordfish: { tier: 4, name: 'Swordfish' },
};

const sees = (a, b) => a !== b && (ROW(a) === ROW(b) || COL(a) === COL(b) || BOX(a) === BOX(b));

/**
 * The next logical step, simplest technique first.
 * @returns {null | { kind: 'place', cell, digit, technique, focus: number[], text }
 *               | { kind: 'eliminate', eliminations: {cell, digit}[], technique, focus: number[], text }}
 */
export function nextStep(grid, cand) {
  // naked single
  for (let i = 0; i < 81; i++) {
    if (!grid[i] && popcount(cand[i]) === 1) {
      const d = digits(cand[i])[0];
      return { kind: 'place', cell: i, digit: d, technique: 'nakedSingle', focus: [i], text: `${cellName(i)} can only be ${d}: every other digit already appears in its row, column or box.` };
    }
  }
  // hidden single
  for (let u = 0; u < 27; u++) {
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[u].filter((i) => !grid[i] && cand[i] & bit(d));
      if (spots.length === 1 && !UNITS[u].some((i) => grid[i] === d)) {
        return { kind: 'place', cell: spots[0], digit: d, technique: 'hiddenSingle', focus: UNITS[u], text: `${UNIT_NAME(u)[0].toUpperCase() + UNIT_NAME(u).slice(1)} needs a ${d}, and ${cellName(spots[0])} is the only cell in it that can take one.` };
      }
    }
  }
  const elim = (list, technique, focus, text) => {
    const eliminations = list.filter(({ cell, digit }) => cand[cell] & bit(digit));
    return eliminations.length ? { kind: 'eliminate', eliminations, technique, focus, text } : null;
  };
  // locked candidates: pointing (box → line) and claiming (line → box)
  for (let b = 18; b < 27; b++) {
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[b].filter((i) => cand[i] & bit(d));
      if (spots.length < 2) continue;
      for (const [same, unitOf, label] of [[ROW, (i) => ROW(i), 'row'], [COL, (i) => 9 + COL(i), 'column']]) {
        if (spots.every((i) => same(i) === same(spots[0]))) {
          const line = UNITS[unitOf(spots[0])];
          const s = elim(line.filter((i) => !spots.includes(i)).map((cell) => ({ cell, digit: d })), 'pointing', spots,
            `In box ${b - 17}, the ${d} can only go in ${label} ${same(spots[0]) + 1}, so no other cell of that ${label} can be ${d}.`);
          if (s) return s;
        }
      }
    }
  }
  for (let u = 0; u < 18; u++) {
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[u].filter((i) => cand[i] & bit(d));
      if (spots.length < 2 || !spots.every((i) => BOX(i) === BOX(spots[0]))) continue;
      const box = UNITS[18 + BOX(spots[0])];
      const s = elim(box.filter((i) => !spots.includes(i)).map((cell) => ({ cell, digit: d })), 'claiming', spots,
        `In ${UNIT_NAME(u)}, the ${d} can only go inside box ${BOX(spots[0]) + 1}, so the rest of that box can't be ${d}.`);
      if (s) return s;
    }
  }
  // naked pair
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter((i) => popcount(cand[i]) === 2);
    for (let a = 0; a < cells.length; a++) {
      for (let c = a + 1; c < cells.length; c++) {
        if (cand[cells[a]] !== cand[cells[c]]) continue;
        const ds = digits(cand[cells[a]]);
        const s = elim(UNITS[u].filter((i) => i !== cells[a] && i !== cells[c]).flatMap((cell) => ds.map((digit) => ({ cell, digit }))), 'nakedPair', [cells[a], cells[c]],
          `${cellName(cells[a])} and ${cellName(cells[c])} can only be ${ds[0]} or ${ds[1]}. Between them they take both, so no other cell in ${UNIT_NAME(u)} can be ${ds[0]} or ${ds[1]}.`);
        if (s) return s;
      }
    }
  }
  // hidden pair
  for (let u = 0; u < 27; u++) {
    const where = {};
    for (let d = 1; d <= 9; d++) where[d] = UNITS[u].filter((i) => cand[i] & bit(d));
    for (let d1 = 1; d1 <= 9; d1++) {
      for (let d2 = d1 + 1; d2 <= 9; d2++) {
        const [p, q] = [where[d1], where[d2]];
        if (p.length !== 2 || q.length !== 2 || p[0] !== q[0] || p[1] !== q[1]) continue;
        const keep = bit(d1) | bit(d2);
        const s = elim(p.flatMap((cell) => digits(cand[cell] & ~keep).map((digit) => ({ cell, digit }))), 'hiddenPair', p,
          `In ${UNIT_NAME(u)}, ${d1} and ${d2} can only go in ${cellName(p[0])} and ${cellName(p[1])}. So those two cells are ${d1} and ${d2}, and their other notes can go.`);
        if (s) return s;
      }
    }
  }
  // naked triple
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter((i) => { const n = popcount(cand[i]); return n >= 2 && n <= 3; });
    for (let a = 0; a < cells.length; a++) for (let b2 = a + 1; b2 < cells.length; b2++) for (let c = b2 + 1; c < cells.length; c++) {
      const trio = [cells[a], cells[b2], cells[c]];
      const union = cand[trio[0]] | cand[trio[1]] | cand[trio[2]];
      if (popcount(union) !== 3) continue;
      const ds = digits(union);
      const s = elim(UNITS[u].filter((i) => !trio.includes(i)).flatMap((cell) => ds.map((digit) => ({ cell, digit }))), 'nakedTriple', trio,
        `${trio.map(cellName).join(', ')} only use ${ds.join(', ')} between them, so those three digits are used up in ${UNIT_NAME(u)}.`);
      if (s) return s;
    }
  }
  // X-wing (rows → columns, then columns → rows)
  for (const [lines, cross, label, crossLabel] of [[[0, 9], 9, 'rows', 'columns'], [[9, 18], 0, 'columns', 'rows']]) {
    for (let d = 1; d <= 9; d++) {
      const twos = [];
      for (let u = lines[0]; u < lines[1]; u++) {
        const spots = UNITS[u].filter((i) => cand[i] & bit(d));
        if (spots.length === 2) twos.push({ u, pos: spots.map((i) => (label === 'rows' ? COL(i) : ROW(i))), spots });
      }
      for (let a = 0; a < twos.length; a++) {
        for (let c = a + 1; c < twos.length; c++) {
          if (twos[a].pos[0] !== twos[c].pos[0] || twos[a].pos[1] !== twos[c].pos[1]) continue;
          const corners = [...twos[a].spots, ...twos[c].spots];
          const crossUnits = twos[a].pos.map((p) => UNITS[cross + p]);
          const s = elim(crossUnits.flat().filter((i) => !corners.includes(i)).map((cell) => ({ cell, digit: d })), 'xWing', corners,
            `X-wing on ${d}: in two ${label} the ${d} can only sit in the same two ${crossLabel}. Whichever way it goes, those ${crossLabel} get their ${d} from these four corners, so nowhere else in them can be ${d}.`);
          if (s) return s;
        }
      }
    }
  }
  // hidden triple
  for (let u = 0; u < 27; u++) {
    const where = {};
    for (let d = 1; d <= 9; d++) where[d] = UNITS[u].filter((i) => cand[i] & bit(d));
    const ds = Object.keys(where).map(Number).filter((d) => where[d].length >= 2 && where[d].length <= 3);
    for (let a = 0; a < ds.length; a++) for (let b2 = a + 1; b2 < ds.length; b2++) for (let c = b2 + 1; c < ds.length; c++) {
      const trio = [ds[a], ds[b2], ds[c]];
      const cells = [...new Set(trio.flatMap((d) => where[d]))];
      if (cells.length !== 3) continue;
      const keep = trio.reduce((m, d) => m | bit(d), 0);
      const s = elim(cells.flatMap((cell) => digits(cand[cell] & ~keep).map((digit) => ({ cell, digit }))), 'hiddenTriple', cells,
        `In ${UNIT_NAME(u)}, ${trio.join(', ')} can only go in ${cells.map(cellName).join(', ')}. Those three cells must hold those three digits, so their other notes can go.`);
      if (s) return s;
    }
  }
  // Y-wing: a pivot {A,B} sees pincers {A,C} and {B,C}; whatever the pivot is, one pincer is C
  for (let p = 0; p < 81; p++) {
    if (popcount(cand[p]) !== 2) continue;
    const [A, B] = digits(cand[p]);
    const wings = PEERS[p].filter((i) => popcount(cand[i]) === 2 && popcount(cand[i] & cand[p]) === 1);
    for (const x of wings) {
      for (const y of wings) {
        if (x >= y) continue;
        const shared = cand[x] & cand[y] & ~cand[p];
        if (popcount(shared) !== 1 || (cand[x] & cand[p]) === (cand[y] & cand[p])) continue;
        const C = digits(shared)[0];
        const s = elim(PEERS[x].filter((i) => i !== p && sees(i, y)).map((cell) => ({ cell, digit: C })), 'yWing', [p, x, y],
          `Y-wing: ${cellName(p)} is ${A} or ${B}. Either way, one of ${cellName(x)} and ${cellName(y)} becomes ${C}, so any cell that sees both of them can't be ${C}.`);
        if (s) return s;
      }
    }
  }
  // Swordfish: three lines where a digit fits only within the same three cross-lines
  for (const [lines, cross, label, crossLabel] of [[[0, 9], 9, 'rows', 'columns'], [[9, 18], 0, 'columns', 'rows']]) {
    for (let d = 1; d <= 9; d++) {
      const opts = [];
      for (let u = lines[0]; u < lines[1]; u++) {
        const spots = UNITS[u].filter((i) => cand[i] & bit(d));
        if (spots.length >= 2 && spots.length <= 3) opts.push({ spots, pos: spots.map((i) => (label === 'rows' ? COL(i) : ROW(i))) });
      }
      for (let a = 0; a < opts.length; a++) for (let b2 = a + 1; b2 < opts.length; b2++) for (let c = b2 + 1; c < opts.length; c++) {
        const pos = [...new Set([...opts[a].pos, ...opts[b2].pos, ...opts[c].pos])];
        if (pos.length !== 3) continue;
        const corners = [...opts[a].spots, ...opts[b2].spots, ...opts[c].spots];
        const s = elim(pos.flatMap((q) => UNITS[cross + q]).filter((i) => !corners.includes(i)).map((cell) => ({ cell, digit: d })), 'swordfish', corners,
          `Swordfish on ${d}: in three ${label} the ${d} fits only within the same three ${crossLabel}, so those ${crossLabel} get their ${d} from these cells and nowhere else.`);
        if (s) return s;
      }
    }
  }
  return null;
}

/** Applies a step to grid + candidates (in place). */
export function applyStep(grid, cand, step) {
  if (step.kind === 'place') {
    grid[step.cell] = step.digit;
    cand[step.cell] = 0;
    for (const j of PEERS[step.cell]) cand[j] &= ~bit(step.digit);
  } else {
    for (const { cell, digit } of step.eliminations) cand[cell] &= ~bit(digit);
  }
}

/** Solves by logic alone. tier = hardest technique needed (5 = logic got stuck). */
export function rate(puzzle) {
  const grid = puzzle.slice();
  const cand = candidates(grid);
  let tier = 0;
  const used = new Set();
  for (let guard = 0; guard < 2000; guard++) {
    if (grid.every(Boolean)) return { tier: Math.max(1, tier), used: [...used], solved: true };
    const s = nextStep(grid, cand);
    if (!s) return { tier: 5, used: [...used], solved: false };
    tier = Math.max(tier, TECHNIQUES[s.technique].tier);
    used.add(s.technique);
    applyStep(grid, cand, s);
  }
  return { tier: 5, used: [...used], solved: false };
}

// ---------------------------------------------------------------------------
// Puzzles for a level

/** Target tier and how many givens to keep (more givens = easier to scan). */
export function target(d) {
  return [
    { tier: 1, givens: 46 }, { tier: 1, givens: 40 }, { tier: 1, givens: 35 }, { tier: 1, givens: 30 },
    { tier: 2, givens: 0 }, { tier: 2, givens: 0 }, { tier: 3, givens: 0 }, { tier: 3, givens: 0 },
    { tier: 4, givens: 0 }, { tier: 4, givens: 0 },
  ][Math.min(10, Math.max(1, d)) - 1];
}

/**
 * A puzzle with a unique solution whose hardest needed technique is the level's tier (or the
 * closest found within the attempts).
 */
export function generate(rng, d, attempts) {
  const want = target(d);
  attempts ??= want.tier >= 4 ? 200 : 40; // tier-4 puzzles are about 1 in 17
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const solution = fullGrid(rng);
    const puzzle = solution.slice();
    let givens = 81;
    for (const i of rng.shuffle(Array.from({ length: 81 }, (_, k) => k))) {
      if (givens <= want.givens) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[i] = keep;
      else givens -= 1;
    }
    const r = rate(puzzle);
    if (r.tier === want.tier) return { puzzle, solution, tier: r.tier, used: r.used, givens };
    const gap = r.tier > want.tier ? (r.tier - want.tier) * 2 : want.tier - r.tier; // prefer too easy over unsolvable
    if (r.tier < 5 && (!best || gap < best.gap)) best = { puzzle, solution, tier: r.tier, used: r.used, givens, gap };
  }
  const { gap, ...out } = best;
  return out;
}

export const parSeconds = (d) => [240, 300, 360, 420, 540, 600, 780, 900, 1080, 1200][Math.min(10, Math.max(1, d)) - 1];

export function scoreRound({ d, timeMs, mistakes, hints, solved }) {
  if (!solved) return { score: 0, accuracy: 0, performance: 0 };
  const speed = Math.min(1, parSeconds(d) / Math.max(1, timeMs / 1000));
  const accuracy = 1 / (1 + mistakes * 0.25);
  const performance = Math.max(0, Math.min(1, (0.55 + 0.45 * speed) * accuracy - hints * 0.07));
  return { score: Math.round(1000 * performance * (1 + d / 5)), accuracy, performance };
}
