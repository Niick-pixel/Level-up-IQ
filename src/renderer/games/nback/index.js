import { meta, LETTERS, genRound, isTarget, scoreRound, stepMs } from './logic.js';
import { h } from '../../ui.js';

export { meta };

const SHOW_MS = 800;

export function start(root, ctx) {
  const round = genRound(ctx.rng, ctx.difficulty);
  const step = stepMs(ctx.difficulty);
  const responses = Array.from({ length: round.trials }, () => ({ pos: false, let: false }));
  let i = -1;
  let paused = false;
  let done = false;
  let timers = [];
  let activeMs = 0;
  let trialStart = 0;

  const cells = Array.from({ length: 9 }, () => h('div', { class: 'nback-cell' }));
  const posBtn = h('button', { class: 'btn', type: 'button', onclick: () => press('pos') }, 'A · Position');
  const letBtn = h('button', { class: 'btn', type: 'button', onclick: () => press('let') }, 'L · Letter');
  const progress = h('div', { class: 'g-tally muted' });
  root.append(h('div', { class: 'g-center' },
    h('p', { class: 'muted' }, `${round.n}-back: press when the position or the letter matches the one from ${round.n} step${round.n > 1 ? 's' : ''} ago.`),
    h('div', { class: 'nback-grid', 'aria-hidden': 'true' }, cells),
    h('div', { class: 'row nback-keys' }, posBtn, letBtn),
    progress));

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function press(key) {
    if (paused || done || i < 0 || responses[i][key]) return;
    responses[i][key] = true;
    (key === 'pos' ? posBtn : letBtn).classList.add('pressed');
  }

  function feedback() {
    // After each trial, show whether each stream was right (green) or wrong (red).
    for (const [key, btn, seq] of [['pos', posBtn, round.positions], ['let', letBtn, round.letters]]) {
      btn.classList.remove('pressed', 'hit', 'miss');
      if (i < round.n) continue;
      const target = isTarget(seq, round.n, i);
      const pressed = responses[i][key];
      if (target && pressed) btn.classList.add('hit');
      else if (target !== pressed) btn.classList.add('miss');
    }
  }

  function trial() {
    if (done || paused) return;
    i += 1;
    if (i >= round.trials) return finish();
    posBtn.classList.remove('hit', 'miss', 'pressed');
    letBtn.classList.remove('hit', 'miss', 'pressed');
    const cell = cells[round.positions[i]];
    cell.classList.add('on');
    cell.textContent = LETTERS[round.letters[i]];
    progress.textContent = `${i + 1} / ${round.trials}`;
    trialStart = performance.now();
    later(() => { cell.classList.remove('on'); cell.textContent = ''; }, SHOW_MS);
    later(() => {
      activeMs += performance.now() - trialStart;
      feedback();
      later(trial, 250);
    }, step - 250);
  }

  function finish() {
    done = true;
    const r = scoreRound(round, responses, ctx.difficulty);
    ctx.onFinish({ score: r.score, accuracy: r.accuracy, performance: r.performance, timeMs: Math.round(activeMs), difficulty: ctx.difficulty });
  }

  function onKey(e) {
    if (e.repeat) return;
    if (e.key === 'a' || e.key === 'A') press('pos');
    if (e.key === 'l' || e.key === 'L') press('let');
  }
  document.addEventListener('keydown', onKey);
  later(trial, 600);

  return {
    pause() {
      paused = true;
      clearTimers();
      cells.forEach((c) => { c.classList.remove('on'); c.textContent = ''; });
    },
    resume() {
      paused = false;
      // replay the interrupted trial from the start
      if (i >= 0) {
        responses[i] = { pos: false, let: false };
        i -= 1;
      }
      later(trial, 400);
    },
    destroy() {
      done = true;
      clearTimers();
      document.removeEventListener('keydown', onKey);
    },
  };
}
