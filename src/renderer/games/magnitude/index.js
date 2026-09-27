import { meta, makeQuestions } from './logic.js';
import { MAGNITUDES } from '../_data/magnitudes.js';
import { quizGame } from '../_engine/quiz.js';

export { meta };
export const game = quizGame({ meta, makeQuestions: (rng, d) => makeQuestions(rng, d, MAGNITUDES) });
export const start = game.start;
