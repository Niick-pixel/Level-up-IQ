import { h, fmtMinutes, plural, clear } from '../ui.js';
import { GAMES, byId } from '../games/registry.js';
import { makeRng, localDateKey } from '../../shared/rng.js';

// A handful of games shown on Home, a different set each day (one per kind, roughly).
const FEATURE_POOLS = [
  ['stroop', 'schulte', 'flanker', 'go-no-go', 'visual-search', 'reaction-time', 'rsvp'],
  ['nback', 'digit-span', 'corsi', 'card-pairs', 'kims-game', 'memory-palace'],
  ['mental-math', 'game-24', 'countdown-numbers', 'fermi', 'sequences', 'probability', 'kakuro'],
  ['wordle', 'word-ladder', 'anagram', 'cryptogram', 'crossword', 'countdown-letters', 'rebus'],
  ['zebra', 'knights', 'mastermind', 'syllogism', 'fallacy', 'riddles', 'situation-puzzles'],
  ['mental-rotation', 'rush-hour', 'fifteen', 'map-quiz'],
  ['chess-puzzles', 'connect-four', 'nim', 'chess-engine'],
  ['trivia', 'flags', 'capitals', 'chronology', 'guess-article', 'magnitude', 'higher-lower'],
  ['tatham-solo', 'tatham-loopy', 'tatham-bridges', 'tatham-net', 'tatham-pattern', 'tatham-keen', 'tatham-lightup', 'tatham-tents'],
];

export async function renderHome(el) {
  const [kotd, summary, count, cards] = await Promise.all([
    window.api.keywordOfTheDay(),
    window.api.statsSummary(),
    window.api.keywordCount(),
    window.api.cardCount(),
  ]);
  const today = summary.today;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  async function randomAnything() {
    // Half the time a game, half the time a keyword
    if (Math.random() < 0.5) {
      const pool = GAMES.filter((g) => !(g.meta.needsCards && !cards));
      const g = pool[Math.floor(Math.random() * pool.length)];
      location.hash = `#/play/${g.meta.id}`;
    } else {
      const k = await window.api.randomKeyword({ mode: 'any' });
      location.hash = `#/keyword/${k.id}`;
    }
  }

  // Online extras load in the background and simply don't appear when offline.
  const extras = h('div', { class: 'grid', style: { marginTop: '14px' } });
  window.api.homeExtras().then(({ onThisDay, dailyPuzzle }) => {
    clear(extras);
    if (onThisDay) {
      extras.append(h(onThisDay.keywordId ? 'a' : 'div', { class: 'card', href: onThisDay.keywordId ? `#/keyword/${onThisDay.keywordId}` : null, style: { gridColumn: 'span 2' } },
        h('div', { class: 'eyebrow' }, `On this day · ${onThisDay.year < 0 ? `${-onThisDay.year} BC` : onThisDay.year}`),
        h('div', {}, onThisDay.text),
        h('div', { class: 'muted small', style: { marginTop: '6px' } }, onThisDay.keywordId ? 'Open the keyword →' : 'From Wikipedia')));
    }
    if (dailyPuzzle) {
      extras.append(h('button', { class: 'card', type: 'button', onclick: () => window.api.openExternal(dailyPuzzle.url) },
        h('div', { class: 'eyebrow' }, 'Daily chess puzzle'),
        h('div', {}, `Rated ${dailyPuzzle.rating}`),
        h('div', { class: 'muted small' }, 'Solve it on Lichess →')));
    }
  }).catch(() => {});

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, greeting),
        h('p', { class: 'muted' }, today.games
          ? `Today: ${plural(today.games, 'round')}, ${fmtMinutes(today.ms)} of thinking without AI.`
          : 'Nothing trained yet today. Ten minutes is plenty.'))),

    h('div', { class: 'grid', style: { gridTemplateColumns: '2fr 1fr' } },
      h('a', { class: 'card hero', href: '#/mix' },
        h('div', { class: 'eyebrow' }, 'Daily Mix'),
        h('div', { class: 'big' }, 'Warm up, focus, remember, think'),
        h('p', { class: 'muted' }, 'A short guided set: speed, math, memory and words, then the keyword of the day.')),
      h('a', { class: 'card hero', href: `#/keyword/${kotd.id}` },
        h('div', { class: 'eyebrow' }, 'Keyword of the day'),
        h('div', { class: 'big' }, kotd.term),
        h('p', { class: 'muted' }, kotd.domainLabel))),

    h('div', { class: 'grid', style: { marginTop: '14px' } },
      h('button', { class: 'card', type: 'button', onclick: randomAnything },
        h('div', { class: 'eyebrow' }, 'Random anything'),
        h('div', {}, 'Roll a game or a keyword')),
      h('a', { class: 'card', href: '#/keywords' },
        h('div', { class: 'eyebrow' }, 'Curiosity'),
        h('div', {}, `${count} keywords to explore`)),
      h('a', { class: 'card', href: '#/review' },
        h('div', { class: 'eyebrow' }, 'Review queue'),
        h('div', {}, cards ? `${plural(cards, 'card')} saved from your sessions` : 'Cards from keyword sessions land here')),
      h('a', { class: 'card', href: '#/watch' },
        h('div', { class: 'eyebrow' }, 'Watch later'),
        h('div', {}, 'Documentaries (coming soon)')),
      h('a', { class: 'card', href: '#/stats' },
        h('div', { class: 'eyebrow' }, 'Stats'),
        h('div', {}, `${plural(summary.totals.games, 'round')} · ${plural(summary.totals.keywords, 'keyword')} explored`))),

    extras,

    h('div', { class: 'row', style: { marginTop: '26px', justifyContent: 'space-between' } },
      h('h2', { style: { margin: 0 } }, 'Games for today'),
      h('a', { class: 'btn small', href: '#/games' }, `All ${GAMES.length} games →`)),
    h('div', { class: 'grid', style: { marginTop: '10px' } }, featured().map(({ meta }) => h('a', { class: 'card', href: `#/play/${meta.id}` },
      h('div', { class: 'eyebrow' }, meta.skills.join(' · ')),
      h('div', { class: 'kw-term' }, meta.name),
      h('div', { class: 'muted small' }, meta.blurb))))));
}

/** One game from each pool, chosen by today's date (so Home is stable through the day). */
function featured() {
  const rng = makeRng(`home:${localDateKey()}`);
  return FEATURE_POOLS.map((pool) => byId(rng.pick(pool))).filter(Boolean);
}
