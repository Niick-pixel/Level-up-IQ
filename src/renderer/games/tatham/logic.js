// Simon Tatham's Portable Puzzle Collection (MIT licence): 24 logic puzzles, built to WebAssembly
// by .github/workflows/build-tatham.yml and hosted in src/renderer/tatham/host.html.
// Each puzzle is seeded with Mind Gym's seed, so seed codes replay the exact same grid.

const P = (id, name, skills, blurb, extra = {}) => ({
  meta: {
    id: `tatham-${id}`,
    name,
    blurb,
    howTo: ['Click (and right-click) on the grid; the keyboard works too.', 'Undo is free. “Show solution” ends the round.', `Rules in full: the ${name.split(' (')[0]} page of Simon Tatham's manual.`],
    skills,
    durationRange: extra.duration || [120, 900],
    difficultyRange: [1, 10],
    offline: true,
    lang: [],
    credit: 'Simon Tatham\'s Portable Puzzle Collection',
  },
  puzzle: id,
});

export const TATHAM = [
  P('solo', 'Solo (Sudoku)', ['logic'], 'Fill the grid so each row, column and box holds every number exactly once.'),
  P('keen', 'Keen (KenKen)', ['logic', 'math'], 'Each number once per row and column; each outlined cage combines to its target with the given operation.'),
  P('towers', 'Towers', ['logic', 'spatial'], 'Place towers of heights 1 to N, one of each per row and column. Edge clues count the towers visible from that side.'),
  P('unequal', 'Unequal (Futoshiki)', ['logic'], 'Each number once per row and column, obeying the < and > signs between squares.'),
  P('pattern', 'Pattern (Nonogram)', ['logic', 'spatial'], 'Shade squares so each row and column shows the runs of shaded squares listed in its clue, in order.'),
  P('loopy', 'Loopy (Slitherlink)', ['logic', 'spatial'], 'Draw one closed loop along the grid lines. Each number says how many of its square\'s edges the loop uses.'),
  P('lightup', 'Light Up (Akari)', ['logic'], 'Place lights so every white square is lit. Lights shine along rows and columns, never on each other; numbers count adjacent lights.'),
  P('bridges', 'Bridges (Hashi)', ['logic', 'spatial'], 'Link every island with straight bridges (at most two per pair, no crossings) so each island has its number of bridges and all connect.'),
  P('net', 'Net', ['spatial', 'logic'], 'Rotate the tiles until everything joins into one network, with no loops and no loose ends.'),
  P('tents', 'Tents', ['logic'], 'Put one tent beside each tree. Tents never touch each other, even diagonally; the numbers count tents per row and column.'),
  P('range', 'Range (Kurodoko)', ['logic'], 'Shade squares so each number equals how many unshaded squares it can see in straight lines, itself included. Shaded squares never touch sideways; the rest stays connected.'),
  P('galaxies', 'Galaxies (Tentai Show)', ['spatial', 'logic'], 'Split the grid into regions, each rotationally symmetric around the dot it contains.'),
  P('magnets', 'Magnets', ['logic'], 'Fill the dominoes with magnets or blanks so the + and − counts per row and column match, and like poles never touch sideways.'),
  P('signpost', 'Signpost', ['logic', 'spatial'], 'Link the squares into one path from 1 to N; every square\'s arrow points toward the next square in the path.'),
  P('dominosa', 'Dominosa', ['logic'], 'Find the full set of dominoes in the grid of numbers: every pair appears exactly once.'),
  P('filling', 'Filling (Fillomino)', ['logic', 'spatial'], 'Fill in numbers so that every connected region of equal numbers has exactly that many squares.'),
  P('palisade', 'Palisade', ['logic', 'spatial'], 'Divide the grid into regions of the given size. Each number says how many of its square\'s edges are walls.'),
  P('undead', 'Undead', ['logic'], 'Place ghosts, vampires and zombies. Mirrors bounce sight lines; ghosts show only in mirrors, vampires only directly. Edge numbers count what is seen.'),
  P('mines', 'Mines (no guessing)', ['logic'], 'Uncover every safe square; numbers count mines among the eight neighbours. Every board can be solved without guessing.', { duration: [60, 600] }),
  P('pearl', 'Pearl (Masyu)', ['logic', 'spatial'], 'Draw one loop through the squares. It turns on black pearls and runs straight through their neighbours; it goes straight through white pearls and turns next to them.'),
  P('tracks', 'Tracks', ['logic', 'spatial'], 'Lay one railway line from A to B. Edge numbers count the track pieces in each row and column.'),
  P('unruly', 'Unruly', ['logic'], 'Colour every square black or white: equal numbers of each in every row and column, and never three of a colour in a row.'),
  P('map', 'Map (four colours)', ['logic', 'spatial'], 'Colour the map with four colours so that no two neighbouring regions share a colour.'),
  P('mosaic', 'Mosaic', ['logic'], 'Shade squares so each number counts the shaded squares in its 3×3 neighbourhood, itself included.'),
];

