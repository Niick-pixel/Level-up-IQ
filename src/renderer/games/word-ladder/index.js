import { meta, genLadder, buildGraph, shortestPath, oneLetterApart, wordLength, scoreRound } from './logic.js';
import { h } from '../../ui.js';

export { meta };

let packPromise = null;
const loadPack = () => (packPromise ||= fetch(new URL('../../../assets/packs/words-en.json', import.meta.url)).then((r) => r.json()));
const graphCache = {};
const validCache = {};
const fullGraphCache = {};

export function start(root, ctx) {
  let destroyed = false;
  let api = { pause() {}, resume() {}, destroy() { destroyed = true; } };
  const loading = h('p', { class: 'muted' }, 'Loading words…');
  root.append(loading);

  const ready = loadPack().then((pack) => {
    if (destroyed) return;
    loading.remove();
    api = run(root, ctx, pack);
  });
  ready.catch((err) => { loading.textContent = `Could not load the word list: ${err.message}`; });

  return {
    pause: () => api.pause(),
    resume: () => api.resume(),
    destroy: () => { destroyed = true; api.destroy(); },
  };
}

function run(root, ctx, pack) {
  const len = wordLength(ctx.difficulty);
  const ladder = genLadder(ctx.rng, ctx.difficulty, pack, graphCache);
  const valid = validCache[len] || (validCache[len] = new Set(pack[`valid${len}`]));
  const fullGraph = fullGraphCache[len] || (fullGraphCache[len] = buildGraph(valid)); // hints from any word
  const path = [ladder.start];
  let hints = 0;
  let elapsed = 0;
  let last = performance.now();
  let paused = false;
  let done = false;
  let tick = 0;

  const rungs = h('div', { class: 'ladder' });
  const input = h('input', {
    type: 'text', class: 'g-answer', maxlength: String(len), autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Next word',
  });
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const counter = h('div', { class: 'g-tally muted' });
  const hintBtn = h('button', { class: 'btn small', type: 'button', onclick: hint }, 'Hint');
  const giveUpBtn = h('button', { class: 'btn small', type: 'button', onclick: giveUp }, 'Show solution');
  root.append(h('div', { class: 'g-center' },
    h('p', { class: 'muted' }, `Get from ${ladder.start.toUpperCase()} to ${ladder.end.toUpperCase()} in ${ladder.steps} steps (or more).`),
    rungs, input, msg, counter, h('div', { class: 'row' }, hintBtn, giveUpBtn)));

  function rung(word, prev, cls = '') {
    const el = h('div', { class: `rung ${cls}` });
    [...word].forEach((ch, k) => el.append(prev && prev[k] !== ch ? h('span', { class: 'changed' }, ch) : ch));
    return el;
  }

  function render() {
    rungs.replaceChildren(
      ...path.map((w, k) => rung(w, path[k - 1], w === ladder.end ? 'end' : '')),
      ...(path[path.length - 1] === ladder.end ? [] : [h('div', { class: 'muted small' }, '⋮'), rung(ladder.end, null, 'end')]),
    );
    counter.textContent = `${path.length - 1} step${path.length === 2 ? '' : 's'} so far · best possible ${ladder.steps}`;
  }

  function say(text, cls = '') {
    msg.textContent = text;
    msg.className = `g-msg ${cls}`;
  }

  function submit(word) {
    const current = path[path.length - 1];
    if (word.length !== len) return say(`Use ${len} letters.`, 'bad');
    if (!oneLetterApart(word, current)) return say('Change exactly one letter.', 'bad');
    if (!valid.has(word)) return say(`“${word}” isn't in the word list.`, 'bad');
    if (path.includes(word)) return say('You already used that word.', 'bad');
    path.push(word);
    input.value = '';
    say('');
    if (word !== ladder.end && oneLetterApart(word, ladder.end)) path.push(ladder.end); // last step is obvious
    render();
    if (path[path.length - 1] === ladder.end) finish(false);
  }

  function hint() {
    const lockedFor = ctx.hints.lockedFor();
    if (lockedFor > 0 || done || paused) return;
    const p = shortestPath(fullGraph, path[path.length - 1], ladder.end);
    if (!p || p.length < 2) return say('No path from here. Undo a step with Backspace.', 'bad');
    hints += 1;
    say(`Try: ${p[1].toUpperCase()}`, 'ok');
  }

  function giveUp() {
    if (ctx.hints.lockedFor() > 0 || done) return;
    path.length = 0;
    path.push(...ladder.solution.slice(0, -1));
    render();
    finish(true);
  }

  function finish(gaveUp) {
    done = true;
    input.disabled = true;
    clearInterval(tick);
    hintBtn.disabled = true;
    giveUpBtn.disabled = true;
    const used = path.length - 1;
    ctx.onFinish({
      ...scoreRound({ steps: ladder.steps, used, hints, gaveUp, difficulty: ctx.difficulty }),
      timeMs: Math.round(elapsed + (paused ? 0 : performance.now() - last)),
      difficulty: ctx.difficulty,
    });
  }

  input.addEventListener('keydown', (e) => {
    if (paused || done) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(input.value.trim().toLowerCase());
    } else if (e.key === 'Backspace' && input.value === '' && path.length > 1) {
      e.preventDefault();
      path.pop();
      render();
      say('Undid a step.');
    }
  });

  // Thinking timer: hints and the solution stay locked for the first N seconds.
  const updateLocks = () => {
    const left = Math.ceil(ctx.hints.lockedFor() / 1000);
    hintBtn.disabled = giveUpBtn.disabled = left > 0 || done;
    hintBtn.textContent = left > 0 ? `Hint (${left}s)` : 'Hint';
    giveUpBtn.textContent = left > 0 ? `Show solution (${left}s)` : 'Show solution';
  };
  tick = setInterval(updateLocks, 250);
  updateLocks();
  render();
  input.focus();

  return {
    pause() { elapsed += performance.now() - last; paused = true; },
    resume() { last = performance.now(); paused = false; input.focus(); },
    destroy() { done = true; clearInterval(tick); },
  };
}
