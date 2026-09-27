// Situation puzzles (lateral thinking): a strange scene with a simple explanation. Question
// your assumptions: who, where, what the words really mean.
import { SITUATION_ITEMS } from '../_data/riddles.js';
import { pickTiered } from '../_engine/tiered.js';

export const meta = {
  id: 'situation-puzzles',
  name: 'Lateral thinking',
  blurb: 'A strange situation with a simple explanation. What is really going on?',
  howTo: ['Think of explanations; question every assumption in the story.', 'Reveal when you have one (after the thinking timer), and mark yourself.'],
  skills: ['logic', 'deep-thinking'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const makeItems = (rng, d) => pickTiered(rng, SITUATION_ITEMS, d, 3);
