import { meta, makeItems } from './logic.js';
import { revealGame } from '../_engine/reveal.js';

export { meta };
export const game = revealGame({ meta, makeItems, perRound: 6, promptClass: 'rebus' });
export const start = game.start;
