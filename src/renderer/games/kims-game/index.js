import { meta, ROUNDS, studyMs, genRound } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const time = clock();
  const rounds = Array.from({ length: ROUNDS }, () => genRound(ctx.rng, ctx.difficulty));
  let i = 0;
  let correct = 0;
  let phase = 'study';
  let deadline = 0;
  let remaining = 0;
  let tick = 0;
  let done = false;

  const card = h('div', { class: 'quiz-card' });
  root.append(card);

  const tile = (o) => h('div', { class: 'kim-item', title: o.name }, h('span', { 'aria-hidden': 'true' }, o.glyph), h('span', { class: 'sr-only' }, o.name));

  function study() {
    phase = 'study';
    const r = rounds[i];
    const fill = h('div', { class: 'g-timefill' });
    const ready = h('button', { class: 'btn primary', type: 'button', onclick: quiz }, 'Ready (Enter)');
    fill(card, 
      h('div', { class: 'muted small' }, `Tray ${i + 1} / ${ROUNDS} · ${r.tray.length} objects`),
      h('div', { class: 'g-timebar' }, fill),
      h('div', { class: 'kim-tray' }, r.tray.map(tile)),
      h('div', { class: 'row' }, ready));
    ready.focus();
    remaining = studyMs(ctx.difficulty);
    run(fill);
  }

  function run(fill) {
    const total = studyMs(ctx.difficulty);
    deadline = performance.now() + remaining;
    clearInterval(tick);
    tick = setInterval(() => {
      const left = deadline - performance.now();
      fill.style.transform = `scaleX(${Math.max(0, left / total)})`;
      if (left <= 0) quiz();
    }, 100);
  }

  function quiz() {
    if (phase !== 'study') return;
    clearInterval(tick);
    phase = 'quiz';
    const r = rounds[i];
    const slots = r.keepSlots
      ? r.tray.map((o, k) => (k === r.goneIndex ? h('div', { class: 'kim-item empty', 'aria-label': 'empty spot' }) : tile(o)))
      : r.left.map(tile);
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const buttons = r.options.map((o, k) => h('button', { class: 'btn option', type: 'button', onclick: () => choose(k) },
      h('kbd', {}, String(k + 1)), ' ', h('span', { class: 'kim-opt', 'aria-hidden': 'true' }, o.glyph), ' ', o.name));
    fill(card, 
      h('div', { class: 'muted small' }, `Tray ${i + 1} / ${ROUNDS}`),
      h('div', { class: 'kim-tray' }, slots),
      h('h3', { class: 'quiz-prompt' }, 'Which object is missing?'),
      h('div', { class: 'options' }, buttons),
      msg);
    card.choose = (k) => {
      if (phase !== 'quiz') return;
      phase = 'feedback';
      const ok = k === r.answer;
      if (ok) correct += 1;
      buttons.forEach((b, j) => { b.disabled = true; if (j === r.answer) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      msg.textContent = ok ? 'Correct.' : `It was the ${r.gone.name}.`;
      msg.className = `g-msg ${ok ? 'ok' : 'bad'}`;
      setTimeout(next, ok ? 900 : 1600);
    };
  }
  const choose = (k) => card.choose?.(k);

  function next() {
    if (done) return;
    i += 1;
    if (i < ROUNDS) return study();
    done = true;
    time.pause();
    const accuracy = correct / ROUNDS;
    ctx.onFinish({ score: Math.round(correct * 100 * (1 + ctx.difficulty / 10)), accuracy, performance: accuracy, timeMs: time.ms(), difficulty: ctx.difficulty });
  }

  function onKey(e) {
    if (done) return;
    if (phase === 'study' && e.key === 'Enter') { e.preventDefault(); quiz(); }
    const n = Number(e.key);
    if (phase === 'quiz' && n >= 1 && n <= rounds[i].options.length) choose(n - 1);
  }
  document.addEventListener('keydown', onKey);
  study();

  return {
    pause() {
      time.pause();
      if (phase === 'study') { clearInterval(tick); remaining = Math.max(0, deadline - performance.now()); }
      card.style.visibility = 'hidden';
    },
    resume() {
      time.resume();
      card.style.visibility = '';
      if (phase === 'study') run(card.querySelector('.g-timefill'));
    },
    destroy() { done = true; clearInterval(tick); document.removeEventListener('keydown', onKey); },
  };
}
