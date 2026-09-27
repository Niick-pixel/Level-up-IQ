import { meta, generate } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const time = clock();
  let done = false;
  let hints = 0;
  let dir = 'across';
  let p = null;
  const inputs = {};
  const wrap = h('div', { class: 'xw-wrap' }, h('p', { class: 'muted' }, 'Building the grid…'));
  root.append(wrap);
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const hintBtn = h('button', { class: 'btn small', type: 'button', onclick: hint }, 'Reveal a letter');
  const giveUp = h('button', { class: 'btn small', type: 'button', onclick: () => finish(false) }, 'Show solution');
  let lockTick = 0;

  fetch(new URL('../../../assets/keywords.json', import.meta.url)).then((r) => r.json()).then((bank) => {
    const labels = new Map(bank.domains.map((d) => [d.id, d.label]));
    p = generate(ctx.rng, ctx.difficulty, bank.keywords.map((k) => ({ ...k, domainLabel: labels.get(k.domain) })));
    const R = p.grid.length, C = p.grid[0].length;
    const numbers = {};
    for (const e of p.entries) numbers[`${e.r},${e.c}`] = e.num;
    const grid = h('div', { class: 'xw', style: { gridTemplateColumns: `repeat(${C}, 36px)` } });
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        if (!p.grid[r][c]) { grid.append(h('div', { class: 'xw-block' })); continue; }
        const key = `${r},${c}`;
        const input = h('input', { class: 'xw-in', maxlength: '1', 'aria-label': `Row ${r + 1}, column ${c + 1}` });
        input.addEventListener('keydown', (e) => onKey(e, r, c));
        input.addEventListener('input', () => {
          input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
          input.classList.remove('wrong');
          if (input.value) move(r, c, 1);
        });
        input.addEventListener('click', () => { if (document.activeElement === input) dir = dir === 'across' ? 'down' : 'across'; });
        inputs[key] = input;
        grid.append(h('div', { class: 'xw-cell' }, numbers[key] ? h('span', { class: 'xw-num' }, String(numbers[key])) : null, input));
      }
    }
    const list = (d) => h('div', {}, h('h3', {}, d === 'across' ? 'Across' : 'Down'),
      h('ol', { class: 'xw-clues' }, p.entries.filter((e) => e.dir === d).map((e) => h('li', { value: String(e.num) }, `${e.clue} (${e.word.length})`))));
    wrap.replaceChildren(h('div', { class: 'xw-layout' }, grid, h('div', {}, list('across'), list('down'))),
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn primary', type: 'button', onclick: check }, 'Check'), hintBtn, giveUp), msg);
    Object.values(inputs)[0]?.focus();
    lockTick = setInterval(() => {
      const left = Math.ceil(ctx.hints.lockedFor() / 1000);
      for (const [b, label] of [[hintBtn, 'Reveal a letter'], [giveUp, 'Show solution']]) {
        b.disabled = left > 0 || done;
        b.textContent = left > 0 ? `${label} (${left}s)` : label;
      }
    }, 250);
  }).catch((e) => wrap.replaceChildren(h('p', { class: 'g-msg bad' }, e.message)));

  function move(r, c, step) {
    const [dr, dc] = dir === 'across' ? [0, step] : [step, 0];
    const next = inputs[`${r + dr},${c + dc}`];
    if (next) next.focus();
  }
  function onKey(e, r, c) {
    const arrows = { ArrowLeft: ['across', 0, -1], ArrowRight: ['across', 0, 1], ArrowUp: ['down', -1, 0], ArrowDown: ['down', 1, 0] };
    if (arrows[e.key]) {
      e.preventDefault();
      const [d, dr, dc] = arrows[e.key];
      dir = d;
      inputs[`${r + dr},${c + dc}`]?.focus();
    } else if (e.key === 'Backspace' && !e.currentTarget.value) {
      e.preventDefault();
      move(r, c, -1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      dir = dir === 'across' ? 'down' : 'across';
    }
  }
  function check() {
    if (done || !p) return;
    let wrong = 0, empty = 0;
    for (const [key, input] of Object.entries(inputs)) {
      const [r, c] = key.split(',').map(Number);
      if (!input.value) empty += 1;
      else if (input.value !== p.grid[r][c]) { wrong += 1; input.classList.add('wrong'); }
    }
    if (!wrong && !empty) return finish(true);
    msg.textContent = `${wrong} wrong, ${empty} empty.`;
    msg.className = 'g-msg bad';
  }
  function hint() {
    if (done || ctx.hints.lockedFor() > 0) return;
    const open = Object.entries(inputs).filter(([key, i]) => i.value !== p.grid[key.split(',')[0]][key.split(',')[1]]);
    if (!open.length) return;
    const [key, input] = ctx.rng.pick(open);
    const [r, c] = key.split(',').map(Number);
    input.value = p.grid[r][c];
    input.disabled = true;
    input.classList.add('given');
    hints += 1;
  }
  function finish(solved) {
    if (done || !p) return;
    done = true;
    clearInterval(lockTick);
    time.pause();
    for (const [key, input] of Object.entries(inputs)) {
      const [r, c] = key.split(',').map(Number);
      input.value = p.grid[r][c];
      input.disabled = true;
    }
    msg.textContent = solved ? 'Solved!' : 'Solution shown.';
    msg.className = `g-msg ${solved ? 'ok' : ''}`;
    const cells = Object.keys(inputs).length;
    const performance = solved ? Math.max(0.2, 1 - (hints / cells) * 3) : 0;
    setTimeout(() => ctx.onFinish({ score: Math.round(performance * cells * 25), accuracy: solved ? 1 : 0, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 1500);
  }

  return {
    pause() { time.pause(); root.style.visibility = 'hidden'; },
    resume() { time.resume(); root.style.visibility = ''; },
    destroy() { done = true; clearInterval(lockTick); },
  };
}
