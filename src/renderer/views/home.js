import { h, fmtMinutes, plural } from '../ui.js';
import { GAMES } from '../games/registry.js';

export async function renderHome(el) {
  const [kotd, summary, count] = await Promise.all([
    window.api.keywordOfTheDay(),
    window.api.statsSummary(),
    window.api.keywordCount(),
  ]);
  const today = summary.today;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  async function randomAnything() {
    // Half the time a game, half the time a keyword
    if (Math.random() < 0.5) {
      const g = GAMES[Math.floor(Math.random() * GAMES.length)];
      location.hash = `#/play/${g.meta.id}`;
    } else {
      const k = await window.api.randomKeyword({ mode: 'any' });
      location.hash = `#/keyword/${k.id}`;
    }
  }

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
        h('div', {}, 'Spaced repetition (coming soon)')),
      h('a', { class: 'card', href: '#/watch' },
        h('div', { class: 'eyebrow' }, 'Watch later'),
        h('div', {}, 'Documentaries (coming soon)')),
      h('a', { class: 'card', href: '#/stats' },
        h('div', { class: 'eyebrow' }, 'Stats'),
        h('div', {}, `${plural(summary.totals.games, 'round')} · ${plural(summary.totals.keywords, 'keyword')} explored`))),

    h('h2', { style: { marginTop: '26px' } }, 'Games'),
    h('div', { class: 'grid' }, GAMES.map(({ meta }) => h('a', { class: 'card', href: `#/play/${meta.id}` },
      h('div', { class: 'eyebrow' }, meta.skills.join(' · ')),
      h('div', { class: 'kw-term' }, meta.name),
      h('div', { class: 'muted small' }, meta.blurb))))));
}
