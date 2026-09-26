// Stroop: name the ink colour, not the word. Colour-blind mode swaps in a spatial Stroop
// (respond to where the word is, not what it says), so the game never depends on colour vision.

export const meta = {
  id: 'stroop',
  name: 'Stroop',
  blurb: 'Answer with the ink colour, not the word. Speed and accuracy both count.',
  howTo: ['Press 1–4 (or click) for the ink colour.', 'In colour-blind mode: use the arrow keys for where the word is.'],
  skills: ['attention'],
  durationRange: [40, 90],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

// Okabe–Ito colours, so each ink is distinct for most colour-vision types.
export const INKS = [
  { name: 'RED', css: '#D55E00', key: '1' },
  { name: 'BLUE', css: '#0072B2', key: '2' },
  { name: 'GREEN', css: '#009E73', key: '3' },
  { name: 'YELLOW', css: '#F0E442', key: '4' },
];

export const PLACES = [
  { name: 'LEFT', key: 'ArrowLeft' },
  { name: 'RIGHT', key: 'ArrowRight' },
  { name: 'UP', key: 'ArrowUp' },
  { name: 'DOWN', key: 'ArrowDown' },
];

export const TRIALS = 24;

/** Share of trials where word and ink agree. Fewer at higher levels. */
export const congruentRate = (d) => Math.max(0.1, 0.5 - d * 0.04);

/** Per-trial time limit in ms (none below level 5). */
export const timeLimit = (d) => (d < 5 ? null : 2600 - (d - 5) * 250);

/**
 * @returns {{ word: number, ink: number, congruent: boolean }[]} indexes into INKS (or PLACES)
 */
export function genTrials(rng, n, difficulty) {
  const congruentCount = Math.round(n * congruentRate(difficulty));
  const flags = rng.shuffle(Array.from({ length: n }, (_, i) => i < congruentCount));
  let prev = -1;
  return flags.map((congruent) => {
    let ink;
    do ink = rng.int(0, 3); while (ink === prev); // never the same answer twice in a row
    prev = ink;
    let word = ink;
    if (!congruent) do word = rng.int(0, 3); while (word === ink);
    return { word, ink, congruent };
  });
}

export function scoreRound({ correct, total, rtMs, difficulty }) {
  const accuracy = total ? correct / total : 0;
  const avg = rtMs.length ? rtMs.reduce((a, b) => a + b, 0) / rtMs.length : 3000;
  const speed = Math.min(1, Math.max(0.3, 1.6 - avg / 1500));
  return {
    score: Math.round(correct * 10 * speed * (1 + difficulty / 5)),
    accuracy,
    performance: accuracy * speed,
    avgRt: avg,
  };
}
