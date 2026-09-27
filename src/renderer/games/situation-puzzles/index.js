import { meta, makeItems } from './logic.js';
import { revealGame } from '../_engine/reveal.js';

export { meta };
export const game = revealGame({ meta, makeItems, perRound: 3, guessable: false });
export const start = game.start;
