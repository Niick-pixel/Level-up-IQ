// Countdown letters round: make the longest word you can from nine letters.
import { canMake } from '../_engine/words.js';

export const meta = {
  id: 'countdown-letters',
  name: 'Countdown letters',
  blurb: 'Nine letters. Find the longest word you can before time runs out.',
  howTo: ['Type a word and press Enter before the timer ends.', 'Scored against the longest word possible.'],
  skills: ['language'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

// Letter frequencies close to the TV show's piles.
const VOWELS = 'AAAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEEEEEIIIIIIIIIIIIIOOOOOOOOOOOOOUUUUU';
const CONSONANTS = 'BBCCCDDDDDDFFGGGHHJKLLLLLMMMMNNNNNNNNPPPPQRRRRRRRRRSSSSSSSSSTTTTTTTTTVWXYZ';

export const secondsFor = (d) => (d <= 3 ? 60 : d <= 6 ? 45 : 30);

export function drawLetters(rng) {
  const vowels = rng.int(3, 4);
  const pick = (pool, n) => [...Array(n)].map(() => rng.pick([...pool]));
  return rng.shuffle([...pick(VOWELS, vowels), ...pick(CONSONANTS, 9 - vowels)]).join('').toLowerCase();
}

/** Longest dictionary words that can be made from the letters. */
export function bestWords(letters, dict) {
  for (let n = 9; n >= 3; n--) {
    const found = [...(dict[n] || [])].filter((w) => canMake(w, letters));
    if (found.length) return found;
  }
  return [];
}

/** Draws letters that allow at least a 6-letter word (so every round is fair). */
export function makeRound(rng, dict) {
  for (let i = 0; i < 50; i++) {
    const letters = drawLetters(rng);
    const best = bestWords(letters, dict);
    if (best.length && best[0].length >= 6) return { letters, best };
  }
  const letters = drawLetters(rng);
  return { letters, best: bestWords(letters, dict) };
}
