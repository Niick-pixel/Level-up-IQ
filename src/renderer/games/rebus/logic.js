// Rebuses: word pictures. Where and how the words sit spells out a phrase
// (MIND over MATTER, READING between the lines…).
import { REBUS_ITEMS } from '../_data/riddles.js';
import { pickTiered } from '../_engine/tiered.js';

export const meta = {
  id: 'rebus',
  name: 'Rebus',
  blurb: 'Word pictures: the way the words are placed spells a phrase.',
  howTo: ['Look at where the words sit: over, under, between, backwards…', 'Type the phrase and press Enter, or reveal.'],
  skills: ['language', 'logic'],
  durationRange: [60, 240],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const makeItems = (rng, d) => pickTiered(rng, REBUS_ITEMS, d, 6);
