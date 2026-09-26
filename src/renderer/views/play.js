// The game shell: intro → play (with pause) → results. Used on its own and by the Daily Mix.
import { h, clear, pct, fmtSeconds, toast } from '../ui.js';
import { byId } from '../games/registry.js';
import { makeRng, randomSeed, formatSeedCode } from '../../shared/rng.js';
import { SKILL_LABELS } from '../../shared/game-contract.js';
import { state } from '../state.js';

/**
 * @param {HTMLElement} el
 * @param {{ gameId: string, seed?: string, difficulty?: number, autostart?: boolean,
 *           onDone?: (outcome: object|null) => void, doneLabel?: string, subtitle?: string }} opts
 * @returns {() => void} cleanup
 */
export async function mountGame(el, opts) {
  const entry = byId(opts.gameId);
  if (!entry) {
    el.append(h('p', {}, 'Unknown game.'));
    return () => {};
  }
  const { meta } = entry;
  let difficulty = opts.difficulty || await window.api.suggestDifficulty(meta.skills);
  let seed = opts.seed || randomSeed();
  let instance = null;
  let pausedByBlur = false;
  let phase = 'intro'; // intro | playing | paused | results
  let cleanups = [];

  const seedLabel = h('span', { class: 'seed muted', title: 'Seed code: replay or share this exact puzzle' });
  const pauseBtn = h('button', { class: 'btn small', type: 'button', onclick: () => togglePause(), hidden: true }, 'Pause (Esc)');
  const head = h('div', { class: 'play-head' },
    h('div', {},
      h('h1', {}, meta.name),
      h('div', { class: 'muted small' }, opts.subtitle || meta.skills.map((s) => SKILL_LABELS[s]).join(' · '))),
    h('span', { class: 'spacer' }),
    seedLabel,
    pauseBtn);
  const stage = h('div', { class: 'play-stage card' });
  el.append(head, stage);

  const updateSeed = () => { seedLabel.textContent = formatSeedCode({ gameId: meta.id, difficulty, seed }); };
  updateSeed();

  // ---- intro
  function intro() {
    phase = 'intro';
    pauseBtn.hidden = true;
    const out = h('output', {}, String(difficulty));
    const set = (d) => {
      difficulty = Math.min(meta.difficultyRange[1], Math.max(meta.difficultyRange[0], d));
      out.textContent = String(difficulty);
      updateSeed();
    };
    const startBtn = h('button', { class: 'btn primary', type: 'button', onclick: play }, 'Start (Enter)');
    const overlay = h('div', { class: 'play-overlay' }, h('div', { class: 'play-panel' },
      h('p', {}, meta.blurb),
      h('ul', {}, meta.howTo.map((x) => h('li', {}, x))),
      h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '16px' } },
        h('span', { class: 'muted' }, 'Level'),
        h('span', { class: 'stepper' },
          h('button', { class: 'btn small', type: 'button', 'aria-label': 'Easier', onclick: () => set(difficulty - 1) }, '−'),
          out,
          h('button', { class: 'btn small', type: 'button', 'aria-label': 'Harder', onclick: () => set(difficulty + 1) }, '+'))),
      startBtn));
    clear(stage).append(overlay);
    startBtn.focus();
  }

  // ---- play
  function play() {
    clear(stage);
    phase = 'playing';
    pauseBtn.hidden = false;
    const board = h('div', {});
    stage.append(board);
    const lockUntil = performance.now() + state.settings.thinkingTimerSec * 1000;
    let pausedAt = 0;
    let pausedTotal = 0;
    const ctx = {
      gameId: meta.id,
      difficulty,
      seed,
      rng: makeRng(`${meta.id}:${difficulty}:${seed}`),
      settings: { ...state.settings },
      hints: {
        // ms until hints/reveal unlock (paused time doesn't count toward thinking time)
        lockedFor: () => Math.max(0, lockUntil + pausedTotal + (pausedAt ? performance.now() - pausedAt : 0) - performance.now()),
      },
      onFinish: (r) => results(r),
    };
    ctx._pauseHooks = {
      pause: () => { pausedAt = performance.now(); },
      resume: () => { if (pausedAt) pausedTotal += performance.now() - pausedAt; pausedAt = 0; },
    };
    entry.load().then((mod) => {
      if (phase !== 'playing') return;
      instance = (mod.start || mod.game.start)(board, ctx);
      instance._ctx = ctx;
    }).catch((err) => {
      board.append(h('p', { class: 'g-msg bad' }, `Could not start the game: ${err.message}`));
    });
  }

  function togglePause(force) {
    if (!instance) return;
    const wantPause = force ?? phase === 'playing';
    if (wantPause && phase === 'playing') {
      phase = 'paused';
      instance.pause();
      instance._ctx._pauseHooks.pause();
      const resumeBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => togglePause(false) }, 'Resume (Space)');
      const quitBtn = h('button', { class: 'btn', type: 'button', onclick: quit }, 'Quit round');
      stage.append(h('div', { class: 'play-overlay', dataset: { pause: '1' } }, h('div', { class: 'play-panel' },
        h('h2', {}, 'Paused'),
        h('p', { class: 'muted' }, pausedByBlur ? 'Mind Gym lost focus, so the round paused. Paused time never counts.' : 'Paused time never counts.'),
        h('div', { class: 'row', style: { justifyContent: 'center' } }, resumeBtn, quitBtn))));
      resumeBtn.focus();
    } else if (!wantPause && phase === 'paused') {
      phase = 'playing';
      pausedByBlur = false;
      stage.querySelector('[data-pause]')?.remove();
      instance._ctx._pauseHooks.resume();
      instance.resume();
    }
  }

  function quit() {
    instance?.destroy();
    instance = null;
    if (opts.onDone) opts.onDone(null);
    else intro();
  }

  // ---- results
  async function results(raw) {
    phase = 'results';
    pauseBtn.hidden = true;
    const game = instance;
    instance = null;
    let saved;
    try {
      saved = await window.api.recordResult({ ...raw, seed }, meta);
    } catch (err) {
      toast(`Could not save the result: ${err.message}`);
    }
    game?.destroy();
    const r = saved?.result || raw;
    const change = saved?.changes?.[meta.skills[0]];
    const delta = change ? change.after - change.before : 0;
    const again = h('button', { class: 'btn primary', type: 'button', onclick: () => { seed = randomSeed(); updateSeed(); play(); } }, opts.onDone ? 'Play again' : 'Play again (Enter)');
    const buttons = [again,
      h('button', { class: 'btn', type: 'button', onclick: () => play() }, 'Replay this seed')];
    if (opts.onDone) {
      const next = h('button', { class: 'btn primary', type: 'button', onclick: () => opts.onDone(saved) }, opts.doneLabel || 'Continue');
      buttons.unshift(next);
      again.classList.remove('primary');
    }
    stage.append(h('div', { class: 'play-overlay' }, h('div', { class: 'play-panel' },
      h('h2', {}, saved?.newBest ? 'New personal best!' : 'Round complete'),
      h('div', { class: 'results-grid' },
        h('div', {}, h('div', { class: 'num' }, String(r.score)), h('div', { class: 'muted small' }, 'score')),
        h('div', {}, h('div', { class: 'num' }, pct(r.accuracy)), h('div', { class: 'muted small' }, 'accuracy')),
        h('div', {}, h('div', { class: 'num' }, fmtSeconds(r.timeMs)), h('div', { class: 'muted small' }, 'active time'))),
      change ? h('p', { class: 'muted' }, `${SKILL_LABELS[meta.skills[0]]} rating ${change.after} (${delta >= 0 ? '+' : ''}${delta})`) : null,
      h('div', { class: 'row', style: { justifyContent: 'center' } }, buttons))));
    buttons[0].focus();
  }

  // ---- keys and focus
  const onKey = (e) => {
    if (e.key === 'Escape' && (phase === 'playing' || phase === 'paused')) {
      e.preventDefault();
      togglePause();
    } else if (e.key === ' ' && phase === 'paused' && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      togglePause(false);
    } else if (e.key === 'Enter' && phase === 'intro' && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      play();
    }
  };
  // Pause when the app window loses focus (a Focus Point break, Alt+Tab…). This comes from the
  // main process, because focus moving into an embedded puzzle frame also blurs the page.
  const onBlur = () => {
    if (phase === 'playing') {
      pausedByBlur = true;
      togglePause(true);
    }
  };
  document.addEventListener('keydown', onKey);
  const offBlur = window.api.onBlur(onBlur);
  cleanups.push(() => document.removeEventListener('keydown', onKey), offBlur);

  if (opts.autostart) play();
  else intro();

  return () => {
    instance?.destroy();
    instance = null;
    phase = 'gone';
    cleanups.forEach((f) => f());
    cleanups = [];
  };
}

export async function renderPlay(el, params) {
  const page = h('div', { class: 'page' });
  el.append(page);
  const d = Number(params.get('d'));
  return mountGame(page, {
    gameId: params.id,
    seed: params.get('seed') || undefined,
    difficulty: d >= 1 && d <= 10 ? d : undefined,
  });
}
