// Ways to play besides the Daily Mix (spec §5): Pick a skill, Marathon, and your own playlists.
import { h, fill, toast } from '../ui.js';
import { state } from '../state.js';
import { runPlan } from './run.js';
import { GAMES, byId } from '../games/registry.js';
import { SKILLS, SKILL_LABELS } from '../../shared/game-contract.js';
import { gameWeight, nextMarathonGame } from '../../shared/mix-plan.js';
import { makeRng, randomSeed } from '../../shared/rng.js';

async function context() {
  const [ctx, engine] = await Promise.all([window.api.mixContext(), window.api.engineStatus()]);
  const exclude = new Set(engine.installed ? [] : ['chess-engine']);
  const metas = GAMES.map((g) => g.meta).filter((m) => !exclude.has(m.id) && !(ctx.offline && m.offline === false) && !(m.needsCards && !ctx.hasCards));
  return { ctx, metas };
}

/** Three rounds of one skill, weighted towards games you haven't played lately. */
export async function renderSkill(el, params) {
  const skill = SKILLS.includes(params.id) ? params.id : 'logic';
  const page = h('div', { class: 'page' });
  el.append(page);
  const { ctx, metas } = await context();
  const rng = makeRng(`skill:${skill}:${randomSeed()}`);
  const pool = metas.filter((m) => m.skills.includes(skill) && m.durationRange[0] <= 8 * 60);
  const steps = [];
  const used = new Set();
  for (let i = 0; i < 3; i++) {
    const options = pool.filter((m) => !used.has(m.id));
    if (!options.length) break;
    const m = rng.weighted(options, (x) => gameWeight(x, { ratings: ctx.ratings, recent: ctx.recent, now: ctx.now }) * (x.skills[0] === skill ? 1 : 0.4));
    used.add(m.id);
    steps.push({ kind: 'game', gameId: m.id, label: SKILL_LABELS[skill] });
  }
  return runPlan(page, {
    title: `${SKILL_LABELS[skill]} workout`,
    intro: `Three ${SKILL_LABELS[skill].toLowerCase()} rounds at your level, favouring games you haven’t played lately.`,
    steps,
    extraButtons: h('div', { class: 'row' }, SKILLS.filter((s) => s !== skill).map((s) => h('a', { class: 'btn small ghost', href: `#/skill/${s}` }, SKILL_LABELS[s]))),
  });
}

/** One game after another until you stop, never repeating the last few. */
export async function renderMarathon(el) {
  const page = h('div', { class: 'page' });
  el.append(page);
  const { ctx, metas } = await context();
  const rng = makeRng(`marathon:${randomSeed()}`);
  return runPlan(page, {
    title: 'Marathon',
    intro: 'Game after game, chosen for you (weaker skills more often), until you choose to stop. Quit any round to end the marathon.',
    next: (_i, played) => {
      const id = nextMarathonGame({ metas, ratings: ctx.ratings, recent: ctx.recent, now: ctx.now, rng, offline: ctx.offline, hasCards: ctx.hasCards, lastIds: played });
      return id ? { kind: 'game', gameId: id, label: byId(id)?.meta.skills.map((s) => SKILL_LABELS[s])[0] } : null;
    },
  });
}

const playlists = () => state.settings.playlists || [];
const savePlaylists = async (list) => { state.settings = await window.api.setSettings({ playlists: list }); };

/** Your playlists: make, edit, play. */
export async function renderPlaylists(el) {
  const page = h('div', { class: 'page' });
  el.append(page);
  const draw = () => fill(page,
    h('div', { class: 'page-head' }, h('h1', {}, 'Your playlists'),
      h('button', { class: 'btn small primary', type: 'button', onclick: () => edit(null) }, 'New playlist')),
    playlists().length
      ? h('div', { class: 'grid' }, playlists().map((p) => h('div', { class: 'card' },
        h('div', { class: 'kw-term' }, p.name),
        h('div', { class: 'muted small' }, p.games.map((g) => byId(g)?.meta.name).filter(Boolean).join(' · ') || 'Empty'),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('a', { class: 'btn small primary', href: `#/playlist/${p.id}` }, 'Play'),
          h('button', { class: 'btn small', type: 'button', onclick: () => edit(p) }, 'Edit'),
          h('button', { class: 'btn small ghost', type: 'button', onclick: async () => {
            if (!confirm(`Delete “${p.name}”?`)) return;
            await savePlaylists(playlists().filter((x) => x.id !== p.id));
            draw();
          } }, 'Delete')))))
      : h('div', { class: 'card hero' }, h('p', {}, 'A playlist is your own set of games, played in order: a “morning logic” set, a language-only set, or your favourites.')));

  function edit(p) {
    const chosen = p ? p.games.slice() : [];
    const name = h('input', { type: 'text', value: p?.name || '', placeholder: 'Name', 'aria-label': 'Playlist name', style: { width: '260px' } });
    const order = h('ol', { class: 'plan-list' });
    const drawOrder = () => fill(order, chosen.map((g, i) => h('li', {}, byId(g)?.meta.name || g, ' ',
      h('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Remove', onclick: () => { chosen.splice(i, 1); drawOrder(); } }, '✕'))));
    drawOrder();
    const picker = h('select', { 'aria-label': 'Add a game' }, h('option', { value: '' }, 'Add a game…'),
      SKILLS.map((s) => h('optgroup', { label: SKILL_LABELS[s] }, GAMES.filter((g) => g.meta.skills[0] === s).map((g) => h('option', { value: g.meta.id }, g.meta.name)))));
    picker.addEventListener('change', () => { if (picker.value && chosen.length < 30) { chosen.push(picker.value); drawOrder(); } picker.value = ''; });
    fill(page,
      h('div', { class: 'page-head' }, h('h1', {}, p ? 'Edit playlist' : 'New playlist')),
      h('div', { class: 'card hero' }, name, h('h3', { style: { marginTop: '14px' } }, 'Games, in order'), order, picker,
        h('div', { class: 'row', style: { marginTop: '14px' } },
          h('button', { class: 'btn primary', type: 'button', onclick: async () => {
            if (!chosen.length) { toast('Add at least one game.'); return; }
            const item = { id: p?.id || `list-${Date.now().toString(36)}`, name: name.value.trim() || 'My playlist', games: chosen };
            await savePlaylists(p ? playlists().map((x) => (x.id === p.id ? item : x)) : [...playlists(), item]);
            toast('Saved.');
            draw();
          } }, 'Save'),
          h('button', { class: 'btn', type: 'button', onclick: draw }, 'Cancel'))));
    name.focus();
  }
  draw();
}

export async function renderPlaylist(el, params) {
  const p = playlists().find((x) => x.id === params.id);
  const page = h('div', { class: 'page' });
  el.append(page);
  if (!p) { page.append(h('p', {}, 'That playlist doesn’t exist any more. '), h('a', { href: '#/playlists' }, 'Your playlists')); return undefined; }
  return runPlan(page, { title: p.name, steps: p.games.filter((g) => byId(g)).map((g) => ({ kind: 'game', gameId: g })) });
}
