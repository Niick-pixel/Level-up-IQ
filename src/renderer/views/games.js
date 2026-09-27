import { h } from '../ui.js';
import { GAMES } from '../games/registry.js';
import { SKILLS, SKILL_LABELS } from '../../shared/game-contract.js';
import { parseSeedCode } from '../../shared/rng.js';

export function renderGames(el) {
  const seedInput = h('input', { type: 'text', placeholder: 'e.g. stroop:4:k9x2mf', 'aria-label': 'Seed code' });
  const seedMsg = h('span', { class: 'muted small' });
  const openSeed = () => {
    const s = parseSeedCode(seedInput.value);
    if (!s || !GAMES.some((g) => g.meta.id === s.gameId)) {
      seedMsg.textContent = 'That isn\'t a valid seed code.';
      return;
    }
    location.hash = `#/play/${s.gameId}?d=${s.difficulty}&seed=${encodeURIComponent(s.seed)}`;
  };
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') openSeed(); });

  const tatham = GAMES.filter((g) => g.meta.id.startsWith('tatham-'));
  const own = GAMES.filter((g) => !g.meta.id.startsWith('tatham-'));
  const sections = [
    ...SKILLS.map((skill) => ({ title: SKILL_LABELS[skill], games: own.filter((g) => g.meta.skills[0] === skill) })),
    { title: 'Simon Tatham’s Portable Puzzle Collection', note: 'Classic logic puzzles by Simon Tatham and contributors (MIT licence).', games: tatham },
  ].filter((x) => x.games.length);

  const card = ({ meta }) => h('a', { class: 'card', href: `#/play/${meta.id}`, 'data-search': `${meta.name} ${meta.blurb} ${meta.skills.join(' ')}`.toLowerCase() },
    h('div', { class: 'kw-term' }, meta.name),
    h('div', { class: 'muted small' }, meta.blurb),
    h('div', { class: 'chips', style: { marginTop: '8px' } }, meta.skills.map((s) => h('span', { class: 'chip' }, SKILL_LABELS[s]))));
  const blocks = sections.map((sec) => {
    const grid = h('div', { class: 'grid' }, sec.games.map(card));
    return { el: h('section', {}, h('h2', { style: { marginTop: '18px' } }, sec.title), sec.note ? h('p', { class: 'muted small' }, sec.note) : '', grid), grid };
  });
  const filter = h('input', { type: 'text', placeholder: 'Filter games', 'aria-label': 'Filter games', oninput: () => {
    const q = filter.value.trim().toLowerCase();
    for (const b of blocks) {
      let shown = 0;
      for (const c of b.grid.children) {
        const hit = !q || c.dataset.search.includes(q);
        c.hidden = !hit;
        if (hit) shown += 1;
      }
      b.el.hidden = !shown;
    }
  } });

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Games'),
      h('div', { class: 'row' }, seedInput, h('button', { class: 'btn small', type: 'button', onclick: openSeed }, 'Play seed'), seedMsg)),
    h('div', { class: 'row' }, filter, h('span', { class: 'muted' }, `${GAMES.length} games: ${own.length} of our own and ${tatham.length} of Simon Tatham’s puzzles.`)),
    blocks.map((b) => b.el)));
}
