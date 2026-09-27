import { meta, makeQuestions } from './logic.js';
import { quizGame } from '../_engine/quiz.js';
import { picture } from '../_engine/picture.js';

export { meta };
export function start(root, ctx) {
  return quizGame({ meta, load: () => window.api.speciesRound({ seed: ctx.seed, difficulty: ctx.difficulty }), makeQuestions, render: picture }).start(root, ctx);
}
