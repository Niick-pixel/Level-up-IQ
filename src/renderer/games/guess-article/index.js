import { meta, makeQuestions } from './logic.js';
import { quizGame } from '../_engine/quiz.js';

export { meta };

export function start(root, ctx) {
  return quizGame({
    meta,
    load: () => window.api.guessArticle({ seed: ctx.seed, count: 5, difficulty: ctx.difficulty }),
    makeQuestions,
  }).start(root, ctx);
}