/** Presets that take too long to generate on a modest PC are left out of the level ladder. */
export const MAX_GENERATE_MS = 6000;

// Where a puzzle's own preset menu isn't ordered from easy to hard, the ladder lists the presets
// to use, easiest first. Other puzzles use their menu order (which runs small/easy to large/hard).
export const LADDERS = {
  solo: ['3x3 Trivial', '3x3 Basic', '3x3 Intermediate', '3x3 Advanced', '3x3 Extreme', '3x3 Unreasonable'],
  keen: ['4x4 Easy', '5x5 Easy', '6x6 Easy', '6x6 Normal', '6x6 Hard', '6x6 Extreme', '6x6 Unreasonable'],
  unequal: ['Unequal: 4x4 Easy', 'Unequal: 5x5 Easy', 'Unequal: 5x5 Tricky', 'Unequal: 6x6 Tricky', 'Unequal: 5x5 Extreme', 'Unequal: 6x6 Extreme', 'Unequal: 7x7 Extreme'],
  loopy: ['7x7 Squares - Easy', '10x10 Squares - Easy', '7x7 Squares - Normal', '10x10 Squares - Normal', '10x10 Honeycomb - Hard', '7x7 Squares - Hard', '10x10 Squares - Hard'],
  mines: ['9x9, 10 mines, Squares', '10x10, 20% mines, Honeycomb', '16x16, 40 mines, Squares', '9x9, 25% mines, Squares wrapping', '16x16, 99 mines, Squares', '30x16, 99 mines, Squares'],
};

/**
 * Level 1–10 → one of the puzzle's presets (recorded at build time by scripts/tatham-presets.cjs).
 * @param {{ name: string, params: string, generateMs: number }[]} presets
 */
export function presetForLevel(presets, level, ladder = null) {
  if (ladder) {
    const ordered = ladder.map((n) => presets.find((p) => p.name === n)).filter(Boolean);
    if (ordered.length) presets = ordered;
  }
  const usable = presets.filter((p) => p.generateMs <= MAX_GENERATE_MS && p.params);
  const list = usable.length ? usable : presets;
  if (!list.length) return null;
  const i = Math.min(list.length - 1, Math.max(0, Math.round(((level - 1) / 9) * (list.length - 1))));
  return list[i];
}

/** Seeds may only contain characters that are safe in a URL hash. */
export const safeSeed = (seed) => String(seed).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'seed';

/** Par time in seconds for a level: used to turn solve time into a performance score. */
export const parSeconds = (level) => 90 + level * 60;

export function scoreRound({ outcome, timeMs, difficulty }) {
  if (outcome !== 'solved') return { score: 0, accuracy: 0, performance: outcome === 'lost' ? 0.15 : 0 };
  const speed = Math.min(1, parSeconds(difficulty) / Math.max(1, timeMs / 1000));
  const performance = 0.55 + 0.45 * speed;
  return { score: Math.round(1000 * performance * (1 + difficulty / 5)), accuracy: 1, performance };
}
