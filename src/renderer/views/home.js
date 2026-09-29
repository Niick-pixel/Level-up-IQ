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
  const [kotd, summary, count, cards, watch, streak, srs, settings, update] = await Promise.all([
    window.api.keywordOfTheDay(),
    window.api.statsSummary(),
    window.api.keywordCount(),
    window.api.cardCount(),
    window.api.watchList(),
    window.api.streak(),
    window.api.srsStats(),
    window.api.getSettings(),
    window.api.updaterState().catch(() => null),
  ]);
  const dueToday = srs.dueNow + srs.newAvailable;
  const toWatch = watch.filter((v) => !v.watchedAt).length;
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
    update?.status === 'ready' ? updateBanner(update) : null,
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, greeting),
        h('p', { class: 'muted' }, today.games
          ? `Today: ${plural(today.games, 'round')}, ${fmtMinutes(today.ms)} of thinking without AI.`
          : 'Nothing trained yet today. Ten minutes is plenty.')),
      settings.showStreaks && streak.current ? h('div', { class: 'streak', title: 'Days trained in a row. Rest days are allowed and don’t break it.' },
        h('strong', {}, `${streak.current}-day streak`), h('span', { class: 'muted small' }, streak.trainedToday ? '' : ' · train today to keep it',
          streak.restLeft ? ` · ${plural(streak.restLeft, 'rest day')} left this week` : '')) : ''),

    h('div', { class: 'grid', style: { gridTemplateColumns: '2fr 1fr' } },
      h('a', { class: 'card hero', href: '#/mix' },
        h('div', { class: 'eyebrow' }, 'Daily Mix'),
        h('div', { class: 'big' }, 'Warm up, focus, remember, think'),
        h('p', { class: 'muted' }, 'Warm-up, logic, memory, today’s keyword and something to think about, leaning towards your weaker skills.')),
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
        h('div', {}, `${count.toLocaleString('en')} keywords to explore`)),
      h('a', { class: `card${dueToday ? ' due' : ''}`, href: '#/review' },
        h('div', { class: 'eyebrow' }, 'Review'),
        h('div', {}, dueToday ? `${plural(dueToday, 'card')} to review today` : cards ? 'All caught up' : 'Cards from keyword sessions land here')),
      h('a', { class: 'card', href: '#/watch' },
        h('div', { class: 'eyebrow' }, 'Watch and learn'),
        h('div', {}, toWatch ? `${plural(toWatch, 'video')} in your list` : 'Documentaries from 36 curated channels')),
      h('a', { class: 'card', href: '#/map' },
        h('div', { class: 'eyebrow' }, 'Curiosity map'),
        h('div', {}, summary.totals.keywords ? `${plural(summary.totals.keywords, 'topic')} explored` : 'Grows as you explore')),
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

/** A quiet note when a downloaded update is waiting (no pop-ups: it also installs when you quit). */
function updateBanner(u) {
  return h('div', { class: 'update-banner', role: 'status' },
    h('span', {}, `Mind Gym ${u.version} is ready. It installs when you quit, or now.`),
    h('button', { class: 'btn small primary', type: 'button', onclick: () => window.api.installUpdate() }, 'Restart to update'));
}
