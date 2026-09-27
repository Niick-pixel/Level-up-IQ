import { meta, makeQuestions } from './logic.js';
import { ETYMOLOGY } from '../_data/etymology.js';
import { quizGame } from '../_engine/quiz.js';

export { meta };
export const game = quizGame({ meta, makeQuestions: (rng, d) => makeQuestions(rng, d, ETYMOLOGY) });
export const start = game.start;
