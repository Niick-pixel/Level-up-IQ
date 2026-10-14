import { meta, generate, candidates, nextStep, applyStep, scoreRound, TECHNIQUES, ROW, COL, BOX, PEERS, cellName } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

const bit = (d) => 1 << d;

export function start(root, ctx) {
  const d = ctx.difficulty;
  const time = clock();
  let destroyed = false;
  let paused = false;
  const card = h('div', { class: 'quiz-card wide' }, h('p', { class: 'muted' }, 'Making a puzzle with exactly one solution…'));
  root.append(card);
  let cleanup = () => {};

  // generating a hard puzzle can take a moment: let the message paint first
  setTimeout(() => {
    if (destroyed) return;
    const p = generate(ctx.rng, d);
    cleanup = play(p);
  }, 30);

  function play({ puzzle, solution, tier }) {
    const grid = puzzle.slice();
    const notes = new Array(81).fill(0);
    const given = puzzle.map(Boolean);
    const elims = new Set(); // "cell:digit" removed by hints, so hint steps build on each other
    let sel = puzzle.findIndex((v) => !v);
    let noteMode = false;
    let mistakes = 0;
    let hints = 0;
    let hintStep = null; // shown "where to look"; next press explains and applies
    let done = false;

    const cells = Array.from({ length: 81 }, (_, i) => h('button', {
      type: 'button', tabindex: '-1', class: `sd-cell${given[i] ? ' given' : ''}${COL(i) % 3 === 2 && COL(i) < 8 ? ' br' : ''}${ROW(i) % 3 === 2 && ROW(i) < 8 ? ' bb' : ''}`,
      onclick: () => select(i),
    }));
    const board = h('div', { class: 'sd-board', role: 'grid', 'aria-label': 'Sudoku grid' }, cells);
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const status = h('div', { class: 'muted small' });
    const noteBtn = h('button', { class: 'btn small', type: 'button', 'aria-pressed': 'false', onclick: () => toggleNotes() }, 'Notes (N)');
    const hintBtn = h('button', { class: 'btn small', type: 'button', onclick: hint }, 'Hint');
    const pad = h('div', { class: 'sd-pad' },
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('button', { class: 'btn', type: 'button', onclick: () => input(n) }, String(n))),
      h('button', { class: 'btn', type: 'button', 'aria-label': 'Erase', onclick: () => input(0) }, '⌫'));
    fill(card, h('div', { class: 'sd-layout' }, board, h('div', { class: 'sd-side' },
      h('div', { class: 'eyebrow' }, `Level ${d} · ${['', 'singles', 'locked candidates', 'pairs', 'triples, wings and fish'][tier]}`),
      status, pad,
      h('div', { class: 'row' }, noteBtn, hintBtn,
        h('button', { class: 'btn small', type: 'button', onclick: autoNotes, title: 'Fill every empty cell with its possible digits' }, 'Fill notes')),
      msg,
      h('p', { class: 'muted small' }, 'Arrows move · 1–9 place · N notes · Backspace erases.'))));

    function candidatesNow() {
      const c = candidates(grid);
      for (const key of elims) {
        const [cell, digit] = key.split(':').map(Number);
        c[cell] &= ~bit(digit);
      }
      return c;
    }

    function draw() {
      const v = grid[sel];
      for (let i = 0; i < 81; i++) {
        const el = cells[i];
        const wrong = grid[i] && grid[i] !== solution[i];
        el.classList.toggle('sel', i === sel);
        el.classList.toggle('peer', i !== sel && (ROW(i) === ROW(sel) || COL(i) === COL(sel) || BOX(i) === BOX(sel)));
        el.classList.toggle('same', Boolean(v) && grid[i] === v && i !== sel);
        el.classList.toggle('wrong', Boolean(wrong));
        el.classList.toggle('focus', Boolean(hintStep?.focus.includes(i)));
        if (grid[i]) {
          el.replaceChildren(String(grid[i]));
          el.setAttribute('aria-label', `${cellName(i)}: ${grid[i]}${given[i] ? ' (given)' : ''}`);
        } else if (notes[i]) {
          el.replaceChildren(h('span', { class: 'sd-notes' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('span', { class: v && n === v ? 'hit' : '' }, notes[i] & bit(n) ? String(n) : ''))));
          el.setAttribute('aria-label', `${cellName(i)}: notes ${[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => notes[i] & bit(n)).join(' ')}`);
        } else {
          el.replaceChildren();
          el.setAttribute('aria-label', `${cellName(i)}: empty`);
        }
      }
      const left = grid.filter((x, i) => !x || x !== solution[i]).length;
      status.textContent = `${left} cells to go · mistakes ${mistakes} · hints ${hints}`;
    }

    function select(i) {
      if (paused || done) return;
      sel = i;
      draw();
    }

    function toggleNotes(on = !noteMode) {
      noteMode = on;
      noteBtn.setAttribute('aria-pressed', String(on));
      noteBtn.classList.toggle('primary', on);
    }

    function input(n) {
      if (paused || done || given[sel]) return;
      hintStep = null;
      if (n === 0) { grid[sel] = 0; notes[sel] = 0; draw(); return; }
      if (noteMode && !grid[sel]) { notes[sel] ^= bit(n); draw(); return; }
      grid[sel] = n;
      notes[sel] = 0;
      if (n !== solution[sel]) {
        mistakes += 1;
        msg.textContent = `${n} doesn't go in ${cellName(sel)}.`;
        msg.className = 'g-msg bad';
      } else {
        msg.textContent = '';
        for (const j of PEERS[sel]) notes[j] &= ~bit(n); // tidy notes the placement rules out
      }
      draw();
      if (grid.every((x, i) => x === solution[i])) finish();
    }

    function autoNotes() {
      if (paused || done) return;
      const c = candidatesNow();
      for (let i = 0; i < 81; i++) if (!grid[i]) notes[i] = c[i];
      hints += 0.5;
      msg.textContent = 'Notes filled with every possible digit. Now look for cells and units with only one option.';
      msg.className = 'g-msg';
      draw();
    }

    function hint() {
      if (paused || done) return;
      const left = Math.ceil(ctx.hints.lockedFor() / 1000);
      if (left > 0) { msg.textContent = `Try on your own for ${left} more seconds.`; msg.className = 'g-msg'; return; }
      // a wrong digit first: logic can't start from a contradiction
      const wrong = grid.findIndex((x, i) => x && x !== solution[i]);
      if (wrong >= 0) {
        sel = wrong;
        msg.textContent = `First, ${cellName(wrong)} is wrong: ${grid[wrong]} doesn't go there.`;
        msg.className = 'g-msg bad';
        draw();
        return;
      }
      const c = candidatesNow();
      if (!hintStep) {
        hintStep = nextStep(grid, c);
        if (!hintStep) { msg.textContent = 'No step left that these techniques can find.'; return; }
        hints += 0.5;
        msg.textContent = `Look at the highlighted cells: there's a ${TECHNIQUES[hintStep.technique].name.toLowerCase()}. Press Hint again for the explanation.`;
        msg.className = 'g-msg';
        draw();
        return;
      }
      const step = hintStep;
      hintStep = null;
      hints += 0.5;
      msg.textContent = `${TECHNIQUES[step.technique].name}: ${step.text}`;
      msg.className = 'g-msg ok';
      if (step.kind === 'place') {
        sel = step.cell;
        grid[step.cell] = step.digit;
        notes[step.cell] = 0;
        for (const j of PEERS[step.cell]) notes[j] &= ~bit(step.digit);
      } else {
        for (const { cell, digit } of step.eliminations) {
          elims.add(`${cell}:${digit}`);
          notes[cell] &= ~bit(digit);
        }
      }
      draw();
      if (grid.every((x, i) => x === solution[i])) finish();
    }

    function finish() {
      done = true;
      const timeMs = time.ms();
      msg.textContent = 'Solved!';
      msg.className = 'g-msg ok';
      ctx.onFinish({ ...scoreRound({ d, timeMs, mistakes, hints, solved: true }), timeMs, difficulty: d });
    }

    function onKey(e) {
      if (paused || done || e.ctrlKey || e.metaKey || e.altKey) return;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
      if (moves[e.key] != null) {
        e.preventDefault();
        const r = ROW(sel); const c = COL(sel);
        const nr = (r + (moves[e.key] === -9 ? -1 : moves[e.key] === 9 ? 1 : 0) + 9) % 9;
        const nc = (c + (moves[e.key] === -1 ? -1 : moves[e.key] === 1 ? 1 : 0) + 9) % 9;
        select(nr * 9 + nc);
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        input(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        input(0);
      } else if (e.key.toLowerCase() === 'n') {
        toggleNotes();
      }
    }
    document.addEventListener('keydown', onKey);
    draw();
    return () => document.removeEventListener('keydown', onKey);
  }

  return {
    pause() { paused = true; time.pause(); card.style.visibility = 'hidden'; },
    resume() { paused = false; time.resume(); card.style.visibility = ''; },
    destroy() { destroyed = true; cleanup(); },
  };
}
