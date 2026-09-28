// Spaced repetition (FSRS): recall the answer, reveal it, and grade yourself honestly. The
// scheduler brings each card back just before you'd forget it.
import { h, fill, toast, plural } from '../ui.js';

const TYPE_LABEL = { fact: 'Fact', video: 'Video', vocab: 'Word', keyword: 'Keyword' };
const GRADES = [
  [1, 'Again', 'Forgot it'],
  [2, 'Hard', 'Got it, with effort'],
  [3, 'Good', 'Got it'],
  [4, 'Easy', 'Instantly'],
];

/**
 * A review session. Used by the Review page and as a Daily Mix step.
 * @param el        where to draw
 * @param opts      { limit?, onDone?(summary) }
 * @returns cleanup function
 */
export function reviewSession(el, { limit = 50, onDone = null } = {}) {
  let queue = [];
  let i = 0;
  let shownAt = 0;
  let revealed = false;
  let done = false;
  const tally = { again: 0, total: 0 };
  const card = h('div', { class: 'card hero review-card' }, h('p', { class: 'muted' }, 'Loading your cards…'));
  el.append(card);

  window.api.reviewQueue(limit).then((q) => {
    queue = q;
    if (!queue.length) return finish(true);
    show();
  });

  function show() {
    revealed = false;
    shownAt = performance.now();
    const c = queue[i];
    const answer = h('div', { class: 'review-back', hidden: true }, c.back,
      c.source ? h('div', { class: 'muted small', style: { marginTop: '6px' } }, c.source.startsWith('https://') ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.api.openExternal(c.source); } }, 'Source') : `Source: ${c.source}`) : '');
    const grades = h('div', { class: 'review-grades', hidden: true }, GRADES.map(([g, label, hint]) => h('button', {
      class: `btn grade g${g}`, type: 'button', title: hint, onclick: () => grade(g),
    }, h('kbd', {}, String(g)), ` ${label}`, h('span', { class: 'muted small grade-next' }, c.next[g]))));
    const revealBtn = h('button', { class: 'btn primary', type: 'button', onclick: reveal }, 'Show answer (Space)');
    fill(card,
      h('div', { class: 'row review-meta' },
        h('span', { class: 'chip' }, TYPE_LABEL[c.type] || 'Card'),
        c.state === 'new' ? h('span', { class: 'chip' }, 'New') : '',
        h('span', { class: 'spacer' }),
        h('span', { class: 'muted small' }, `${i + 1} / ${queue.length}`)),
      h('h2', { class: 'review-front' }, c.front),
      h('p', { class: 'muted small' }, 'Answer in your head (or out loud) first, then check.'),
      revealBtn, answer, grades);
    revealBtn.focus();
    card.reveal = () => { revealBtn.remove(); answer.hidden = false; grades.hidden = false; revealed = true; grades.querySelector('.g3').focus(); };
  }
  const reveal = () => card.reveal?.();

  async function grade(g) {
    if (!revealed || done) return;
    revealed = false;
    const c = queue[i];
    try {
      await window.api.reviewCard(c.id, g, performance.now() - shownAt);
    } catch (err) {
      toast(`Couldn’t save that review: ${err.message}`);
    }
    tally.total += 1;
    if (g === 1) tally.again += 1;
    i += 1;
    if (i < queue.length) show(); else finish(false);
  }

  async function finish(empty) {
    done = true;
    const st = await window.api.srsStats();
    const summary = { reviewed: tally.total, again: tally.again };
    const next = st.forecast.findIndex((n, d) => d > 0 && n > 0);
    fill(card,
      h('h2', {}, empty ? 'Nothing due right now' : 'Done for now'),
      empty
        ? h('p', {}, st.total ? 'Every card is scheduled for later. Come back tomorrow.' : 'Cards come from keyword sessions (key facts) and videos you’ve watched (your own summaries).')
        : h('p', {}, `${plural(tally.total, 'card')} reviewed${tally.again ? `, ${tally.again} to see again soon` : ''}.`),
      st.forecast[0] ? h('p', { class: 'muted' }, `${plural(st.forecast[0], 'card')} you’re still learning will come back later today.`) : '',
      next > 0 ? h('p', { class: 'muted' }, `Next: ${plural(st.forecast[next], 'card')} ${next === 1 ? 'tomorrow' : `in ${next} days`}.`) : '',
      onDone ? h('button', { class: 'btn primary', type: 'button', onclick: () => onDone(summary) }, 'Continue') : '');
    if (onDone) card.querySelector('.btn.primary')?.focus();
  }

  const onKey = (e) => {
    if (done || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!revealed && (e.key === ' ' || e.key === 'Enter') && queue.length) { e.preventDefault(); reveal(); return; }
    const n = Number(e.key);
    if (revealed && n >= 1 && n <= 4) { e.preventDefault(); grade(n); }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}

export async function renderReview(el) {
  const st = await window.api.srsStats();
  const page = h('div', { class: 'page' });
  el.append(page);
  page.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Review'), h('a', { class: 'btn small', href: '#/cards' }, `All cards (${st.total})`)),
    h('p', { class: 'muted' }, `${plural(st.dueNow, 'card')} due, ${plural(st.newAvailable, 'new card')} available today. Spaced repetition (FSRS) brings each card back right before you’d forget it.`));
  return reviewSession(page);
}

/** Every card, with delete (for cards that turned out wrong or useless). */
export async function renderCards(el) {
  const cards = await window.api.allCards();
  const list = h('ul', { class: 'cards-list' });
  const draw = (items) => fill(list, items.map((c) => h('li', {},
    h('div', { class: 'row' }, h('strong', { style: { flex: 1 } }, c.front),
      h('span', { class: 'muted small' }, c.due ? `due ${new Date(c.due).toLocaleDateString()}` : 'new'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: async () => {
        if (!confirm('Delete this card?')) return;
        await window.api.deleteCard(c.id);
        draw(items.filter((x) => x.id !== c.id));
      } }, 'Delete')),
    h('div', { class: 'muted' }, c.back))));
  draw(cards);
  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', {}, 'All cards'), h('a', { class: 'btn small', href: '#/review' }, 'Review now')),
    cards.length ? list : h('p', { class: 'muted' }, 'No cards yet.')));
}
