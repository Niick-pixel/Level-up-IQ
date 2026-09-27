import { meta, genRound, parSecondsPerWord, checkRecall } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock, matches, clamp01 } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const { pairs } = genRound(ctx.rng, ctx.difficulty);
  const time = clock();
  const studyClock = clock();
  let studyMs = 0;
  let done = false;
  const card = h('div', { class: 'quiz-card' });
  root.append(card);

  function study() {
    const ready = h('button', { class: 'btn primary', type: 'button', onclick: recall }, 'Ready');
    fill(card, 
      h('div', { class: 'eyebrow muted small' }, 'Your palace: a walk from the gate, through the house, into the garden'),
      h('h3', { class: 'quiz-prompt' }, `Place these ${pairs.length} things along the route`),
      h('ol', { class: 'palace-list' }, pairs.map((p) => h('li', {}, h('span', { class: 'muted' }, `At ${p.locus}: `), h('strong', {}, p.word)))),
      h('p', { class: 'muted small' }, 'Tip: make each picture absurd, big, moving or smelly. A tidy picture fades; a weird one sticks.'),
      h('div', { class: 'row' }, ready));
    ready.focus();
  }

  function recall() {
    studyMs = studyClock.ms();
    studyClock.pause();
    const inputs = pairs.map((p, i) => h('input', { class: 'g-answer wide', autocomplete: 'off', spellcheck: 'false', 'aria-label': `What was at ${p.locus}?`, onkeydown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); (inputs[i + 1] || check).focus(); }
    } }));
    const check = h('button', { class: 'btn primary', type: 'button', onclick: () => grade(inputs) }, 'Check');
    fill(card, 
      h('h3', { class: 'quiz-prompt' }, 'Walk the route again. What did you leave at each spot?'),
      h('div', { class: 'palace-recall' }, pairs.map((p, i) => h('label', { class: 'palace-row' }, h('span', { class: 'muted' }, `${i + 1}. ${p.locus}`), inputs[i]))),
      h('div', { class: 'row' }, check));
    inputs[0].focus();
  }

  function grade(inputs) {
    if (done) return;
    done = true;
    time.pause();
    const ok = checkRecall(pairs, inputs.map((x) => x.value), matches);
    inputs.forEach((x, i) => {
      x.disabled = true;
      x.classList.add(ok[i] ? 'right' : 'wrong');
      if (!ok[i]) x.after(h('span', { class: 'g-msg bad small' }, ` ${pairs[i].word}`));
    });
    const right = ok.filter(Boolean).length;
    const accuracy = right / pairs.length;
    const par = pairs.length * parSecondsPerWord(ctx.difficulty) * 1000;
    const speed = clamp01(par / Math.max(1, studyMs));
    const performance = clamp01(accuracy * (0.8 + 0.2 * speed));
    card.querySelector('.btn.primary')?.remove();
    card.append(h('div', { class: `g-msg ${accuracy >= 0.8 ? 'ok' : ''}` }, `${right} / ${pairs.length} in the right place, after ${Math.round(studyMs / 1000)} s of study.`));
    setTimeout(() => ctx.onFinish({ score: Math.round(right * 50 * (1 + ctx.difficulty / 10) * (0.8 + 0.2 * speed)), accuracy, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 2500);
  }

  study();

  return {
    pause() { time.pause(); studyClock.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); if (!studyMs) studyClock.resume(); card.style.visibility = ''; },
    destroy() { done = true; },
  };
}
