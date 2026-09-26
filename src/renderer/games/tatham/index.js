import { TATHAM, LADDERS, presetForLevel, safeSeed, scoreRound } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

let presetsPromise = null;
const loadPresets = () => (presetsPromise ||= fetch(new URL('../../../assets/tatham/presets.json', import.meta.url))
  .then((r) => (r.ok ? r.json() : null)).catch(() => null));

export function start(root, ctx) {
  const entry = TATHAM.find((t) => t.meta.id === ctx.gameId);
  const time = clock();
  let frame = null;
  let finished = false;
  let lockTick = 0;
  const status = h('p', { class: 'muted small tatham-status' }, 'Generating the puzzle…');
  root.append(status);

  const onMessage = (e) => {
    if (e.origin !== location.origin || e.source !== frame?.contentWindow || e.data?.source !== 'mg-tatham') return;
    const { type } = e.data;
    if (type === 'ready') {
      status.textContent = `${entry.meta.name} · from Simon Tatham's Portable Puzzle Collection (MIT licence)`;
      frame.contentWindow.focus();
    }
    if (type === 'missing') {
      status.textContent = 'The Tatham puzzles have not been built into this copy of Mind Gym yet.';
    }
    if (['solved', 'revealed', 'lost'].includes(type) && !finished) {
      finished = true;
      clearInterval(lockTick);
      time.pause();
      const outcome = type;
      status.textContent = outcome === 'solved' ? 'Solved!' : outcome === 'lost' ? 'Boom. That one was a mine.' : 'Solution shown.';
      // leave the finished grid visible for a moment before the results appear
      setTimeout(() => ctx.onFinish({ ...scoreRound({ outcome, timeMs: time.ms(), difficulty: ctx.difficulty }), timeMs: time.ms(), difficulty: ctx.difficulty }), outcome === 'solved' ? 1200 : 1800);
    }
  };
  window.addEventListener('message', onMessage);

  const send = (msg) => frame?.contentWindow?.postMessage({ source: 'mg-host', ...msg }, location.origin);

  loadPresets().then((all) => {
    const presets = all?.[entry.puzzle];
    if (!presets) {
      status.textContent = 'The Tatham puzzles have not been built into this copy of Mind Gym yet (run the “Build Tatham puzzles” workflow).';
      return;
    }
    const preset = presetForLevel(presets, ctx.difficulty, LADDERS[entry.puzzle]);
    status.textContent = `Generating: ${preset.name}…`;
    const url = new URL('../../tatham/host.html', import.meta.url);
    url.searchParams.set('p', entry.puzzle);
    url.searchParams.set('t', document.documentElement.dataset.theme || 'night');
    url.hash = `${preset.params}#${safeSeed(ctx.seed)}`;
    frame = h('iframe', { class: 'tatham-frame', src: url.href, title: entry.meta.name });
    root.append(frame);

    // Thinking timer: "Show solution" stays locked for the first N seconds.
    const updateLock = () => {
      const left = Math.ceil(ctx.hints.lockedFor() / 1000);
      send({ type: 'lock-solve', locked: left > 0, seconds: left });
      if (left <= 0) clearInterval(lockTick);
    };
    lockTick = setInterval(updateLock, 500);
    frame.addEventListener('load', updateLock);
  });

  return {
    pause() { time.pause(); send({ type: 'pause' }); },
    resume() { time.resume(); send({ type: 'resume' }); },
    destroy() {
      finished = true;
      clearInterval(lockTick);
      window.removeEventListener('message', onMessage);
    },
  };
}
