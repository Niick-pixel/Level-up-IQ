import { meta, makePrompt } from './logic.js';
import { reflectGame } from '../_engine/reflect.js';

export { meta };
export const game = reflectGame({ meta, makePrompt });
export const start = game.start;
