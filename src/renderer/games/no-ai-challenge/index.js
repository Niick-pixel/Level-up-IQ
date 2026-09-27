import { meta, makePrompt } from './logic.js';
import { reflectGame } from '../_engine/reflect.js';

export { meta };
export const game = reflectGame({ meta, makePrompt: (rng, d) => makePrompt(rng, d) });
export const start = game.start;
