import { meta, makeQuestions } from './logic.js';
import { quizGame } from '../_engine/quiz.js';
import { loadPack } from '../_engine/common.js';

export { meta };
export const game = quizGame({ meta, load: () => loadPack('countries'), makeQuestions });
export const start = game.start;
