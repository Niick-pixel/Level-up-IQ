// Mastermind: crack the hidden code from exact / elsewhere feedback.

export const meta = {
  id: 'mastermind',
  name: 'Mastermind',
  blurb: 'Crack the hidden code. After each guess you learn how many pegs are exact and how many are the right colour in the wrong place.',
  howTo: ['Pick pegs with the buttons or keys 1–8; Backspace removes one.', 'Enter submits a full row. Ten guesses.'],
  skills: ['logic'],
  durationRange: [60, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const PEGS = [
  { label: 'A', css: '#D55E00' }, { label: 'B', css: '#0072B2' }, { label: 'C', css: '#009E73' }, { label: 'D', css: '#F0E442' },
  { label: 'E', css: '#CC79A7' }, { label: 'F', css: '#56B4E9' }, { label: 'G', css: '#E69F00' }, { label: 'H', css: '#999999' },
];
export const MAX_GUESSES = 10;

export const levelShape = (d) => ({
  length: d <= 5 ? 4 : 5,
  colours: d <= 3 ? 6 : d <= 6 ? 7 : 8,
  repeats: d >= 4,
});

export function makeCode(rng, d) {
  const { length, colours, repeats } = levelShape(d);
  if (repeats) return [...Array(length)].map(() => rng.int(0, colours - 1));
  return rng.shuffle([...Array(colours).keys()]).slice(0, length);
}

/** { exact, elsewhere } for a guess against the code. */
export function feedback(code, guess) {
  let exact = 0;
  const rc = new Map();
  const rg = new Map();
  code.forEach((c, i) => {
    if (guess[i] === c) exact += 1;
    else {
      rc.set(c, (rc.get(c) || 0) + 1);
      rg.set(guess[i], (rg.get(guess[i]) || 0) + 1);
    }
  });
  let elsewhere = 0;
  for (const [c, n] of rg) elsewhere += Math.min(n, rc.get(c) || 0);
  return { exact, elsewhere };
}
