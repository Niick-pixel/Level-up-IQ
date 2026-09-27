import { meta, generate } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const p = generate(ctx.rng, ctx.difficulty);
  const N = p.white.length;
  const time = clock();
  const entries = {};
  const inputs = {};
  let done = false;
  let checks = 0;

  const clue = (r, c, dir) => p.runs.find((run) => run.dir === dir && run.head[0] === r && run.head[1] === c)?.sum;
  const grid = h('div', { class: 'kakuro', style: { gridTemplateColumns: `repeat(${N}, 44px)` } });
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const key = `${r},${c}`;
      if (!p.white[r][c]) {
        const down = clue(r, c, 'down');
        const across = clue(r, c, 'across');
        grid.append(h('div', { class: `kk-block${down || across ? ' clue' : ''}` },
          down ? h('span', { class: 'kk-down', title: `Down: ${down}` }, String(down)) : null,
          across ? h('span', { class: 'kk-across', title: `Across: ${across}` }, String(across)) : null));
      } else if (p.givens[key]) {
        entries[key] = p.givens[key];
        grid.append(h('div', { class: 'kk-cell given' }, String(p.givens[key])));
      } else {
        const input = h('input', { class: 'kk-cell', maxlength: '1', inputmode: 'numeric', 'aria-label': `Row ${r}, column ${c}` });
        input.addEventListener('keydown', (e) => onKey(e, r, c));
        input.addEventListener('input', () => {
          const d = input.value.replace(/[^1-9]/g, '').slice(-1);
          input.value = d;
          if (d) entries[key] = Number(d); else delete entries[key];
          input.classList.remove('wrong');
        });
        inputs[key] = input;
        grid.append(input);
      }
    }
  }
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const checkBtn = h('button', { class: 'btn primary', type: 'button', onclick: check }, 'Check');
  const revealBtn = h('button', { class: 'btn small', type: 'button', onclick: reveal }, 'Show solution');
  root.append(h('div', { class: 'g-center' }, grid, h('div', { class: 'row' }, checkBtn, revealBtn), msg));
  Object.values(inputs)[0]?.focus();

  function onKey(e, r, c) {
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (!moves[e.key]) return;
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < N && cc >= 0 && cc < N; rr += dr, cc += dc) {
      if (inputs[`${rr},${cc}`]) { inputs[`${rr},${cc}`].focus(); return; }
    }
  }

  const lockTick = setInterval(() => {
    const left = Math.ceil(ctx.hints.lockedFor() / 1000);
    revealBtn.disabled = left > 0 || done;
    revealBtn.textContent = left > 0 ? `Show solution (${left}s)` : 'Show solution';
  }, 250);

  function check() {
    if (done) return;
    checks += 1;
    let wrong = 0, empty = 0;
    for (const [key, input] of Object.entries(inputs)) {
      if (!entries[key]) { empty += 1; continue; }
      if (entries[key] !== p.solution[key]) { wrong += 1; input.classList.add('wrong'); }
    }
    if (!wrong && !empty) return finish(true);
    msg.textContent = `${wrong ? `${wrong} wrong (marked)` : ''}${wrong && empty ? ', ' : ''}${empty ? `${empty} empty` : ''}.`;
    msg.className = 'g-msg bad';
  }
  function reveal() {
    if (done || ctx.hints.lockedFor() > 0) return;
    for (const [key, input] of Object.entries(inputs)) { input.value = String(p.solution[key]); input.disabled = true; }
    finish(false);
  }
  function finish(solved) {
    done = true;
    clearInterval(lockTick);
    time.pause();
    Object.values(inputs).forEach((i) => { i.disabled = true; });
    msg.textContent = solved ? 'Solved!' : 'Solution shown.';
    msg.className = `g-msg ${solved ? 'ok' : ''}`;
    const cells = Object.keys(inputs).length;
    const par = 30 + cells * 12;
    const speed = Math.min(1, par / Math.max(1, time.ms() / 1000));
    const performance = solved ? Math.max(0.3, 0.6 + 0.4 * speed - (checks - 1) * 0.08) : 0;
    setTimeout(() => ctx.onFinish({ score: Math.round(performance * cells * 40), accuracy: solved ? 1 : 0, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 1000);
  }

  return {
    pause() { time.pause(); root.style.visibility = 'hidden'; },
    resume() { time.resume(); root.style.visibility = ''; },
    destroy() { done = true; clearInterval(lockTick); },
  };
}
