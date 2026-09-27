// Nim: take any number of stones from ONE heap; whoever takes the last stone wins.
// There is a perfect strategy (Bouton, 1901): write the heap sizes in binary and XOR them. If
// the "nim-sum" is 0 on your turn, you will lose against perfect play; otherwise there is always
// a move that makes it 0. The round is three games; the hints get stronger each game, so you can
// discover the rule yourself.
export const meta = {
  id: 'nim',
  name: 'Nim',
  blurb: 'Take stones from one heap at a time; take the last stone to win. Can you find the secret?',
  howTo: ['Click a stone: you take it and every stone to its right in that heap.', 'Last stone wins.', 'Three games per round, with a bigger hint each time.'],
  skills: ['strategy', 'math', 'logic'],
  durationRange: [90, 360],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const GAMES = 3;
export const nimSum = (heaps) => heaps.reduce((x, h) => x ^ h, 0);

/** Heaps for a level: one heap with a take-1-to-3 rule at level 1–2, then 3, 4 and 5 heaps. */
export function setup(rng, d) {
  if (d <= 2) {
    let n;
    do n = rng.int(10, 17); while (n % 4 === 0); // a winning start for the player
    return { heaps: [n], maxTake: 3 };
  }
  const n = d <= 5 ? 3 : d <= 8 ? 4 : 5;
  const top = d <= 5 ? 7 : d <= 8 ? 9 : 12;
  for (;;) {
    const heaps = Array.from({ length: n }, () => rng.int(1, top));
    if (nimSum(heaps) !== 0) return { heaps, maxTake: Infinity }; // the player (moving first) can win
  }
}

/** Is the position lost for the player about to move (against perfect play)? */
export function losing({ heaps, maxTake }) {
  if (maxTake !== Infinity) return heaps[0] % (maxTake + 1) === 0;
  return nimSum(heaps) === 0;
}

/** A winning move if there is one: { heap, take }, else null. */
export function winningMove({ heaps, maxTake }) {
  if (maxTake !== Infinity) {
    const take = heaps[0] % (maxTake + 1);
    return take ? { heap: 0, take } : null;
  }
  const x = nimSum(heaps);
  if (!x) return null;
  for (let i = 0; i < heaps.length; i++) {
    const target = heaps[i] ^ x;
    if (target < heaps[i]) return { heap: i, take: heaps[i] - target };
  }
  return null;
}

/** How often the computer skips the perfect move, by level. */
export const slipFor = (d) => [0.5, 0.25, 0.5, 0.35, 0.2, 0.3, 0.15, 0.05, 0.1, 0][Math.min(9, d - 1)];

export function computerMove(state, d, rng) {
  const win = winningMove(state);
  if (win && !rng.chance(slipFor(d))) return win;
  const options = [];
  state.heaps.forEach((h, i) => { for (let t = 1; t <= Math.min(h, state.maxTake); t++) options.push({ heap: i, take: t }); });
  // a slip still avoids taking everything left in a hurry: prefer small takes
  return rng.pick(options.filter((o) => o.take <= 2).length ? options.filter((o) => o.take <= 2) : options);
}

export const HINTS = [
  null,
  'Hint: some positions are lost no matter what you do, if your opponent plays perfectly. Try to hand your opponent one of those.',
  'Big hint: write each heap in binary (4 + 2 + 1). Try to leave an even number of 1s in every column.',
];

export const EXPLAIN_SINGLE = 'The secret: leave a multiple of 4 stones. Whatever your opponent takes (1–3), you take the rest of 4, and you get the last stone.';
export const EXPLAIN_NIM = 'The secret (Charles Bouton, 1901): XOR the heap sizes in binary (the “nim-sum”). If it is 0 on your opponent’s turn, every move they make breaks it, and you can always restore it. Keep the nim-sum at 0 after your move and you take the last stone.';
