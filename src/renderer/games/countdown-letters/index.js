import { meta, makeRound, secondsFor } from './logic.js';
import { loadDictionary, canMake } from '../_engine/words.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };
const ROUNDS = 3;

export function start(root, ctx) {
  const time = clock();
  let round = 0;
  let total = 0;
  let paused = false;
  let raf = 0;
  const card = h('div', { class: 'quiz-card' }, h('p', { class: 'muted' }, 'Loading the dictionary…'));
  root.append(card);

  loadDictionary().then((dict) => play(dict)).catch((e) => fill(card, h('p', { class: 'g-msg bad' }, e.message)));

  function play(dict) {
    const { letters, best } = makeRound(ctx.rng, dict);
    const limit = secondsFor(ctx.difficulty) * 1000;
    let left = limit;
    let last = performance.now();
    let answer = '';
    const fill = h('div', { class: 'g-timefill' });
    const input = h('input', { class: 'g-answer wide', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Your word' });
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    fill(card, 
      h('div', { class: 'muted small' }, `Round ${round + 1} of ${ROUNDS}`),
      h('div', { class: 'g-timebar' }, fill),
      h('div', { class: 'tiles' }, [...letters].map((ch) => h('span', { class: 'tile' }, ch.toUpperCase()))),
      input, msg);
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const w = input.value.trim().toLowerCase();
      if (!canMake(w, letters)) { msg.textContent = 'Use only the letters shown (each once).'; msg.className = 'g-msg bad'; return; }
      if (!dict[w.length]?.has(w)) { msg.textContent = `“${w}” isn't in the dictionary.`; msg.className = 'g-msg bad'; return; }
      answer = w;
      msg.textContent = `Declared: ${w.toUpperCase()} (${w.length}). You can improve it until time runs out.`;
      msg.className = 'g-msg ok';
    });
    const tick = (now) => {
      if (!paused) left -= now - last;
      last = now;
      fill.style.transform = `scaleX(${Math.max(0, left / limit)})`;
      if (left > 0) { raf = requestAnimationFrame(tick); return; }
      input.disabled = true;
      const score = answer ? answer.length / best[0].length : 0;
      total += Math.min(1, score);
      const examples = best.slice(0, 3).map((w) => w.toUpperCase()).join(', ');
      card.append(
        h('p', {}, answer ? `Your word: ${answer.toUpperCase()} (${answer.length} letters).` : 'No word declared.'),
        h('p', { class: 'muted' }, `Longest possible: ${best[0].length} letters, e.g. ${examples}.`),
        h('button', { class: 'btn primary', type: 'button', onclick: next }, round + 1 < ROUNDS ? 'Next round' : 'Finish'));
      card.querySelector('button').focus();
    };
    raf = requestAnimationFrame(tick);
    function next() {
      round += 1;
      if (round < ROUNDS) return play(dict);
      const performance = total / ROUNDS;
      ctx.onFinish({ score: Math.round(performance * 300 * (1 + ctx.difficulty / 10)), accuracy: performance, performance, timeMs: time.ms(), difficulty: ctx.difficulty });
    }
  }

  return {
    pause() { paused = true; time.pause(); card.style.visibility = 'hidden'; },
    resume() { paused = false; time.resume(); card.style.visibility = ''; card.querySelector('input:not([disabled])')?.focus(); },
    destroy() { cancelAnimationFrame(raf); },
  };
}
