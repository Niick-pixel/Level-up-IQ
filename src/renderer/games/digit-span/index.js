import { meta, startSpan, isBackwards, msPerDigit, genDigits, expected } from './logic.js';
import { staircase, scoreSpan, SPAN_TRIALS } from '../_engine/span.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const back = isBackwards(ctx.difficulty);
  const first = startSpan(ctx.difficulty);
  const stairs = staircase(first);
  const time = clock();
  let digits = [];
  let timers = [];
  let phase = 'idle'; // 'show' | 'answer' | 'feedback'
  let done = false;

  const display = h('div', { class: 'span-digit', 'aria-live': 'off' });
  const input = h('input', { class: 'g-answer', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Digits', hidden: true });
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const tally = h('div', { class: 'muted small' });
  const instr = h('p', { class: 'muted' }, back ? 'Type the digits in REVERSE order.' : 'Type the digits in the order you saw them.');
  root.append(h('div', { class: 'g-center' }, tally, display, input, msg, instr));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && phase === 'answer') submit();
  });
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function trial() {
    clearTimers();
    phase = 'show';
    digits = genDigits(ctx.rng, stairs.span);
    tally.textContent = `List ${stairs.results.length + 1} of ${SPAN_TRIALS} · ${stairs.span} digits`;
    input.hidden = true;
    input.value = '';
    msg.textContent = '';
    display.textContent = '';
    const step = msPerDigit(ctx.difficulty);
    digits.forEach((d, i) => {
      timers.push(setTimeout(() => { display.textContent = String(d); }, 600 + i * step));
      timers.push(setTimeout(() => { display.textContent = ''; }, 600 + i * step + step * 0.75));
    });
    timers.push(setTimeout(() => {
      phase = 'answer';
      display.textContent = '?';
      input.hidden = false;
      input.focus();
    }, 600 + digits.length * step));
  }

  function submit() {
    const want = expected(digits, back);
    const ok = input.value === want;
    stairs.record(ok);
    phase = 'feedback';
    input.hidden = true;
    msg.textContent = ok ? '✓ Correct' : `✗ It was ${want.split('').join(' ')}`;
    msg.className = `g-msg ${ok ? 'ok' : 'bad'}`;
    if (stairs.done) return finish();
    timers.push(setTimeout(trial, ok ? 900 : 1800));
  }

  function finish() {
    done = true;
    time.pause();
    const r = scoreSpan(stairs.results, first, ctx.difficulty);
    display.textContent = String(r.best || '–');
    timers.push(setTimeout(() => ctx.onFinish({ ...r, timeMs: time.ms(), difficulty: ctx.difficulty }), 1200));
  }

  trial();

  return {
    pause() {
      time.pause();
      if (!done && (phase === 'show' || phase === 'feedback')) clearTimers();
      root.style.visibility = 'hidden';
    },
    resume() {
      time.resume();
      root.style.visibility = '';
      if (done) return;
      if (phase === 'show' || phase === 'feedback') trial(); // a paused list is replaced by a fresh one
      else input.focus();
    },
    destroy() { done = true; clearTimers(); },
  };
}
