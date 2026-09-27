// Riddles: traditional folk riddles and number puzzles. Type a guess, or think and reveal.
import { RIDDLE_ITEMS } from '../_data/riddles.js';
import { pickTiered } from '../_engine/tiered.js';

export const meta = {
  id: 'riddles',
  name: 'Riddles',
  blurb: 'Classic riddles and trick questions. Type your answer, or think it through and reveal.',
  howTo: ['Type a guess and press Enter (optional).', 'Hints and Reveal unlock after the thinking timer.', 'Be honest when you mark yourself.'],
  skills: ['logic', 'language'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const makeItems = (rng, d) => pickTiered(rng, RIDDLE_ITEMS, d, 5);
