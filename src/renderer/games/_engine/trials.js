// Speeded-response trials (Flanker, Go/No-Go, reaction time, visual search).
//
// A game supplies:
//   keys: [{ key: 'ArrowLeft', alt?: ['f'], label: '← Left' }]   response keys (index = response)
//   makeTrials(rng, difficulty) → trial[]
//   render(stage, trial)                          draws the stimulus
//   expect(trial) → key index, or -1 for "don't respond" (Go/No-Go)
//   limitMs(difficulty) → per-trial response window
//   foreperiodMs?(rng, trial) → blank wait before the stimulus (a key press during it is a false start)
//   score?({ trials, responses, difficulty }) → { score, accuracy, performance }
// Responses are { key, rt, ok, early }.
import { h, clear, fill } from '../../ui.js';
import { clamp01 } from './common.js';

export function defaultScore({ responses, difficulty, targetRt = 600 }) {
  const right = responses.filter((r) => r.ok);
  const accuracy = responses.length ? right.length / responses.length : 0;
  const rts = right.map((r) => r.rt).filter((x) => x != null).sort((a, b) => a - b);
  const median = rts.length ? rts[Math.floor(rts.length / 2)] : null;
  const speed = median == null ? 1 : clamp01(1.5 - (0.5 * median) / targetRt);
  return {
    score: Math.round(right.length * 10 * (0.5 + speed) * (1 + difficulty / 5)),
    accuracy,
    performance: clamp01(accuracy * (0.7 + 0.3 * speed)),
    medianRt: median,
  };
}

export function trialsGame({ meta, keys, makeTrials, render, expect, limitMs, foreperiodMs, score, intro, gapMs = 350, targetRt }) {
  return {
    meta,
    start(root, ctx) {
      const trials = makeTrials(ctx.rng, ctx.difficulty);
      const limit = limitMs(ctx.difficulty);
      const responses = [];
      let i = 0;
      let phase = 'wait'; // 'fore' | 'stim' | 'gap' | 'done'
      let shownAt = 0;
      let activeMs = 0;
      let timer = 0;
      let paused = false;

      const stage = h('div', { class: 'trial-stage', 'aria-live': 'off' });
      const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
      const tally = h('div', { class: 'muted small' });
      const buttons = keys.map((k, idx) => h('button', { class: 'btn', type: 'button', onclick: () => respond(idx) }, k.label));
      root.append(h('div', { class: 'g-center' }, tally, stage, h('div', { class: 'row trial-keys' }, buttons), msg,
        intro ? h('p', { class: 'muted small' }, intro) : null));

      function next() {
        if (phase === 'done' || paused) return;
        clearTimeout(timer);
        tally.textContent = `${i + 1} / ${trials.length}`;
        fill(stage, h('div', { class: 'trial-fix' }, '+'));
        phase = 'fore';
        const fore = foreperiodMs ? foreperiodMs(ctx.rng, trials[i]) : 400;
        timer = setTimeout(show, fore);
      }

      function show() {
        clear(stage);
        render(stage, trials[i], ctx);
        phase = 'stim';
        shownAt = performance.now();
        timer = setTimeout(() => respond(null), limit);
      }

      function respond(idx) {
        if (paused || phase === 'done' || phase === 'gap' || phase === 'wait') return;
        if (phase === 'fore') {
          if (idx == null) return;
          clearTimeout(timer);
          record({ key: idx, rt: null, ok: false, early: true }, 'Too soon! Wait for it.');
          return;
        }
        clearTimeout(timer);
        const rt = performance.now() - shownAt;
        activeMs += Math.min(rt, limit);
        const want = expect(trials[i]);
        const ok = idx == null ? want === -1 : idx === want;
        const note = idx == null ? (ok ? '' : 'Too slow') : ok ? '✓' : '✗';
        record({ key: idx, rt: idx == null ? null : Math.round(rt), ok, early: false }, note);
      }

      function record(r, note) {
        responses.push(r);
        msg.textContent = note;
        msg.className = `g-msg ${r.ok ? 'ok' : 'bad'}`;
        clear(stage);
        i += 1;
        if (i >= trials.length) return finish();
        phase = 'gap';
        timer = setTimeout(next, r.early ? 900 : gapMs);
      }

      function finish() {
        phase = 'done';
        const s = (score || defaultScore)({ trials, responses, difficulty: ctx.difficulty, targetRt });
        ctx.onFinish({ ...s, timeMs: Math.round(activeMs), difficulty: ctx.difficulty });
      }

      function onKey(e) {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const idx = keys.findIndex((k) => k.key === e.key || (k.alt || []).includes(e.key.toLowerCase()));
        if (idx < 0) return;
        e.preventDefault();
        respond(idx);
      }
      document.addEventListener('keydown', onKey);
      setTimeout(next, 600);

      return {
        pause() {
          paused = true;
          clearTimeout(timer);
          if (phase !== 'done') { clear(stage); phase = 'wait'; }
        },
        resume() {
          paused = false;
          if (phase !== 'done') next(); // the interrupted trial starts again
        },
        destroy() {
          phase = 'done';
          clearTimeout(timer);
          document.removeEventListener('keydown', onKey);
        },
      };
    },
  };
}
