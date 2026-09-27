import { meta, score, MAX_TRIES } from './logic.js';
import { loadWordPack } from '../_engine/words.js';
import { h, clear, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };
const MARK = { hit: '✓', near: '~', miss: '·' };

export function start(root, ctx) {
  const time = clock();
  let paused = false;
  let over = false;
  let onKey = null;
  const wrap = h('div', { class: 'g-center' }, h('p', { class: 'muted' }, 'Loading words…'));
  root.append(wrap);

  loadWordPack().then((pack) => {
    const answer = ctx.rng.pick(pack.common5);
    const valid = new Set(pack.valid5);
    const rows = [];
    let current = '';
    const board = h('div', { class: 'wordle' });
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const keyState = {};
    const keys = h('div', { class: 'kb' });
    fill(wrap, board, msg, keys);

    function draw() {
      clear(board);
      for (let r = 0; r < MAX_TRIES; r++) {
        const row = rows[r];
        const letters = row ? row.word : r === rows.length ? current.padEnd(5) : '     ';
        board.append(h('div', { class: 'wd-row' }, [...letters].map((ch, i) => h('span', {
          class: `wd-cell ${row ? row.res[i] : ''}`, 'aria-label': row ? `${ch} ${row.res[i]}` : ch,
        }, ch.trim() ? ch.toUpperCase() : '', row ? h('small', {}, MARK[row.res[i]]) : null))));
      }
      fill(keys, ...['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((line, li) => h('div', { class: 'kb-row' },
        li === 2 ? h('button', { class: 'kb-key wide', type: 'button', onclick: () => press('Enter') }, 'Enter') : null,
        [...line].map((ch) => h('button', { class: `kb-key ${keyState[ch] || ''}`, type: 'button', onclick: () => press(ch) }, ch.toUpperCase())),
        li === 2 ? h('button', { class: 'kb-key wide', type: 'button', onclick: () => press('Backspace') }, '⌫') : null)));
    }

    function press(k) {
      if (over || paused) return;
      if (k === 'Enter') return submit();
      if (k === 'Backspace') current = current.slice(0, -1);
      else if (/^[a-z]$/.test(k) && current.length < 5) current += k;
      msg.textContent = '';
      draw();
    }
    function submit() {
      if (current.length < 5) { msg.textContent = 'Five letters, please.'; return; }
      if (!valid.has(current)) { msg.textContent = `“${current}” isn't in the word list.`; msg.className = 'g-msg bad'; return; }
      const res = score(answer, current);
      rows.push({ word: current, res });
      [...current].forEach((ch, i) => {
        const rank = { miss: 1, near: 2, hit: 3 };
        if (!keyState[ch] || rank[res[i]] > rank[keyState[ch]]) keyState[ch] = res[i];
      });
      const won = current === answer;
      current = '';
      draw();
      if (won || rows.length >= MAX_TRIES) {
        over = true;
        time.pause();
        msg.textContent = won ? `Got it in ${rows.length}!` : `The word was ${answer.toUpperCase()}.`;
        msg.className = `g-msg ${won ? 'ok' : 'bad'}`;
        const performance = won ? Math.min(1, 0.4 + (MAX_TRIES - rows.length + 1) * 0.12) : 0;
        setTimeout(() => ctx.onFinish({ score: Math.round(performance * 600), accuracy: won ? 1 : 0, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 1200);
      }
    }
    onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace') { e.preventDefault(); press(e.key); }
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    document.addEventListener('keydown', onKey);
    draw();
  });

  return {
    pause() { paused = true; time.pause(); wrap.style.visibility = 'hidden'; },
    resume() { paused = false; time.resume(); wrap.style.visibility = ''; },
    destroy() { over = true; if (onKey) document.removeEventListener('keydown', onKey); },
  };
}
