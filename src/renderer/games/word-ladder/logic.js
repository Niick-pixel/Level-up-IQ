// Word ladder: turn one word into another, changing one letter at a time; every step must be a
// real word. Puzzles are generated from common words, so a common-word path always exists.

export const meta = {
  id: 'word-ladder',
  name: 'Word ladder',
  blurb: 'Change one letter at a time to get from the first word to the last.',
  howTo: ['Type the next word and press Enter.', 'Backspace on an empty box undoes a step.', 'Hints unlock after the thinking timer.'],
  skills: ['language', 'logic'],
  durationRange: [45, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const wordLength = (d) => (d <= 3 ? 3 : 4);
export const ladderSteps = (d) => [3, 3, 4, 4, 4, 5, 5, 6, 6, 7][d - 1];

export function oneLetterApart(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
  return diff === 1;
}

/** Neighbour lookup via wildcard buckets ("c_t" → cat, cot, cut). */
export function buildGraph(words) {
  const buckets = new Map();
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const key = w.slice(0, i) + '_' + w.slice(i + 1);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(w);
    }
  }
  const neighbours = (w) => {
    const out = new Set();
    for (let i = 0; i < w.length; i++) {
      for (const x of buckets.get(w.slice(0, i) + '_' + w.slice(i + 1)) || []) if (x !== w) out.add(x);
    }
    return [...out];
  };
  return { neighbours, has: (w) => words.has ? words.has(w) : words.includes(w) };
}

/** Breadth-first search. Returns a shortest path [from, …, to] or null. */
export function shortestPath(graph, from, to) {
  if (from === to) return [from];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const w = queue.shift();
    for (const n of graph.neighbours(w)) {
      if (prev.has(n)) continue;
      prev.set(n, w);
      if (n === to) {
        const path = [to];
        for (let p = w; p !== null; p = prev.get(p)) path.unshift(p);
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

/** All words at exactly `steps` from `from` (by shortest path), with one path each. */
function atDistance(graph, from, steps) {
  const prev = new Map([[from, null]]);
  let frontier = [from];
  for (let d = 0; d < steps && frontier.length; d++) {
    const next = [];
    for (const w of frontier) {
      for (const n of graph.neighbours(w)) {
        if (prev.has(n)) continue;
        prev.set(n, w);
        next.push(n);
      }
    }
    frontier = next;
  }
  return frontier.map((end) => {
    const path = [end];
    for (let p = prev.get(end); p !== null; p = prev.get(p)) path.unshift(p);
    return path;
  });
}

/**
 * @param {{ common3: string[], common4: string[] }} pack
 * @returns {{ start: string, end: string, steps: number, solution: string[] }}
 */
export function genLadder(rng, difficulty, pack, cache = {}) {
  const len = wordLength(difficulty);
  const words = pack[`common${len}`];
  const graph = cache[len] || (cache[len] = buildGraph(new Set(words)));
  let steps = ladderSteps(difficulty);
  for (; steps >= 2; steps--) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const start = rng.pick(words);
      const paths = atDistance(graph, start, steps);
      if (paths.length) {
        const solution = rng.pick(paths);
        return { start, end: solution[solution.length - 1], steps, solution };
      }
    }
  }
  throw new Error('Could not generate a word ladder');
}

export function scoreRound({ steps, used, hints, gaveUp, difficulty }) {
  if (gaveUp) return { score: 0, accuracy: 0, performance: 0 };
  const accuracy = Math.min(1, steps / Math.max(steps, used));
  const performance = Math.max(0, accuracy - hints * 0.25);
  return { score: Math.round(steps * 25 * difficulty * performance), accuracy, performance };
}
