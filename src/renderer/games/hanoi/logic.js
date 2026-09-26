// Tower of Hanoi: move the stack to the right peg, one disc at a time, never a larger disc on a smaller.

export const meta = {
  id: 'hanoi',
  name: 'Tower of Hanoi',
  blurb: 'Move the whole stack to the right-hand peg, one disc at a time, never putting a bigger disc on a smaller one.',
  howTo: ['Click a peg (or press 1, 2, 3) to pick up its top disc, then another to drop it.', 'The fewest possible moves is 2ⁿ − 1.'],
  skills: ['logic', 'spatial'],
  durationRange: [30, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const discsFor = (d) => Math.min(8, 3 + Math.floor((d - 1) / 2));
export const optimalMoves = (n) => 2 ** n - 1;

/** Applies a move if legal; returns the new pegs or null. */
export function move(pegs, from, to) {
  if (from === to || !pegs[from].length) return null;
  const disc = pegs[from][pegs[from].length - 1];
  const top = pegs[to][pegs[to].length - 1];
  if (top !== undefined && top < disc) return null;
  const next = pegs.map((p) => p.slice());
  next[to].push(next[from].pop());
  return next;
}

export const solved = (pegs, n) => pegs[2].length === n;
