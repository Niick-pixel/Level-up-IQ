// Logic grid ("zebra") puzzles with exactly one solution.
//
// A hidden solution assigns each value of each category to a house. Clues are drawn from true
// facts about it and added until a constraint-propagation solver finds exactly one solution;
// then clues that aren't needed are dropped, so every clue matters.

export const meta = {
  id: 'zebra',
  name: 'Logic grid (zebra)',
  blurb: 'Houses in a row, and clues about who lives where. Deduce the whole street, then answer the question.',
  howTo: ['Use the grid to mark ✓ and ✗ while you reason (click a cell to cycle).', 'Answer the question when you know.'],
  skills: ['logic'],
  durationRange: [120, 900],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const CATEGORIES = [
  { id: 'colour', noun: 'colour', values: ['red', 'green', 'white', 'yellow', 'blue'],
    the: (v) => `the ${v} house`, loc: (v) => `the ${v} house` },
  { id: 'nation', noun: 'nationality', values: ['Brazilian', 'Japanese', 'Kenyan', 'Norwegian', 'Mexican'],
    the: (v) => `the ${v}`, loc: (v) => `the ${v}'s house` },
  { id: 'pet', noun: 'pet', values: ['dog', 'cat', 'parrot', 'fish', 'horse'],
    the: (v) => `the ${v} owner`, loc: (v) => `the ${v} owner's house` },
  { id: 'drink', noun: 'drink', values: ['tea', 'coffee', 'milk', 'juice', 'water'],
    the: (v) => `the ${v} drinker`, loc: (v) => `the ${v} drinker's house` },
  { id: 'hobby', noun: 'hobby', values: ['chess', 'painting', 'running', 'gardening', 'piano'],
    the: (v) => ({ chess: 'the chess player', painting: 'the painter', running: 'the runner', gardening: 'the gardener', piano: 'the pianist' })[v],
    loc: (v) => ({ chess: "the chess player's house", painting: "the painter's house", running: "the runner's house", gardening: "the gardener's house", piano: "the pianist's house" })[v] },
];

export const levelShape = (d) => (d <= 3 ? { n: 3, k: 3 } : d <= 6 ? { n: 4, k: 4 } : d <= 9 ? { n: 5, k: 4 } : { n: 5, k: 5 });

const ORD = ['first', 'second', 'third', 'fourth', 'fifth'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
const lowBit = (x) => 31 - Math.clz32(x & -x);

/**
 * Solver. Values are numbered v = cat * n + index. dom[v] is a bitmask of possible houses.
 * @returns number of solutions found, stopping at `limit`
 */
export function countSolutions(n, k, clues, limit = 2) {
  const full = (1 << n) - 1;
  const dom = new Array(n * k).fill(full);
  return search(dom);

  function propagate(d) {
    let changed = true;
    while (changed) {
      changed = false;
      const set = (v, mask) => {
        const m = d[v] & mask;
        if (m !== d[v]) { d[v] = m; changed = true; }
        return m !== 0;
      };
      for (const c of clues) {
        const [a, b] = [c.a, c.b];
        switch (c.type) {
          case 'pos': if (!set(a, 1 << c.house)) return false; break;
          case 'same': if (!set(a, d[b]) || !set(b, d[a])) return false; break;
          case 'not':
            if (popcount(d[a]) === 1 && !set(b, ~d[a] & full)) return false;
            if (popcount(d[b]) === 1 && !set(a, ~d[b] & full)) return false;
            break;
          case 'left': // a directly left of b
            if (!set(a, d[b] >> 1) || !set(b, (d[a] << 1) & full)) return false;
            break;
          case 'next':
            if (!set(a, ((d[b] << 1) | (d[b] >> 1)) & full) || !set(b, ((d[a] << 1) | (d[a] >> 1)) & full)) return false;
            break;
          case 'before': { // a somewhere left of b
            const maxB = 31 - Math.clz32(d[b]);
            const minA = lowBit(d[a]);
            if (!set(a, (1 << maxB) - 1) || !set(b, full & ~((2 << minA) - 1))) return false;
            break;
          }
          default: break;
        }
      }
      // each house holds exactly one value per category
      for (let cat = 0; cat < k; cat++) {
        for (let i = 0; i < n; i++) {
          const v = cat * n + i;
          if (popcount(d[v]) === 1) {
            for (let j = 0; j < n; j++) if (j !== i && !set(cat * n + j, ~d[v] & full)) return false;
          }
        }
        for (let hs = 0; hs < n; hs++) {
          const bit = 1 << hs;
          const holders = [];
          for (let i = 0; i < n; i++) if (d[cat * n + i] & bit) holders.push(cat * n + i);
          if (!holders.length) return false;
          if (holders.length === 1 && !set(holders[0], bit)) return false;
        }
      }
    }
    return true;
  }

  function search(d) {
    if (!propagate(d)) return 0;
    let best = -1;
    for (let v = 0; v < d.length; v++) if (popcount(d[v]) > 1 && (best < 0 || popcount(d[v]) < popcount(d[best]))) best = v;
    if (best < 0) return 1;
    let found = 0;
    for (let m = d[best]; m && found < limit; m &= m - 1) {
      const next = d.slice();
      next[best] = m & -m;
      found += search(next);
    }
    return found;
  }
}

/** Every true clue about a solution (house[v] = house index of value v). */
function allClues(n, k, house, rng, level) {
  const out = [];
  const values = n * k;
  for (let a = 0; a < values; a++) {
    if (level <= 4 || rng.chance(0.4)) out.push({ type: 'pos', a, house: house[a] });
    for (let b = 0; b < values; b++) {
      if (Math.floor(a / n) === Math.floor(b / n)) continue;
      if (a < b && house[a] === house[b]) out.push({ type: 'same', a, b });
      if (a < b && house[a] !== house[b]) out.push({ type: 'not', a, b });
      if (house[b] === house[a] + 1) out.push({ type: 'left', a, b });
      if (a < b && Math.abs(house[a] - house[b]) === 1) out.push({ type: 'next', a, b });
      if (house[a] < house[b] && house[b] - house[a] > 1) out.push({ type: 'before', a, b });
    }
  }
  return out;
}

/**
 * @returns {{ n, k, cats: object[], solution: number[][], clues: object[], question: object }}
 *   solution[cat][house] = value index; question = { cat, value, askCat, answer }
 */
export function generate(rng, level) {
  const { n, k } = levelShape(level);
  for (let attempt = 0; attempt < 40; attempt++) {
    const cats = rng.shuffle(CATEGORIES).slice(0, k).map((c) => ({ ...c, values: rng.shuffle(c.values).slice(0, n) }));
    const solution = cats.map(() => rng.shuffle([...Array(n).keys()])); // solution[cat][house] = value index
    const house = new Array(n * k);
    solution.forEach((perm, cat) => perm.forEach((vi, hs) => { house[cat * n + vi] = hs; }));

    // weight clue types: easier levels lean on direct facts, harder ones on relative positions
    const weight = (c) => ({ pos: level <= 3 ? 3 : 1, same: 3, not: level <= 5 ? 1 : 2, left: 2, next: level >= 5 ? 2 : 1, before: level >= 6 ? 2 : 0.5 })[c.type];
    // weighted random order (Efraimidis–Spirakis keys)
    const pool = allClues(n, k, house, rng, level)
      .map((c) => ({ c, key: weight(c) ? rng.next() ** (1 / weight(c)) : -1 }))
      .sort((x, y) => y.key - x.key)
      .map((x) => x.c);
    const clues = [];
    for (const c of pool) {
      clues.push(c);
      if (clues.length >= 3 && countSolutions(n, k, clues) === 1) break;
    }
    if (countSolutions(n, k, clues) !== 1) continue;
    // drop clues that aren't needed (try the easiest kinds first)
    for (let i = clues.length - 1; i >= 0; i--) {
      const without = clues.slice(0, i).concat(clues.slice(i + 1));
      if (countSolutions(n, k, without) === 1) clues.splice(i, 1);
    }
    // the question: which value of askCat goes with a value of cat
    const cat = rng.int(0, k - 1);
    let askCat = rng.int(0, k - 2);
    if (askCat >= cat) askCat += 1;
    const value = rng.int(0, n - 1);
    const hs = house[cat * n + value];
    const answer = solution[askCat][hs];
    return { n, k, cats, solution, clues: rng.shuffle(clues), question: { cat, value, askCat, answer } };
  }
  throw new Error('Could not generate a logic grid');
}

/** Clue in plain English. */
export function clueText(p, c) {
  const name = (v) => {
    const cat = p.cats[Math.floor(v / p.n)];
    return { cat, val: cat.values[v % p.n] };
  };
  const A = name(c.a);
  const B = c.b !== undefined ? name(c.b) : null;
  const who = (x) => x.cat.the(x.val);
  const loc = (x) => x.cat.loc(x.val);
  switch (c.type) {
    case 'pos': return `${cap(loc(A))} is the ${ORD[c.house]} house from the left.`;
    case 'same':
      if (B.cat.id === 'colour') return `${cap(who(A))} lives in ${who(B)}.`;
      if (A.cat.id === 'colour') return `${cap(who(B))} lives in ${who(A)}.`;
      return `${cap(who(A))} is ${who(B)}.`;
    case 'not':
      if (B.cat.id === 'colour') return `${cap(who(A))} does not live in ${who(B)}.`;
      if (A.cat.id === 'colour') return `${cap(who(B))} does not live in ${who(A)}.`;
      return `${cap(who(A))} is not ${who(B)}.`;
    case 'left': return `${cap(loc(A))} is directly to the left of ${loc(B)}.`;
    case 'next': return `${cap(loc(A))} is next to ${loc(B)}.`;
    case 'before': return `${cap(loc(A))} is somewhere to the left of ${loc(B)}.`;
    default: return '';
  }
}

export function questionText(p) {
  const { cat, value, askCat } = p.question;
  const c = p.cats[cat];
  return `Which ${p.cats[askCat].noun} goes with ${c.the(c.values[value])}?`;
}
