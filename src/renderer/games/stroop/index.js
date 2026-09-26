import { meta, INKS, PLACES, TRIALS, genTrials, timeLimit, scoreRound } from './logic.js';
import { h } from '../../ui.js';

export { meta };

export function start(root, ctx) {
  const spatial = Boolean(ctx.settings.colorblind);
  const trials = genTrials(ctx.rng, TRIALS, ctx.difficulty);
  const limit = timeLimit(ctx.difficulty);
  const rts = [];
  let i = 0;
  let correct = 0;
  let shownAt = 0;
  let activeMs = 0; // time spent on trials, excluding pauses and gaps
  let paused = false;
  let done = false;
  let waiting = false; // between trials
  let limitTimer = null;
  let gapTimer = null;

  const word = h('div', { class: 'stroop-word' });
  const stage = h('div', { class: `stroop-stage${spatial ? ' spatial' : ''}`, 'aria-live': 'off' }, word);
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const progress = h('div', { class: 'g-tally muted' });
  const keys = h('div', { class: 'stroop-keys' },
    (spatial ? PLACES : INKS).map((opt, idx) => h('button', {
      class: 'btn',
      type: 'button',
      onclick: () => answer(idx),
    },
    spatial ? null : h('span', { class: 'swatch', style: { background: opt.css } }),
    spatial ? `${arrow(opt.key)} ${opt.name}` : `${opt.key} ${opt.name}`)));
  root.append(h('div', { class: 'g-center' }, stage, keys, msg, progress,
    h('p', { class: 'muted small' }, spatial
      ? 'Colour-blind mode: answer with WHERE the word is, not what it says.'
      : 'Answer with the INK colour, not the word.')));

  function arrow(key) {
    return { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[key];
  }

  function show() {
    if (done) return;
    const t = trials[i];
    waiting = false;
    word.className = 'stroop-word';
    if (spatial) {
      word.textContent = PLACES[t.word].name;
      word.classList.add(`pos-${t.ink}`);
      word.style.color = '';
    } else {
      word.textContent = INKS[t.word].name;
      word.style.color = INKS[t.ink].css;
    }
    progress.textContent = `${i + 1} / ${trials.length}`;
    shownAt = performance.now();
    clearTimeout(limitTimer);
    if (limit) limitTimer = setTimeout(() => answer(-1), limit);
  }

  function answer(choice) {
    if (paused || done || waiting) return;
    clearTimeout(limitTimer);
    const rt = performance.now() - shownAt;
    activeMs += rt;
    const ok = choice === trials[i].ink;
    if (ok) {
      correct += 1;
      rts.push(rt);
    }
    msg.textContent = choice === -1 ? 'Too slow' : ok ? '✓' : '✗';
    msg.className = `g-msg ${ok ? 'ok' : 'bad'}`;
    i += 1;
    if (i >= trials.length) return finish();
    waiting = true;
    word.textContent = '';
    gapTimer = setTimeout(show, 280);
  }

  function finish() {
    done = true;
    word.textContent = '';
    const r = scoreRound({ correct, total: trials.length, rtMs: rts, difficulty: ctx.difficulty });
    ctx.onFinish({ ...r, timeMs: Math.round(activeMs), difficulty: ctx.difficulty });
  }

  function onKey(e) {
    if (e.repeat) return;
    const list = spatial ? PLACES : INKS;
    const idx = list.findIndex((o) => o.key === e.key);
    if (idx >= 0) {
      e.preventDefault();
      answer(idx);
    }
  }
  document.addEventListener('keydown', onKey);
  show();

  return {
    pause() {
      paused = true;
      clearTimeout(limitTimer);
      clearTimeout(gapTimer);
      word.textContent = '';
    },
    resume() {
      paused = false;
      show(); // re-show the current trial with a fresh clock
    },
    destroy() {
      done = true;
      clearTimeout(limitTimer);
      clearTimeout(gapTimer);
      document.removeEventListener('keydown', onKey);
    },
  };
}
