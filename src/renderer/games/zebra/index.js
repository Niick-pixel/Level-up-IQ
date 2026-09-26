import { meta, generate, clueText, questionText } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

const MARKS = ['', '✓', '✗'];

export function start(root, ctx) {
  const p = generate(ctx.rng, ctx.difficulty);
  const time = clock();
  let done = false;

  const clues = h('ol', { class: 'zebra-clues' }, p.clues.map((c) => h('li', {
    tabindex: '0',
    title: 'Click to cross off',
    onclick: (e) => e.currentTarget.classList.toggle('used'),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.classList.toggle('used'); } },
  }, clueText(p, c))));

  // Scratch grid: one row per value, one column per house.
  const grid = h('table', { class: 'zebra-grid' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), [...Array(p.n)].map((_, i) => h('th', {}, `House ${i + 1}`)))),
    h('tbody', {}, p.cats.flatMap((cat, ci) => cat.values.map((v, vi) => h('tr', { class: vi === 0 && ci ? 'group' : '' },
      h('th', {}, v),
      [...Array(p.n)].map(() => {
        let m = 0;
        const cell = h('td', { tabindex: '0', 'aria-label': 'blank' });
        const cycle = () => { m = (m + 1) % 3; cell.textContent = MARKS[m]; cell.className = ['', 'yes', 'no'][m]; cell.setAttribute('aria-label', ['blank', 'yes', 'no'][m]); };
        cell.addEventListener('click', cycle);
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(); } });
        return cell;
      }))))));

  const ask = p.cats[p.question.askCat];
  const feedback = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const options = h('div', { class: 'row' }, ask.values.map((v, i) => h('button', { class: 'btn', type: 'button', onclick: () => answer(i) }, v)));

  root.append(h('div', { class: 'zebra' },
    h('div', {}, h('h3', {}, `${p.n} houses in a row, numbered from the left`), clues),
    h('div', {}, grid,
      h('div', { class: 'card', style: { marginTop: '12px' } }, h('h3', {}, questionText(p)), options, feedback))));

  function answer(i) {
    if (done) return;
    done = true;
    time.pause();
    const ok = i === p.question.answer;
    options.querySelectorAll('button').forEach((b, j) => {
      b.disabled = true;
      if (j === p.question.answer) b.classList.add('primary');
    });
    feedback.textContent = ok ? 'Correct!' : `No: it's the ${ask.values[p.question.answer]}.`;
    feedback.className = `g-msg ${ok ? 'ok' : 'bad'}`;
    const par = 60 + p.clues.length * 25;
    const speed = Math.min(1, par / Math.max(1, time.ms() / 1000));
    const performance = ok ? 0.6 + 0.4 * speed : 0;
    setTimeout(() => ctx.onFinish({ score: Math.round(performance * 1000 * (1 + ctx.difficulty / 5)), accuracy: ok ? 1 : 0, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 900);
  }

  return {
    pause() { time.pause(); root.style.visibility = 'hidden'; },
    resume() { time.resume(); root.style.visibility = ''; },
    destroy() { done = true; },
  };
}
