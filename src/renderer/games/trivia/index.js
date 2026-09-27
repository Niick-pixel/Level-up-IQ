import { meta, makeQuestions, COUNT } from './logic.js';
import { quizGame } from '../_engine/quiz.js';

export { meta };

export function start(root, ctx) {
  return quizGame({
    meta,
    load: () => window.api.triviaQuestions({ seed: ctx.seed, amount: COUNT, difficulty: ctx.difficulty })
      .then((r) => r.questions)
      .catch(() => []),
    makeQuestions,
  }).start(root, ctx);
}
