import { meta, BLOCKS, startSpan, msPerBlock, layout, genSequence } from './logic.js';
import { staircase, scoreSpan, SPAN_TRIALS } from '../_engine/span.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const first = startSpan(ctx.difficulty);
  const stairs = staircase(first, { min: 2, max: BLOCKS });
  const pos = layout(ctx.rng);
  const time = clock();
  let seq = [];
  let taps = [];
  let timers = [];
  let phase = 'idle';
  let done = false;

  const blocks = pos.map((p, i) => h('button', {
    class: 'corsi-block', type: 'button', 'aria-label': `Block ${i + 1}`,
    style: { left: `${p.x}%`, top: `${p.y}%` },
    onclick: () => tap(i),
  }));
  const board = h('div', { class: 'corsi-board' }, blocks);
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const tally = h('div', { class: 'muted small' });
  root.append(h('div', { class: 'g-center' }, tally, board, msg));

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const setDisabled = (on) => blocks.forEach((b) => { b.disabled = on; });

  function trial() {
    clearTimers();
    phase = 'show';
    seq = genSequence(ctx.rng, stairs.span);
    taps = [];
    blocks.forEach((b) => b.classList.remove('lit', 'tapped', 'wrong'));
    setDisabled(true);
    tally.textContent = `Sequence ${stairs.results.length + 1} of ${SPAN_TRIALS} · ${stairs.span} blocks`;
    msg.textContent = 'Watch…';
    msg.className = 'g-msg';
    const step = msPerBlock(ctx.difficulty);
    seq.forEach((b, i) => {
      timers.push(setTimeout(() => blocks[b].classList.add('lit'), 700 + i * step));
      timers.push(setTimeout(() => blocks[b].classList.remove('lit'), 700 + i * step + step * 0.7));
    });
    timers.push(setTimeout(() => {
      phase = 'answer';
      setDisabled(false);
      msg.textContent = 'Your turn';
      blocks[0].focus();
    }, 700 + seq.length * step));
  }

  function tap(i) {
    if (phase !== 'answer') return;
    const k = taps.length;
    taps.push(i);
    const b = blocks[i];
    b.classList.add('tapped');
    setTimeout(() => b.classList.remove('tapped'), 250);
    if (seq[k] !== i) return judge(false);
    if (taps.length === seq.length) judge(true);
  }

  function judge(ok) {
    stairs.record(ok);
    phase = 'feedback';
    setDisabled(true);
    msg.textContent = ok ? '✓ Correct' : '✗ Not that one';
    msg.className = `g-msg ${ok ? 'ok' : 'bad'}`;
    if (!ok) seq.forEach((b, n) => timers.push(setTimeout(() => blocks[b].classList.add('lit'), 300 + n * 250)));
    if (stairs.done) return finish();
    timers.push(setTimeout(trial, ok ? 900 : 1000 + seq.length * 250));
  }

  function finish() {
    done = true;
    time.pause();
    const r = scoreSpan(stairs.results, first, ctx.difficulty);
    timers.push(setTimeout(() => ctx.onFinish({ ...r, timeMs: time.ms(), difficulty: ctx.difficulty }), 1400));
  }

  trial();

  return {
    pause() {
      time.pause();
      if (!done && phase !== 'answer') clearTimers();
      root.style.visibility = 'hidden';
    },
    resume() {
      time.resume();
      root.style.visibility = '';
      if (!done && phase !== 'answer') trial();
    },
    destroy() { done = true; clearTimers(); },
  };
}
