// Mini crossword built from the keyword bank: the answers are one-word topics and the clues
// come from each topic's aliases, field and tags. A new grid every time.
export const meta = {
  id: 'crossword',
  name: 'Mini crossword',
  blurb: 'A small crossword whose answers are topics from the keyword bank. Every grid is new.',
  howTo: ['Click a cell and type; Tab or a second click switches between across and down.', 'Check when you think it\'s done. Hints unlock after the thinking timer.'],
  skills: ['language', 'knowledge'],
  durationRange: [180, 900],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

const SIZE = 13;

export function clueFor(k) {
  const letters = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const term = letters(k.term);
  const alias = k.aliases.find((a) => !letters(a).includes(term) && !term.includes(letters(a)) && a.length > 3);
  const tags = k.tags.filter((t) => !letters(t).includes(term));
  if (alias) return `${k.domainLabel}: also called “${alias}”`;
  return `${k.domainLabel}${tags.length ? `: ${tags.join(', ')}` : ''}`;
}

/** Places words on a grid; returns { grid, entries: [{ word, r, c, dir, clue }] } or null. */
function build(rng, candidates, target) {
  const grid = [...Array(SIZE)].map(() => Array(SIZE).fill(null));
  const entries = [];
  const at = (r, c) => (r >= 0 && c >= 0 && r < SIZE && c < SIZE ? grid[r][c] : null);
  const fits = (w, r, c, dir) => {
    const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0];
    if (r < 0 || c < 0 || r + dr * (w.length - 1) >= SIZE || c + dc * (w.length - 1) >= SIZE) return -1;
    if (at(r - dr, c - dc) || at(r + dr * w.length, c + dc * w.length)) return -1;
    let crossings = 0;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const cur = grid[rr][cc];
      if (cur) {
        if (cur !== w[i]) return -1;
        crossings += 1;
      } else if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) {
        return -1; // would touch a parallel word side by side
      }
    }
    return crossings;
  };
  const place = (w, r, c, dir, k) => {
    const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0];
    for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
    entries.push({ word: w, r, c, dir, clue: clueFor(k), id: k.id });
  };
  const pool = rng.shuffle(candidates);
  const first = pool.shift();
  place(first.word, Math.floor(SIZE / 2), Math.floor((SIZE - first.word.length) / 2), 'across', first.k);
  for (const cand of pool) {
    if (entries.length >= target) break;
    if (entries.some((e) => e.word === cand.word)) continue;
    const spots = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        for (const dir of ['across', 'down']) {
          if (fits(cand.word, r, c, dir) > 0) spots.push([r, c, dir]);
        }
      }
    }
    if (spots.length) {
      const [r, c, dir] = rng.pick(spots);
      place(cand.word, r, c, dir, cand.k);
    }
  }
  return entries.length >= target ? { grid, entries } : null;
}

/** Crops, numbers the entries in reading order. */
export function generate(rng, d, keywords) {
  const maxLen = d <= 3 ? 7 : 9;
  const candidates = keywords
    .map((k) => ({ k, word: k.term.toUpperCase() }))
    .filter((x) => /^[A-Z]+$/.test(x.word) && x.word.length >= 4 && x.word.length <= maxLen);
  const target = d <= 3 ? 5 : d <= 6 ? 7 : 9;
  for (let attempt = 0; attempt < 40; attempt++) {
    const b = build(rng, candidates, target);
    if (!b) continue;
    let minR = SIZE, minC = SIZE, maxR = 0, maxC = 0;
    b.grid.forEach((row, r) => row.forEach((v, c) => { if (v) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); } }));
    const grid = b.grid.slice(minR, maxR + 1).map((row) => row.slice(minC, maxC + 1));
    const entries = b.entries.map((e) => ({ ...e, r: e.r - minR, c: e.c - minC }));
    const starts = [...new Set(entries.map((e) => `${e.r},${e.c}`))].sort((a, b2) => {
      const [ar, ac] = a.split(',').map(Number), [br, bc] = b2.split(',').map(Number);
      return ar - br || ac - bc;
    });
    for (const e of entries) e.num = starts.indexOf(`${e.r},${e.c}`) + 1;
    entries.sort((a, b2) => a.num - b2.num);
    return { grid, entries };
  }
  throw new Error('Could not build a crossword');
}
