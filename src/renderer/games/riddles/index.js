import { meta, makeItems } from './logic.js';
import { revealGame } from '../_engine/reveal.js';

export { meta };
export const game = revealGame({ meta, makeItems, perRound: 5 });
export const start = game.start;
