import { meta, makeKey, encode, pickQuote, freeLetters } from './logic.js';
import { QUOTES } from '../_data/quotes.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const time = clock();
  const quote = pickQuote(ctx.rng, ctx.difficulty, QUOTES);
  const key = makeKey(ctx.rng);
  const plain = quote.text.toUpperCase();
  const cipher = encode(quote.text, key);
  const inverse = Object.fromEntries(Object.entries(key).map(([p, c]) => [c, p]));
  const guess = {}; // cipher letter → guessed plain letter
  const boxes = {}; // cipher letter → inputs
  let hints = 0;
  let done = false;

  // free letters: the most frequent cipher letters
  const freq = {};
  for (const c of cipher) if (/[A-Z]/.test(c)) freq[c] = (freq[c] || 0) + 1;
  const given = new Set(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, freeLetters(ctx.difficulty)).map(([c]) => c));
  for (const c of given) guess[c] = inverse[c];

  const words = cipher.split(' ').map((w) => h('span', { class: 'cg-word' }, [...w].map((c) => {
    if (!/[A-Z]/.test(c)) return h('span', { class: 'cg-punct' }, c);
    const input = h('input', { class: `cg-in${given.has(c) ? ' given' : ''}`, maxlength: '1', value: guess[c] || '', disabled: given.has(c) || null, 'aria-label': `Cipher letter ${c}` });
    (boxes[c] ||= []).push(input);
    input.addEventListener('input', () => set(c, input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1)));
    input.addEventListener('focus', () => highlight(c, true));
    input.addEventListener('blur', () => highlight(c, false));
    return h('span', { class: 'cg-cell' }, input, h('small', {}, c));
  })));
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const hintBtn = h('button', { class: 'btn small', type: 'button', onclick: hint }, 'Hint');
  const giveUp = h('button', { class: 'btn small', type: 'button', onclick: () => finish(false) }, 'Show solution');
  root.append(h('div', { class: 'quiz-card' }, h('div', { class: 'cg' }, words), h('div', { class: 'row', style: { marginTop: '12px' } }, hintBtn, giveUp), msg));
  root.querySelector('.cg-in:not([disabled])')?.focus();

  function highlight(c, on) { boxes[c].forEach((b) => b.classList.toggle('same', on)); }
  function set(c, letter) {
    if (done) return;
    if (letter) guess[c] = letter; else delete guess[c];
    boxes[c].forEach((b) => { b.value = letter; });
    // flag a letter used for two different cipher letters
    const counts = {};
    for (const v of Object.values(guess)) counts[v] = (counts[v] || 0) + 1;
    for (const [cc, list] of Object.entries(boxes)) list.forEach((b) => b.classList.toggle('dup', Boolean(guess[cc] && counts[guess[cc]] > 1)));
    const decoded = [...cipher].map((ch) => (/[A-Z]/.test(ch) ? guess[ch] || '_' : ch)).join('');
    if (decoded === plain) finish(true);
  }
  function hint() {
    if (done || ctx.hints.lockedFor() > 0) return;
    const wrong = Object.keys(boxes).filter((c) => guess[c] !== inverse[c]);
    if (!wrong.length) return;
    const c = ctx.rng.pick(wrong);
    hints += 1;
    boxes[c].forEach((b) => { b.disabled = true; b.classList.add('given'); });
    set(c, inverse[c]);
  }
  const lockTick = setInterval(() => {
    const left = Math.ceil(ctx.hints.lockedFor() / 1000);
    for (const [b, label] of [[hintBtn, 'Hint'], [giveUp, 'Show solution']]) {
      b.disabled = left > 0 || done;
      b.textContent = left > 0 ? `${label} (${left}s)` : label;
    }
  }, 250);
  function finish(solved) {
    if (done) return;
    done = true;
    clearInterval(lockTick);
    time.pause();
    Object.entries(boxes).forEach(([c, list]) => list.forEach((b) => { b.value = inverse[c]; b.disabled = true; }));
    msg.textContent = `${solved ? 'Cracked! ' : ''}“${quote.text}” — ${quote.by}`;
    msg.className = `g-msg ${solved ? 'ok' : ''}`;
    const letters = Object.keys(boxes).length;
    const par = 40 + letters * 12;
    const speed = Math.min(1, par / Math.max(1, time.ms() / 1000));
    const performance = solved ? Math.max(0.2, 0.6 + 0.4 * speed - hints * 0.12) : 0;
    setTimeout(() => ctx.onFinish({ score: Math.round(performance * letters * 30), accuracy: solved ? 1 : 0, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 2500);
  }

  return {
    pause() { time.pause(); root.style.visibility = 'hidden'; },
    resume() { time.resume(); root.style.visibility = ''; },
    destroy() { done = true; clearInterval(lockTick); },
  };
}
