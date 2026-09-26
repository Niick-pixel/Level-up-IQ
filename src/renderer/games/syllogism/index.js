import { meta, makeQuestions } from './logic.js';
import { quizGame } from '../_engine/quiz.js';

export { meta };
export const game = quizGame({ meta, makeQuestions });
export const start = game.start;
