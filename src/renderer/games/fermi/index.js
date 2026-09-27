import { meta, makeItems } from './logic.js';
import { FERMI } from '../_data/fermi.js';
import { inputGame } from '../_engine/input.js';

export { meta };
export const game = inputGame({ meta, makeItems: (rng, d) => makeItems(rng, d, FERMI) });
export const start = game.start;
