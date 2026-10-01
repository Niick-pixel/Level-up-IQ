import { meta, deck, boardSize, target, findSets, dealBoard, refill, isSet, describe, scoreRound } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

const svgNs = 'http://www.w3.org/2000/svg';
const PATHS = [
  'M10 4 H30 A6 6 0 0 1 30 16 H10 A6 6 0 0 1 10 4 Z', // oval
  'M20 2 L38 10 L20 18 L2 10 Z', // diamond
  'M4 13 C6 2 16 4 20 7 C24 10 30 2 36 5 C38 14 28 16 22 13 C16 10 10 18 4 13 Z', // wave
];

function symbol(card) {
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 40 20');
  svg.setAttribute('class', `set-sym c${card[3]} f${card[2]}`);
  const p = document.createElementNS(svgNs, 'path');
  p.setAttribute('d', PATHS[card[1]]);
  svg.append(p);
  return svg;
}

export function start(root, ctx) {
  const d = ctx.difficulty;
  const pile = ctx.rng.shuffle(deck(d));
  let board = dealBoard(ctx.rng, pile, boardSize(d));
  let picked = [];
  let found = 0;
  let mistakes = 0;
  let hints = 0;
  let done = false;
  const time = clock();
  const goal = target(d);
  const letters = 'abcdefghijklmno';

  const status = h('div', { class: 'muted', 'aria-live': 'polite' });
  const grid = h('div', { class: `set-grid n${board.length}` });
  const hintBtn = h('button', { class: 'btn small', type: 'button', onclick: hint }, 'Hint');
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  root.append(h('div', { class: 'g-center' }, status, grid, h('div', { class: 'row' }, hintBtn), msg));

  function draw() {
    status.textContent = `Sets found: ${found} of ${goal}`;
    fill(grid, board.map((c, i) => (c ? h('button', {
      type: 'button', class: `set-card${picked.includes(i) ? ' picked' : ''}`, 'aria-pressed': String(picked.includes(i)),
      'aria-label': `${letters[i].toUpperCase()}: ${describe(c)}`, onclick: () => toggle(i),
    }, h('span', { class: 'set-key' }, letters[i].toUpperCase()), Array.from({ length: c[0] + 1 }, () => symbol(c))) : h('div', { class: 'set-card empty' }))));
  }

  function toggle(i) {
    if (done || !board[i]) return;
    picked = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i];
    if (picked.length === 3) return check();
    draw();
  }

  function check() {
    const [a, b, c] = picked.map((i) => board[i]);
    if (isSet(a, b, c)) {
      found += 1;
      msg.textContent = 'Set!';
      msg.className = 'g-msg ok';
      const used = picked;
      picked = [];
      if (found >= goal) return finish();
      board = refill(ctx.rng, board, used, pile);
      if (!findSets(board).length) return finish(); // pile ran out
    } else {
      mistakes += 1;
      const why = ['number', 'shape', 'fill', 'colour'].filter((_, k) => (a[k] + b[k] + c[k]) % 3 !== 0);
      msg.textContent = `Not a set: the ${why.join(' and ')} ${why.length > 1 ? 'are' : 'is'} two the same, one different.`;
      msg.className = 'g-msg bad';
      picked = [];
    }
    draw();
  }

  function hint() {
    if (done || ctx.hints.lockedFor() > 0) return;
    const sets = findSets(board);
    if (!sets.length) return;
    hints += 1;
    picked = [sets[0][0]];
    msg.textContent = 'This card is part of a set.';
    msg.className = 'g-msg';
    draw();
  }

  function finish() {
    done = true;
    draw();
    const timeMs = time.ms();
    ctx.onFinish({ ...scoreRound({ d, found, mistakes, hints, timeMs }), timeMs, difficulty: d });
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const i = letters.indexOf(e.key.toLowerCase());
    if (i >= 0 && i < board.length) { e.preventDefault(); toggle(i); }
  }
  document.addEventListener('keydown', onKey);
  const lockTick = setInterval(() => {
    const left = Math.ceil(ctx.hints.lockedFor() / 1000);
    hintBtn.disabled = left > 0 || done;
    hintBtn.textContent = left > 0 ? `Hint (${left}s)` : 'Hint';
  }, 250);
  draw();

  return {
    pause() { time.pause(); grid.style.visibility = 'hidden'; },
    resume() { time.resume(); grid.style.visibility = ''; },
    destroy() { done = true; clearInterval(lockTick); document.removeEventListener('keydown', onKey); },
  };
}
