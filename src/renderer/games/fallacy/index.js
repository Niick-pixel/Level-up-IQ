import { meta, makeQuestions } from './logic.js';
import { FALLACIES } from '../_data/fallacies.js';
import { quizGame } from '../_engine/quiz.js';

export { meta };
export const game = quizGame({ meta, makeQuestions: (rng, d) => makeQuestions(rng, d, FALLACIES) });
export const start = game.start;
