// Deep-thinking prompts: write for a few minutes without help, then rate yourself honestly
// against a short checklist. There's no right answer to grade, only the habit of thinking it through.
import { h, clear } from '../../ui.js';
import { clock, clamp01 } from './common.js';

/**
 * makePrompt(rng, difficulty) → { title, prompt, steps?: string[], checklist: string[], minWords }
 */
export function reflectGame({ meta, makePrompt }) {
  return {
    meta,
    start(root, ctx) {
      let paused = false;
      const time = clock();
      const p = makePrompt(ctx.rng, ctx.difficulty);
      const box = h('textarea', { class: 'reflect-box', placeholder: 'Think it through in writing. No searching, no AI.', 'aria-label': 'Your answer' });
      const count = h('span', { class: 'muted small' });
      const done = h('button', { class: 'btn primary', type: 'button', onclick: review }, 'Done writing');
      const card = h('div', { class: 'quiz-card' },
        h('div', { class: 'eyebrow muted small' }, p.title),
        h('h3', { class: 'quiz-prompt' }, p.prompt),
        p.steps ? h('ol', { class: 'muted' }, p.steps.map((s) => h('li', {}, s))) : null,
        box,
        h('div', { class: 'row', style: { marginTop: '8px' } }, done, count));
      root.append(card);
      box.focus();
      const words = () => (box.value.match(/\S+/g) || []).length;
      box.addEventListener('input', () => { count.textContent = `${words()} words (aim for ${p.minWords}+)`; });
      count.textContent = `aim for ${p.minWords}+ words`;

      function review() {
        if (words() < Math.min(15, p.minWords)) {
          count.textContent = 'Write a bit more first.';
          return;
        }
        box.disabled = true;
        done.remove();
        const checks = p.checklist.map((c) => h('label', { class: 'check' }, h('input', { type: 'checkbox' }), ' ', c));
        card.append(
          h('h3', { style: { marginTop: '14px' } }, 'Look back honestly'),
          h('div', { class: 'checks' }, checks),
          h('button', { class: 'btn primary', type: 'button', style: { marginTop: '10px' }, onclick: finish }, 'Finish'));
        function finish() {
          const ticked = checks.filter((c) => c.querySelector('input').checked).length;
          const lengthScore = Math.min(1, words() / p.minWords);
          const performance = clamp01(0.6 * (ticked / checks.length) + 0.4 * lengthScore);
          ctx.onFinish({ score: Math.round(performance * 500), accuracy: ticked / checks.length, performance, timeMs: time.ms(), difficulty: ctx.difficulty });
        }
      }

      return {
        pause() { paused = true; time.pause(); card.style.visibility = 'hidden'; },
        resume() { paused = false; time.resume(); card.style.visibility = ''; },
        destroy() {},
      };
    },
  };
}
