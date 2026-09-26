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

  const bySkill = SKILLS.map((skill) => ({ skill, games: GAMES.filter((g) => g.meta.skills[0] === skill) }))
    .filter((x) => x.games.length);

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Games'),
      h('div', { class: 'row' }, seedInput, h('button', { class: 'btn small', type: 'button', onclick: openSeed }, 'Play seed'), seedMsg)),
    h('p', { class: 'muted' }, `${GAMES.length} games so far. The catalog grows to 60+ types in later phases.`),
    bySkill.map(({ skill, games }) => [
      h('h2', { style: { marginTop: '18px' } }, SKILL_LABELS[skill]),
      h('div', { class: 'grid' }, games.map(({ meta }) => h('a', { class: 'card', href: `#/play/${meta.id}` },
        h('div', { class: 'kw-term' }, meta.name),
        h('div', { class: 'muted small' }, meta.blurb),
        h('div', { class: 'chips', style: { marginTop: '8px' } }, meta.skills.map((s) => h('span', { class: 'chip' }, SKILL_LABELS[s])))))),
    ])));
}
