// Daily Mix: the planner (src/shared/mix-plan.js) builds today's arc from your ratings, what you
// played recently and how long you want to train. Same plan all day (seeded by the date).
import { h } from '../ui.js';
import { runPlan } from './run.js';
import { GAMES } from '../games/registry.js';
import { planMix } from '../../shared/mix-plan.js';
import { makeRng, localDateKey } from '../../shared/rng.js';

export async function renderMix(el) {
  const page = h('div', { class: 'page' });
  el.append(page);
  const ctx = await window.api.mixContext();
  const [engine, kotd] = await Promise.all([window.api.engineStatus(), window.api.keywordOfTheDay()]);
  const rng = makeRng(`mix:${localDateKey()}`);
  const plan = planMix({
    metas: GAMES.map((g) => g.meta), ratings: ctx.ratings, recent: ctx.recent, now: ctx.now, rng,
    minutes: ctx.minutes, reviewsDue: ctx.reviewsDue, offline: ctx.offline, hasCards: ctx.hasCards,
    exclude: engine.installed ? [] : ['chess-engine'],
  });
  // domain variety: if today's keyword is from a domain you explored in the last few days, pick
  // one from a domain you've visited least instead
  let keyword = kotd;
  if (ctx.recentDomains.includes(kotd.domain)) {
    const alt = await window.api.randomKeyword({ mode: 'comfort', exclude: [kotd.id] }).catch(() => null);
    if (alt && !ctx.recentDomains.includes(alt.domain)) keyword = alt;
  }
  const steps = plan.steps.map((s) => (s.kind === 'keyword' || s.kind === 'videos' ? { ...s, keyword } : s));
  return runPlan(page, {
    title: 'Daily Mix',
    intro: 'Today’s mix leans towards your weaker skills and skips what you played in the last few days. Levels adjust to you as you play.',
    steps,
    estimateSec: plan.estimatedSec,
    extraButtons: h('a', { class: 'btn', href: '#/settings' }, 'Change length'),
  });
}
