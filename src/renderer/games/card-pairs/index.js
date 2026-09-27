import { meta, pairsFor, columnsFor, genDeck, scoreRound } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const pairs = pairsFor(ctx.difficulty);
  const cols = columnsFor(pairs);
  const deck = genDeck(ctx.rng, pairs);
  const time = clock();
  let open = [];
  let found = 0;
  let turns = 0;
  let busy = false;
  let cursor = 0;
  let done = false;
  let flipBack = 0;

  const tally = h('div', { class: 'muted small', 'aria-live': 'polite' });
  const cards = deck.map((c, i) => h('button', {
    class: 'pair-card', type: 'button', 'aria-label': 'Face-down card', tabindex: '-1',
    onclick: () => flip(i),
  }, h('span', { class: 'pair-face', 'aria-hidden': 'true' }, c.glyph)));
  const grid = h('div', { class: 'pair-grid', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } }, cards);
  root.append(h('div', { class: 'g-center' }, tally, grid));
  const update = () => { tally.textContent = `Turns: ${turns} · Pairs: ${found} / ${pairs}`; };
  update();

  function flip(i) {
    if (busy || done || open.includes(i) || cards[i].classList.contains('matched')) return;
    cards[i].classList.add('up');
    cards[i].setAttribute('aria-label', deck[i].name);
    open.push(i);
    if (open.length < 2) return;
    turns += 1;
    const [a, b] = open;
    if (deck[a].glyph === deck[b].glyph) {
      cards[a].classList.add('matched');
      cards[b].classList.add('matched');
      open = [];
      found += 1;
      update();
      if (found === pairs) finish();
      return;
    }
    update();
    busy = true;
    flipBack = setTimeout(() => {
      for (const k of open) { cards[k].classList.remove('up'); cards[k].setAttribute('aria-label', 'Face-down card'); }
      open = [];
      busy = false;
    }, 900);
  }

  function finish() {
    done = true;
    time.pause();
    const r = scoreRound({ pairs, turns, difficulty: ctx.difficulty });
    tally.textContent = `All pairs in ${turns} turns (par ${r.par}).`;
    setTimeout(() => ctx.onFinish({ ...r, timeMs: time.ms(), difficulty: ctx.difficulty }), 900);
  }

  const move = (i) => {
    cards[cursor].classList.remove('cursor');
    cursor = (i + cards.length) % cards.length;
    cards[cursor].classList.add('cursor');
  };
  function onKey(e) {
    if (done) return;
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (d) { e.preventDefault(); move(cursor + d); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(cursor); }
  }
  document.addEventListener('keydown', onKey);
  move(0);

  return {
    pause() { time.pause(); grid.style.visibility = 'hidden'; },
    resume() { time.resume(); grid.style.visibility = ''; },
    destroy() { done = true; clearTimeout(flipBack); document.removeEventListener('keydown', onKey); },
  };
}
