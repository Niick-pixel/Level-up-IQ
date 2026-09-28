// Runs a sequence of steps (games, a review session, a keyword, video suggestions) one after
// another: the engine behind the Daily Mix, Pick a skill, Marathon and your playlists.
//   step = { kind: 'game', gameId, label } | { kind: 'review', count, label }
//        | { kind: 'keyword', keyword, label } | { kind: 'videos', keyword, label }
import { h, clear, fill, fmtMinutes, plural } from '../ui.js';
import { mountGame } from './play.js';
import { reviewSession } from './review.js';
import { videoCard } from './video.js';
import { byId } from '../games/registry.js';

export const stepName = (s) => (s.kind === 'game' ? byId(s.gameId)?.meta.name || s.gameId
  : s.kind === 'review' ? `Review ${plural(s.count, 'card')}`
    : s.kind === 'keyword' ? (s.keyword ? `${s.keyword.term}: explain it back` : 'Keyword')
      : 'Something to watch');

/**
 * @param page   container
 * @param o      { title, intro, steps?, next?(i, history) → step|null (endless modes), estimateSec?, doneText? }
 * @returns cleanup
 */
export function runPlan(page, o) {
  let step = -1;
  let cleanup = () => {};
  let totalMs = 0;
  let rounds = 0;
  const played = [];
  const steps = o.steps ? o.steps.slice() : [];
  const total = () => (o.next ? null : steps.length);

  function intro() {
    step = -1;
    fill(page,
      h('div', { class: 'page-head' }, h('h1', {}, o.title)),
      h('div', { class: 'card hero' },
        o.intro ? h('p', {}, o.intro) : '',
        steps.length ? h('ol', { class: 'plan-list' }, steps.map((s) => h('li', {}, h('span', { class: 'muted small plan-label' }, s.label || ''), ' ', stepName(s)))) : '',
        o.estimateSec ? h('p', { class: 'muted small' }, `About ${Math.max(1, Math.round(o.estimateSec / 60))} minutes.`) : '',
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => next() }, 'Start'),
          o.extraButtons || '')));
    page.querySelector('.btn.primary')?.focus();
  }

  function next(outcome) {
    if (outcome?.result) { totalMs += outcome.result.timeMs; rounds += 1; }
    cleanup();
    cleanup = () => {};
    clear(page);
    if (outcome === null) return intro(); // quit mid-way
    step += 1;
    const s = o.next ? o.next(step, played) : steps[step];
    if (!s) return finish();
    if (o.next) steps.push(s);
    const sub = `${o.title} · ${total() ? `${step + 1} of ${total()}` : `round ${step + 1}`}${s.label ? ` · ${s.label}` : ''}`;
    const isLast = total() && step + 1 === total();
    const label = isLast ? 'Finish' : 'Next';
    if (s.kind === 'game') {
      played.push(s.gameId);
      mountGame(page, { gameId: s.gameId, subtitle: sub, onDone: next, doneLabel: o.next ? 'Next game' : label }).then((c) => { cleanup = c; });
    } else if (s.kind === 'review') {
      page.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Review'), h('div', { class: 'muted small' }, sub))));
      cleanup = reviewSession(page, { limit: s.count, onDone: () => next({}) });
    } else if (s.kind === 'keyword') {
      keywordStep(s.keyword, sub, label);
    } else if (s.kind === 'videos') {
      videosStep(s.keyword, sub, label);
    } else next({});
  }

  function keywordStep(k, sub, label) {
    const box = h('textarea', { placeholder: 'Write 3–5 sentences from memory. No looking things up, no AI.', 'aria-label': 'Your explanation' });
    page.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, k.term), h('div', { class: 'muted small' }, `${sub} · ${k.domainLabel}`))),
      h('div', { class: 'card hero' },
        h('h3', {}, 'Explain it back'),
        h('p', { class: 'muted' }, 'What do you already know about this? Explain it as if to a friend. Writing it out, even if you’re unsure, makes whatever you read next stick better.'),
        box,
        h('div', { class: 'row', style: { marginTop: '12px' } },
          h('button', { class: 'btn primary', type: 'button', onclick: () => next({}) }, label),
          h('a', { class: 'btn', href: `#/keyword/${k.id}` }, 'Open the full keyword session'))));
    box.focus();
    window.api.exploreKeyword(k.id);
  }

  function videosStep(k, sub, label) {
    const list = h('div', { class: 'vid-grid' }, h('p', { class: 'muted' }, 'Looking for something good to watch…'));
    page.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Something to watch'), h('div', { class: 'muted small' }, sub))),
      h('div', { class: 'card hero' },
        h('p', { class: 'muted' }, `Videos on ${k.term}, or close to it. Save one for later; after you’ve watched it, three recall questions lock it in.`),
        list,
        h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn primary', type: 'button', onclick: () => next({}) }, label))));
    window.api.suggestVideos(k.id).then((r) => {
      fill(list, r.videos.length ? r.videos.slice(0, 3).map((v) => videoCard(v, { keywordId: k.id })) : h('p', { class: 'muted' }, 'No matching videos from your channels right now. The Watch page has everything new.'));
    }).catch(() => fill(list, h('p', { class: 'muted' }, 'Couldn’t look for videos (offline?).')));
  }

  function finish() {
    fill(page,
      h('div', { class: 'page-head' }, h('h1', {}, `${o.title}: done`)),
      h('div', { class: 'card hero' },
        h('p', {}, rounds ? `${plural(rounds, 'round')}, ${fmtMinutes(totalMs)} of focused thinking, all without AI.` : 'All done.'),
        o.doneText ? h('p', { class: 'muted' }, o.doneText) : '',
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: '#/stats' }, 'See stats'),
          h('a', { class: 'btn', href: '#/' }, 'Home'))));
  }

  intro();
  return () => cleanup();
}
