import { meta, gridSize, genGrid, scoreRound } from './logic.js';
import { h } from '../../ui.js';

export { meta };

export function start(root, ctx) {
  const size = gridSize(ctx.difficulty);
  const numbers = genGrid(ctx.rng, size);
  let target = 1;
  let mistakes = 0;
  let cursor = Math.floor(numbers.length / 2);
  let elapsed = 0;
  let last = performance.now();
  let paused = false;
  let done = false;

  const find = h('div', { class: 'g-big', 'aria-live': 'polite' });
  const buttons = numbers.map((n, idx) => h('button', {
    type: 'button',
    tabindex: '-1',
    'aria-label': String(n),
    onclick: () => pick(idx),
  }, String(n)));
  const grid = h('div', {
    class: `schulte-grid${size >= 6 ? ' big' : ''}`,
    style: { gridTemplateColumns: `repeat(${size}, auto)` },
  }, buttons);
  root.append(h('div', { class: 'g-center' }, h('div', { class: 'muted' }, 'Find'), find, grid));

  const now = () => {
    const t = performance.now();
    if (!paused) elapsed += t - last;
    last = t;
    return elapsed;
  };
  const showTarget = () => { find.textContent = String(target); };
  const moveCursor = (idx) => {
    buttons[cursor].classList.remove('cursor');
    cursor = idx;
    buttons[cursor].classList.add('cursor');
  };

  function pick(idx) {
    if (paused || done) return;
    const btn = buttons[idx];
    if (numbers[idx] === target) {
      btn.classList.add('found');
      target += 1;
      if (target > numbers.length) return finish();
      showTarget();
    } else if (numbers[idx] > target) {
      mistakes += 1;
      btn.classList.add('wrong');
      setTimeout(() => btn.classList.remove('wrong'), 300);
    }
  }

  function finish() {
    done = true;
    const timeMs = Math.round(now());
    ctx.onFinish({ ...scoreRound({ size, timeMs, mistakes, difficulty: ctx.difficulty }), timeMs, difficulty: ctx.difficulty });
  }

  function onKey(e) {
    if (paused || done) return;
    const r = Math.floor(cursor / size);
    const c = cursor % size;
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      moveCursor(((r + dr + size) % size) * size + ((c + dc + size) % size));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(cursor);
    }
  }
  document.addEventListener('keydown', onKey);
  showTarget();
  moveCursor(cursor);

  return {
    pause() { now(); paused = true; grid.style.visibility = 'hidden'; },
    resume() { last = performance.now(); paused = false; grid.style.visibility = ''; },
    destroy() { done = true; document.removeEventListener('keydown', onKey); },
  };
}
