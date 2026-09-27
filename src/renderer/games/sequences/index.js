import { meta, makeItems } from './logic.js';
import { inputGame } from '../_engine/input.js';

export { meta };
export const game = inputGame({ meta, makeItems, attempts: 2 });
export const start = game.start;
