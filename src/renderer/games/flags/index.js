import { meta, makeQuestions } from './logic.js';
import { quizGame } from '../_engine/quiz.js';
import { loadPack } from '../_engine/common.js';
import { h } from '../../ui.js';

export { meta };
export const game = quizGame({
  meta,
  load: () => loadPack('countries'),
  makeQuestions,
  render: (q) => h('img', { class: 'flag-big', src: `vendor/flags/4x3/${q.iso2.toLowerCase()}.svg`, alt: 'A national flag' }),
});
export const start = game.start;
