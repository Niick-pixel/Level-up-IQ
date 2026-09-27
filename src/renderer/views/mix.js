// Daily Mix: a fixed arc of speed → math → memory → words → keyword → explain-it-back, with
// the game in each slot rotating by date. Weighting by weak skills and recent play arrives with adaptivity (Phase 5).
import { h, clear, fmtMinutes, fill } from '../ui.js';
import { mountGame } from './play.js';
import { makeRng, localDateKey } from '../../shared/rng.js';

export async function renderMix(el) {
  const page = h('div', { class: 'page' });
  el.append(page);
  const rng = makeRng(`mix:${localDateKey()}`);
  const plan = [
    { gameId: rng.pick(['stroop', 'schulte', 'flanker', 'go-no-go', 'visual-search']), label: 'Warm-up' },
    { gameId: rng.pick(['mental-math', 'game-24', 'countdown-numbers', 'sequences']), label: 'Math' },
    { gameId: rng.pick(['nback', 'digit-span', 'corsi', 'kims-game']), label: 'Memory' },
    { gameId: rng.pick(['word-ladder', 'anagram', 'wordle', 'countdown-letters']), label: 'Words' },
  ];
  const kotd = await window.api.keywordOfTheDay();
  let step = -1;
  let cleanup = () => {};
  let totalMs = 0;

  const intro = () => {
    fill(page, 
      h('div', { class: 'page-head' }, h('h1', {}, 'Daily Mix')),
      h('div', { class: 'card hero' },
        h('p', {}, 'Four short rounds, then a few minutes with today\'s keyword. Levels adjust to you as you play.'),
        h('ol', {}, plan.map((p) => h('li', {}, `${p.label}`)), h('li', {}, `Keyword of the day: ${kotd.term}, explained back from memory`)),
        h('button', { class: 'btn primary', type: 'button', onclick: () => next() }, 'Start the mix')));
  };

  function next(outcome) {
    if (outcome?.result) totalMs += outcome.result.timeMs;
    cleanup();
    cleanup = () => {};
    clear(page);
    if (outcome === null) { // quit mid-way
      step = -1;
      totalMs = 0;
      return intro();
    }
    step += 1;
    if (step < plan.length) {
      const p = plan[step];
      mountGame(page, {
        gameId: p.gameId,
        subtitle: `Daily Mix · ${step + 1} of ${plan.length + 1} · ${p.label}`,
        onDone: next,
        doneLabel: step + 1 < plan.length ? 'Next round' : 'On to the keyword',
      }).then((c) => { cleanup = c; });
      return;
    }
    keywordStep();
  }

  function keywordStep() {
    cleanup = () => {};
    const box = h('textarea', { placeholder: 'Write 3–5 sentences from memory. No looking things up, no AI.', 'aria-label': 'Your explanation' });
    const doneBtn = h('button', { class: 'btn primary', type: 'button', onclick: finish }, 'Done');
    page.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, kotd.term), h('div', { class: 'muted small' }, `Daily Mix · ${plan.length + 1} of ${plan.length + 1} · ${kotd.domainLabel}`))),
      h('div', { class: 'card hero' },
        h('h3', {}, 'Explain it back'),
        h('p', { class: 'muted' }, 'What do you already know about this? Explain it as if to a friend. Writing it out, even if you are unsure, makes whatever you read next stick better.'),
        box,
        h('div', { class: 'row', style: { marginTop: '12px' } }, doneBtn,
          h('a', { class: 'btn', href: `#/keyword/${kotd.id}` }, 'Open the keyword page'))),
    );
    box.focus();
    window.api.exploreKeyword(kotd.id);
  }

  function finish() {
    fill(page, 
      h('div', { class: 'page-head' }, h('h1', {}, 'Mix complete')),
      h('div', { class: 'card hero' },
        h('p', {}, `Nice work. ${fmtMinutes(totalMs)} of focused thinking, all without AI.`),
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: '#/stats' }, 'See stats'),
          h('a', { class: 'btn', href: '#/' }, 'Home'))));
  }

  intro();
  return () => cleanup();
}
