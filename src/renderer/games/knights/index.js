import { meta, generate, text, NAMES } from './logic.js';
import { h, clear } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

const ROUNDS = 3;

export function start(root, ctx) {
  const time = clock();
  let round = 0;
  let correct = 0;
  const card = h('div', { class: 'quiz-card' });
  root.append(card);

  function show() {
    const p = generate(ctx.rng, ctx.difficulty);
    const guess = new Array(p.n).fill(null);
    const feedback = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const check = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: submit }, 'Check');
    const people = [...Array(p.n).keys()].map((i) => {
      const says = p.statements.filter((st) => st.speaker === i).map((st) => `“${text(st.s, i).replace(/^./, (c) => c.toUpperCase())}.”`);
      const toggles = ['Knight', 'Knave'].map((label, k) => h('button', {
        class: 'btn small', type: 'button', 'aria-pressed': 'false',
        onclick: (e) => {
          guess[i] = k === 0;
          e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          e.currentTarget.setAttribute('aria-pressed', 'true');
          check.disabled = guess.includes(null);
        },
      }, label));
      return h('div', { class: 'card islander' },
        h('h3', {}, NAMES[i]),
        says.length ? says.map((q) => h('p', {}, q)) : h('p', { class: 'muted' }, '(says nothing)'),
        h('div', { class: 'row seg' }, toggles));
    });
    clear(card).append(h('div', { class: 'muted small' }, `Island ${round + 1} of ${ROUNDS}`), h('div', { class: 'grid islanders' }, people), h('div', { class: 'row' }, check), feedback);

    function submit() {
      check.disabled = true;
      const ok = guess.every((g, i) => g === p.answer[i]);
      if (ok) correct += 1;
      feedback.textContent = ok ? 'Correct!' : `Not quite: ${p.answer.map((k, i) => `${NAMES[i]} is a ${k ? 'knight' : 'knave'}`).join(', ')}.`;
      feedback.className = `g-msg ${ok ? 'ok' : 'bad'}`;
      card.querySelectorAll('.seg button').forEach((b) => { b.disabled = true; });
      const next = h('button', { class: 'btn primary', type: 'button', onclick: () => {
        round += 1;
        if (round < ROUNDS) show();
        else ctx.onFinish({ score: correct * 200 * (1 + ctx.difficulty / 10), accuracy: correct / ROUNDS, performance: correct / ROUNDS, timeMs: time.ms(), difficulty: ctx.difficulty });
      } }, round + 1 < ROUNDS ? 'Next island' : 'Finish');
      card.append(next);
      next.focus();
    }
  }

  show();
  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() {},
  };
}
