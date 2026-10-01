// Check-in: the short session a reminder asks for. A few quick games from different skills
// (weakest favoured) plus a handful of due reviews. Any training counts toward it, so a Daily
// Mix or a keyword session done instead is just as good.
import { h, fill } from '../ui.js';
import { runPlan } from './run.js';
import { GAMES } from '../games/registry.js';
import { planCheckin } from '../../shared/mix-plan.js';
import { makeRng } from '../../shared/rng.js';

export async function renderCheckin(el) {
  const page = h('div', { class: 'page' });
  el.append(page);
  const [ctx, engine] = await Promise.all([window.api.checkinContext(), window.api.engineStatus()]);
  const st = ctx.status;
  const slot = st.due;
  const plan = planCheckin({
    metas: GAMES.map((g) => g.meta), ratings: ctx.ratings, recent: ctx.recent, now: ctx.now,
    rng: makeRng(`checkin:${ctx.now}`), minutes: ctx.minutes, reviewsDue: ctx.reviewsDue,
    offline: ctx.offline, hasCards: ctx.hasCards, exclude: engine.installed ? [] : ['chess-engine'],
  });

  const snoozeBtn = slot && (slot.snoozesLeft == null || slot.snoozesLeft > 0)
    ? h('button', {
      class: 'btn', type: 'button',
      onclick: async () => {
        try { await window.api.snoozeReminder(slot.time); } catch { /* none left */ }
        location.hash = '#/';
      },
    }, slot.snoozesLeft == null ? 'Later' : `Snooze (${slot.snoozesLeft} left)`)
    : null;

  const intro = slot
    ? `Your ${slot.time} check-in: about ${ctx.minutes} minutes of training. ${slot.progress > 0 ? `You’re ${Math.round(slot.progress * 100)} % there. ` : ''}Any game, review or keyword session counts.`
    : `A quick ${ctx.minutes}-minute session. ${st.next ? `Your next check-in is at ${st.next.time}.` : ''}`;

  const cleanup = runPlan(page, {
    title: slot ? 'Check-in' : 'Quick check-in',
    intro,
    steps: plan.steps,
    estimateSec: plan.estimatedSec,
    extraButtons: h('span', { class: 'row' }, snoozeBtn, h('a', { class: 'btn', href: '#/mix' }, 'Daily Mix instead')),
    doneText: 'Check-in done. See you at the next one.',
  });
  if (slot && st.mandatory && snoozeBtn == null) {
    page.querySelector('.card.hero')?.prepend(h('p', { class: 'g-msg' }, 'No snoozes left: this one is mandatory.'));
  }
  return cleanup;
}

/** Today's check-ins as a small card for Home. */
export function checkinCard(st) {
  if (!st?.activeToday || !st.slots.length) return null;
  const card = h('div', { class: `card checkin-card${st.due ? ' due' : ''}` });
  fill(card,
    h('div', { class: 'eyebrow' }, st.mandatory ? 'Check-ins (mandatory)' : 'Check-ins'),
    h('div', { class: 'checkin-slots' }, st.slots.map((x) => h('span', {
      class: `slot ${x.state}`, title: `${x.time}: ${x.state}`,
    }, x.state === 'done' ? '✓ ' : x.state === 'missed' ? '– ' : '', x.time))),
    st.due
      ? h('a', { class: 'btn primary small', href: '#/checkin', style: { marginTop: '8px' } }, `Start the ${st.due.time} check-in`)
      : h('div', { class: 'muted small', style: { marginTop: '6px' } }, st.next ? `Next at ${st.next.time}.` : 'All done for today.'));
  return card;
}
