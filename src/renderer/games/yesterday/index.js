import { meta, ageLabel, scoreRound } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const time = clock();
  const marks = [];
  let cards = [];
  let i = 0;
  let destroyed = false;
  const card = h('div', { class: 'quiz-card' }, h('p', { class: 'muted' }, 'Loading your cards…'));
  root.append(card);

  window.api.recallCards().then((list) => {
    if (destroyed) return;
    cards = ctx.rng.shuffle(list);
    if (!cards.length) {
      fill(card, 
        h('h3', {}, 'Nothing to recall yet'),
        h('p', { class: 'muted' }, 'This game quizzes you on facts from your keyword sessions, a day or more after you learned them. Do a keyword session today and come back tomorrow.'),
        h('a', { class: 'btn primary', href: '#/keywords' }, 'Pick a keyword'));
      return;
    }
    show();
  });

  function show() {
    const c = cards[i];
    const answer = h('div', { class: 'reveal-answer', hidden: true }, c.back);
    const guess = h('textarea', { class: 'reflect-box short', placeholder: 'Your answer, from memory (optional)', 'aria-label': 'Your answer' });
    const grades = h('div', { class: 'row', hidden: true },
      h('span', { class: 'muted' }, 'How did you do?'),
      h('button', { class: 'btn', type: 'button', onclick: () => mark('got') }, 'Got it'),
      h('button', { class: 'btn', type: 'button', onclick: () => mark('partly') }, 'Partly'),
      h('button', { class: 'btn', type: 'button', onclick: () => mark('missed') }, 'Missed it'));
    const reveal = h('button', { class: 'btn primary', type: 'button', onclick: () => {
      reveal.remove();
      guess.disabled = true;
      answer.hidden = false;
      grades.hidden = false;
      grades.querySelector('button').focus();
    } }, 'Show answer');
    fill(card, 
      h('div', { class: 'muted small' }, `${i + 1} / ${cards.length} · learned ${ageLabel(c.daysAgo)}`),
      h('h3', { class: 'quiz-prompt' }, c.front),
      guess, h('div', { class: 'row' }, reveal), answer, grades);
    guess.focus();
  }

  function mark(m) {
    marks.push(m);
    i += 1;
    if (i < cards.length) return show();
    destroyed = true;
    time.pause();
    ctx.onFinish({ ...scoreRound(marks, ctx.difficulty), timeMs: time.ms(), difficulty: ctx.difficulty });
  }

  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() { destroyed = true; },
  };
}
