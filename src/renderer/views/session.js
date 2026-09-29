// The keyword session (spec §2): predict → learn → quiz → puzzle → explain it back → watch → remember.
import { videoCard } from './video.js';
import { h, clear, extLink, wikipediaUrl, pct, toast, plural, fill, add } from '../ui.js';
import { mountGame } from './play.js';
import { byId as gameById } from '../games/registry.js';
import { SKILL_LABELS } from '../../shared/game-contract.js';

const STEPS = ['Predict', 'Learn', 'Quiz', 'Puzzle', 'Explain', 'Watch', 'Remember'];

const errText = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

export async function renderSession(el, params) {
  const k = await window.api.getKeyword(params.id);
  if (!k) {
    el.append(h('div', { class: 'page' }, h('p', {}, 'Keyword not found. '), h('a', { href: '#/keywords' }, 'All keywords')));
    return;
  }
  window.api.exploreKeyword(k.id);
  // Optional Claude features (Settings → Claude features, with your own key)
  const ai = await window.api.aiStatus().catch(() => null);
  const aiReady = Boolean(ai?.ready);

  const s = {
    step: 0,
    prediction: '',
    learn: null,
    learnPromise: null,
    quiz: null,
    quizPromise: null,
    qIndex: 0,
    answers: [],
    baseCount: 0, // questions before any Claude bonus questions (only these count toward your rating)
    bonusLoaded: false,
    explanation: '',
    compare: null,
    dialogue: [], // Socratic mode: { who: 'tutor' | 'you', text }
    riddle: null,
    selfRating: 0,
    finished: null,
    activeMs: 0,
  };
  let gameCleanup = () => {};
  let quizKey = null; // keyboard handler of the question on screen
  let destroyed = false;
  const dropQuizKey = () => {
    if (quizKey) document.removeEventListener('keydown', quizKey);
    quizKey = null;
  };

  // Count active time only while the window has focus.
  let last = performance.now();
  const tick = setInterval(() => {
    const now = performance.now();
    if (document.hasFocus() && !s.finished) s.activeMs += now - last;
    last = now;
  }, 1000);

  // Start loading content right away, while you write your prediction.
  s.learnPromise = window.api.sessionLearn(k.id).then((d) => { s.learn = d; return d; });
  s.learnPromise.catch(() => {});

  const page = h('div', { class: 'page session' });
  const stepper = h('ol', { class: 'stepper-bar', 'aria-label': 'Session steps' });
  const body = h('div', { class: 'session-body' });
  const rabbit = async () => {
    const next = await window.api.randomKeyword({ mode: 'rabbit', fromId: k.id });
    location.hash = `#/keyword/${next.id}`;
  };
  page.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('div', { class: 'muted small' }, `${k.domainLabel} · level ${k.difficulty}${k.user ? ' · added by you' : ''}`),
        h('h1', {}, k.term)),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: rabbit }, 'Rabbit hole →'),
        h('a', { class: 'btn small', href: '#/keywords' }, 'All keywords'))),
    stepper,
    body,
    relatedBlock(k),
  );
  el.append(page);

  function renderStepper() {
    fill(stepper, ...STEPS.map((name, i) => h('li', {
      class: i === s.step ? 'current' : i < s.step ? 'done' : '',
      'aria-current': i === s.step ? 'step' : null,
    }, h('button', {
      type: 'button',
      disabled: i > s.step || Boolean(s.finished) || null,
      onclick: () => go(i),
    }, `${i + 1} ${name}`))));
  }

  function go(i) {
    dropQuizKey();
    gameCleanup();
    gameCleanup = () => {};
    s.step = i;
    renderStepper();
    clear(body);
    [predict, learn, quiz, puzzle, explain, watch, remember][i]();
    body.querySelector('textarea, .btn.primary, button')?.focus();
  }
  const next = () => go(s.step + 1);
  const nextBtn = (label, extra = {}) => h('button', { class: 'btn primary', type: 'button', onclick: next, ...extra }, label);

  // ---- 1 Predict
  function predict() {
    const box = h('textarea', { placeholder: 'In one sentence: what do you think this is? Guessing is the point.', 'aria-label': 'Your prediction' });
    box.value = s.prediction;
    box.addEventListener('input', () => { s.prediction = box.value; });
    body.append(h('div', { class: 'card hero' },
      h('h2', {}, 'Predict first'),
      h('p', { class: 'muted' }, 'Before reading anything, write what you think “' + k.term + '” is. Even a wrong guess makes the real answer stick better.'),
      box,
      h('div', { class: 'row', style: { marginTop: '12px' } },
        nextBtn('Next: learn'),
        h('button', { class: 'btn', type: 'button', onclick: () => { s.prediction = ''; next(); } }, 'I have no idea'))));
  }

  // ---- 2 Learn
  async function learn() {
    const card = h('div', { class: 'card hero' }, h('p', { class: 'muted' }, 'Loading…'));
    body.append(card);
    let d;
    try {
      d = await s.learnPromise;
    } catch (err) {
      fill(card, h('p', { class: 'g-msg bad' }, errText(err)), nextBtn('Next: quiz'));
      return;
    }
    if (destroyed || s.step !== 1) return;
    clear(card);
    if (s.prediction.trim()) card.append(h('div', { class: 'prediction' }, h('span', { class: 'muted small' }, 'You predicted: '), s.prediction));
    if (d.summary) {
      if (d.image) card.append(h('img', { class: 'summary-img', src: d.image, alt: '' }));
      if (d.summary.description) card.append(h('div', { class: 'eyebrow' }, d.summary.description));
      for (const para of d.summary.extract.split('\n').filter(Boolean)) card.append(h('p', {}, para));
    } else {
      add(card,
        h('p', {}, `No summary right now. Here's what the keyword bank knows: “${k.term}” is a ${k.domainLabel.toLowerCase()} topic.`),
        k.aliases.length ? h('p', {}, `Also known as: ${k.aliases.join(', ')}.`) : null,
        k.tags.length ? h('p', {}, `Tags: ${k.tags.join(', ')}.`) : null);
    }
    if (d.facts.length) {
      card.append(h('h3', { style: { marginTop: '14px' } }, 'Key facts'),
        h('table', { class: 'facts' }, h('tbody', {}, d.facts.slice(0, 8).map((f) => h('tr', {}, h('th', {}, f.label), h('td', {}, f.display))))));
    }
    for (const n of d.notes) card.append(h('p', { class: 'muted small' }, n));
    const attrib = attribution(d);
    if (attrib) card.append(attrib);
    card.append(h('div', { class: 'row', style: { marginTop: '14px', clear: 'both' } }, nextBtn('Next: quiz')));
    // prefetch the quiz while you read
    s.quizPromise ||= window.api.sessionQuiz(k.id);
    s.quizPromise.catch(() => {});
  }

  // ---- 3 Quiz
  async function quiz() {
    const card = h('div', { class: 'card hero' }, h('p', { class: 'muted' }, 'Building your quiz…'));
    body.append(card);
    try {
      s.quizPromise ||= window.api.sessionQuiz(k.id);
      s.quiz ||= (await s.quizPromise).questions;
      s.baseCount ||= s.quiz.length;
    } catch (err) {
      fill(card, h('p', { class: 'g-msg bad' }, `Couldn't build a quiz: ${errText(err)}`), nextBtn('Next: puzzle'));
      return;
    }
    if (destroyed || s.step !== 2) return;
    showQuestion(card);
  }

  function showQuestion(card) {
    clear(card);
    const qs = s.quiz;
    if (s.qIndex >= qs.length) {
      const correct = s.answers.slice(0, s.baseCount).filter(Boolean).length;
      const bonus = qs.length - s.baseCount;
      const bonusCorrect = s.answers.slice(s.baseCount).filter(Boolean).length;
      const more = h('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          more.disabled = true;
          more.textContent = 'Claude is writing questions…';
          try {
            const extra = await window.api.aiQuestions(k.id, 4);
            s.bonusLoaded = true;
            s.quiz.push(...extra);
            showQuestion(card);
          } catch (err) {
            more.disabled = false;
            more.textContent = 'More questions by Claude';
            toast(errText(err));
          }
        },
      }, 'More questions by Claude');
      add(card, h('h2', {}, `${correct} / ${s.baseCount} correct`),
        bonus ? h('p', {}, `Bonus questions by Claude: ${bonusCorrect} / ${bonus} (these don’t change your rating).`) : null,
        h('p', { class: 'muted' }, correct === s.baseCount ? 'Perfect.' : 'Mistakes are part of it: the key facts of this topic are saved as review cards at the end.'),
        h('div', { class: 'row' }, nextBtn('Next: puzzle'), aiReady && !s.bonusLoaded ? more : null));
      return;
    }
    const q = qs[s.qIndex];
    let answered = false;
    const feedback = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const nextQ = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => { s.qIndex += 1; dropQuizKey(); showQuestion(card); } },
      s.qIndex + 1 < qs.length ? 'Next question' : 'See result');
    const buttons = q.options.map((opt, i) => h('button', {
      class: 'btn option', type: 'button', onclick: () => choose(i),
    }, h('kbd', {}, String(i + 1)), ' ', opt));
    function choose(i) {
      if (answered) return;
      answered = true;
      const ok = i === q.answer;
      s.answers[s.qIndex] = ok;
      buttons.forEach((b, j) => {
        b.disabled = true;
        if (j === q.answer) b.classList.add('right');
        else if (j === i) b.classList.add('wrong');
      });
      feedback.textContent = (ok ? 'Correct.' : `Not quite: it's “${q.options[q.answer]}”.`) + (q.explain ? ` ${q.explain}` : '');
      feedback.className = `g-msg ${ok ? 'ok' : 'bad'}`;
      nextQ.hidden = false;
      nextQ.focus();
    }
    function onKey(e) {
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= q.options.length) choose(n - 1);
    }
    dropQuizKey();
    quizKey = onKey;
    document.addEventListener('keydown', onKey);
    const [first, ...rest] = q.prompt.split('\n');
    add(card,
      h('div', { class: 'muted small' }, s.qIndex >= s.baseCount
        ? `Bonus question ${s.qIndex - s.baseCount + 1} of ${qs.length - s.baseCount} · written by Claude, may contain mistakes`
        : `Question ${s.qIndex + 1} of ${s.baseCount}${q.source ? ` · from ${q.source.name}` : ''}`),
      h('h3', { style: { marginTop: '6px' } }, first),
      rest.length ? h('blockquote', {}, rest.join(' ')) : null,
      h('div', { class: 'options' }, buttons),
      feedback,
      nextQ);
  }

  // ---- 4 Puzzle tie-in
  async function puzzle() {
    const gameId = await window.api.sessionPuzzle(k.id);
    const game = gameById(gameId);
    if (destroyed || s.step !== 3) return;
    const holder = h('div', {});
    body.append(h('p', { class: 'muted' },
      `A quick ${game.meta.name.toLowerCase()} round to switch gears (${game.meta.skills.map((x) => SKILL_LABELS[x]).join(' · ')}). `,
      h('button', { class: 'btn small', type: 'button', onclick: next }, 'Skip')), holder);
    mountGame(holder, { gameId, subtitle: `Tie-in for ${k.term}`, onDone: () => next(), doneLabel: 'Next: explain it back' })
      .then((c) => { gameCleanup = c; });
  }

  // ---- 5 Explain it back
  async function explain() {
    const box = h('textarea', { placeholder: 'Explain it in 3–5 sentences, without looking. As if to a curious friend.', 'aria-label': 'Your explanation' });
    box.value = s.explanation;
    box.addEventListener('input', () => { s.explanation = box.value; });
    const result = h('div', { 'aria-live': 'polite' });
    const talk = h('div', {});
    const buttons = aiReady
      ? [h('button', { class: 'btn primary', type: 'button', onclick: () => grade(true) }, 'Grade with Claude'),
        h('button', { class: 'btn', type: 'button', onclick: () => grade(false) }, 'Quick word check')]
      : [h('button', { class: 'btn primary', type: 'button', onclick: () => grade(false) }, 'Compare with the summary')];
    body.append(h('div', { class: 'card hero' },
      h('h2', {}, 'Explain it back'),
      h('p', { class: 'muted' }, 'The summary is hidden. Writing it from memory is where most of the learning happens.'),
      box,
      h('div', { class: 'row', style: { marginTop: '12px' } }, ...buttons,
        aiReady ? h('button', { class: 'btn', type: 'button', onclick: () => socratic(talk) }, 'Talk it through (Socratic)') : null,
        h('button', { class: 'btn', type: 'button', onclick: next }, 'Skip')),
      result,
      talk));
    if (s.dialogue.length) socratic(talk);

    async function grade(useAi) {
      if (box.value.trim().split(/\s+/).length < 8) {
        toast('Write a little more first: a few full sentences.');
        return;
      }
      buttons.forEach((b) => { b.disabled = true; });
      fill(result, h('p', { class: 'muted', style: { marginTop: '12px' } }, useAi ? 'Claude is reading your explanation…' : 'Comparing…'));
      let r = null;
      let aiNote = null;
      if (useAi) {
        try { r = await window.api.aiGrade(k.id, box.value); } catch (err) { aiNote = `Claude couldn’t grade this (${errText(err)}), so here is the word check.`; }
      }
      if (!r) {
        try { r = await window.api.sessionCompare(k.id, box.value); } catch { /* offline */ }
      }
      buttons.forEach((b) => { b.disabled = false; });
      if (destroyed || s.step !== 4) return;
      clear(result);
      if (aiNote) result.append(h('p', { class: 'muted small', style: { marginTop: '12px' } }, aiNote));
      if (!r) {
        // No summary to compare with: rate yourself honestly.
        result.append(h('p', {}, 'No summary to compare with right now. How well do you think you explained it?'),
          h('div', { class: 'row' }, [1, 2, 3, 4, 5].map((n) => h('button', {
            class: 'btn small', type: 'button',
            onclick: () => { s.selfRating = n; s.compare = { score: n / 5, matched: [], missed: [], self: true }; next(); },
          }, String(n)))));
        return;
      }
      s.compare = r;
      const summaryAgain = h('details', { style: { marginTop: '10px' } }, h('summary', {}, 'Show the summary again'), h('p', {}, s.learn?.summary?.extract || ''));
      if (r.ai) {
        const chipList = (label, items, cls) => (items.length
          ? h('div', { class: 'chips', style: { marginTop: '6px' } }, h('span', { class: 'muted small' }, label), items.map((w) => h('span', { class: `chip ${cls}` }, w)))
          : null);
        add(result,
          h('h3', { style: { marginTop: '16px' } }, `Understanding: ${pct(r.score)}`),
          r.verdict ? h('p', {}, r.verdict) : null,
          chipList('You got: ', r.understood, 'ok'),
          chipList('Left out: ', r.missing, ''),
          r.misconceptions.length ? h('div', { style: { marginTop: '8px' } }, h('div', { class: 'muted small' }, 'Worth a second look:'),
            h('ul', {}, r.misconceptions.map((m) => h('li', {}, m)))) : null,
          r.nextStep ? h('p', { class: 'prediction', style: { marginTop: '10px' } }, h('span', { class: 'muted small' }, 'Think about next: '), r.nextStep) : null,
          summaryAgain,
          h('p', { class: 'muted small' }, 'Graded by Claude. It judges meaning rather than words, but it can be wrong: trust the summary over the grade.'),
          nextBtn('Next: watch'));
        return;
      }
      add(result,
        h('h3', { style: { marginTop: '16px' } }, `You covered ${pct(r.score)} of the key ideas`),
        r.matched.length ? h('div', { class: 'chips' }, h('span', { class: 'muted small' }, 'Mentioned: '), r.matched.map((w) => h('span', { class: 'chip ok' }, w))) : null,
        r.missed.length ? h('div', { class: 'chips', style: { marginTop: '6px' } }, h('span', { class: 'muted small' }, 'Not mentioned: '), r.missed.map((w) => h('span', { class: 'chip' }, w))) : null,
        summaryAgain,
        h('p', { class: 'muted small' }, 'This is a simple word-overlap check, not a judge of understanding. Missing words can still be worth a second look.'),
        nextBtn('Next: watch'));
    }
  }

  /** Socratic mode: Claude only asks questions (the main process also drops anything that isn't one). */
  function socratic(holder) {
    const log = h('div', { class: 'dialogue', 'aria-live': 'polite' });
    const input = h('textarea', { placeholder: 'Your answer. Thinking out loud is fine; "I don’t know" is fine too.', 'aria-label': 'Your answer', rows: 3 });
    const send = h('button', { class: 'btn primary', type: 'button', onclick: () => turn() }, 'Answer');
    const draw = () => fill(log, s.dialogue.map((t) => h('div', { class: `bubble ${t.who}` },
      h('span', { class: 'muted small' }, t.who === 'tutor' ? 'Tutor' : 'You'), h('p', {}, t.text))));
    fill(holder, h('div', { style: { marginTop: '18px' } },
      h('h3', {}, 'Socratic mode'),
      h('p', { class: 'muted small' }, 'A tutor that only asks questions. It won’t tell you the answer: you reason your way there. Written by Claude.'),
      log,
      h('div', { class: 'row', style: { marginTop: '8px', alignItems: 'flex-end' } }, input, send)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) turn(); });
    draw();
    if (!s.dialogue.length) ask();
    else input.focus();

    async function ask() {
      send.disabled = true;
      log.append(h('p', { class: 'muted small thinking' }, 'Thinking of a question…'));
      try {
        const r = await window.api.aiSocratic(k.id, s.dialogue);
        s.dialogue.push({ who: 'tutor', text: r.question });
        if (r.done) s.dialogueDone = true;
      } catch (err) {
        toast(errText(err));
      }
      if (destroyed) return;
      send.disabled = false;
      draw();
      input.focus();
    }
    function turn() {
      const text = input.value.trim();
      if (!text || send.disabled) return;
      s.dialogue.push({ who: 'you', text });
      input.value = '';
      draw();
      if (s.dialogueDone) {
        log.append(h('p', { class: 'muted small' }, 'Nicely reasoned. Try writing your explanation above again now.'));
        return;
      }
      ask();
    }
  }

  // ---- 6 Watch
  function watch() {
    const list = h('div', { class: 'vid-grid' }, h('p', { class: 'muted' }, 'Looking for videos on this…'));
    const extra = h('div', { class: 'row', style: { marginTop: '10px' } });
    body.append(h('div', { class: 'card hero' },
      h('h2', {}, 'Watch'),
      h('p', { class: 'muted' }, 'Videos from your curated channels that match this topic, plus public-domain films from the Internet Archive. Add one to Watch later; after watching, three recall questions lock it in.'),
      list, extra,
      h('div', { class: 'row', style: { marginTop: '14px' } }, nextBtn('Next: remember'))));
    window.api.suggestVideos(k.id).then((r) => {
      clear(list);
      if (!r.videos.length) list.append(h('p', { class: 'muted' }, 'None of your channels has a recent video on this (their feeds list the latest 15 videos each). Try a search instead.'));
      for (const v of r.videos) list.append(videoCard(v, { keywordId: k.id }));
      extra.append(
        h('button', { class: 'btn', type: 'button', onclick: () => window.api.openExternal(r.searchUrl) }, 'Search YouTube'),
        s.learn?.summary ? h('button', { class: 'btn', type: 'button', onclick: () => window.api.openExternal(s.learn.summary.url) }, 'Read the full article') : '');
    }).catch(() => fill(list, h('p', { class: 'muted' }, 'Couldn’t look for videos right now.')));
  }

  // ---- 7 Remember
  async function remember() {
    const card = h('div', { class: 'card hero' }, h('p', { class: 'muted' }, 'Saving…'));
    body.append(card);
    if (!s.finished) {
      try {
        s.finished = await window.api.sessionFinish(k.id, {
          quizCorrect: s.answers.slice(0, s.baseCount).filter(Boolean).length,
          quizTotal: s.baseCount,
          explainScore: s.compare?.score || 0,
          activeMs: s.activeMs,
          predicted: Boolean(s.prediction.trim()),
          explained: Boolean(s.compare),
        });
      } catch (err) {
        fill(card, h('p', { class: 'g-msg bad' }, `Couldn't save the session: ${errText(err)}`));
        return;
      }
      renderStepper();
    }
    const f = s.finished;
    const knowledge = f.changes.knowledge;
    fill(card, 
      h('h2', {}, 'Session complete'),
      h('p', {}, `${plural(f.cards.length, 'new review card')} saved.${knowledge ? ` Knowledge rating ${knowledge.after} (${knowledge.after - knowledge.before >= 0 ? '+' : ''}${knowledge.after - knowledge.before}).` : ''}`),
      f.cards.length ? h('ul', { class: 'cards-list' }, f.cards.map((c) => h('li', {}, h('strong', {}, c.front), h('div', { class: 'muted' }, c.back)))) : null,
      h('p', { class: 'muted small' }, 'They come back in Review right before you\'d forget them.'),
      aiReady ? riddleBlock() : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: rabbit }, 'Rabbit hole: next topic →'),
        h('a', { class: 'btn', href: '#/keywords' }, 'All keywords'),
        h('a', { class: 'btn', href: '#/' }, 'Home')));
  }

  /** A riddle about a topic you might explore next (so the answer isn't the one you just learned). */
  function riddleBlock() {
    const box = h('div', { class: 'riddle', style: { marginTop: '14px' } });
    const show = (r) => {
      const answer = h('p', { hidden: true }, h('strong', {}, r.answer));
      const hint = h('p', { class: 'muted', hidden: true }, `Hint: ${r.hint}`);
      const explore = h('a', { class: 'btn small', href: `#/keyword/${r.id}`, hidden: true }, 'Explore it →');
      fill(box, h('h3', {}, 'A riddle by Claude'),
        h('p', { style: { whiteSpace: 'pre-line' } }, r.riddle), hint, answer,
        h('div', { class: 'row' },
          r.hint ? h('button', { class: 'btn small', type: 'button', onclick: () => { hint.hidden = false; } }, 'Hint') : null,
          h('button', { class: 'btn small', type: 'button', onclick: () => { answer.hidden = false; explore.hidden = false; } }, 'Show the answer'),
          explore));
    };
    const ask = h('button', {
      class: 'btn', type: 'button',
      onclick: async () => {
        ask.disabled = true;
        ask.textContent = 'Claude is thinking of a riddle…';
        try {
          const target = k.neighbours?.length ? k.neighbours[Math.floor(Math.random() * k.neighbours.length)].id : k.id;
          s.riddle = { ...(await window.api.aiRiddle(target)), id: target };
          show(s.riddle);
        } catch (err) {
          ask.disabled = false;
          ask.textContent = 'A riddle about a related topic';
          toast(errText(err));
        }
      },
    }, 'A riddle about a related topic');
    if (s.riddle) show(s.riddle);
    else box.append(ask);
    return box;
  }

  go(0);
  return () => {
    destroyed = true;
    clearInterval(tick);
    dropQuizKey();
    gameCleanup();
  };
}

function attribution(d) {
  if (!d.attribution.length) return null;
  return h('p', { class: 'attrib muted small' },
    d.attribution.map((a, i) => [
      i ? ' · ' : '',
      a.url ? extLink(a.url, a.name) : a.name,
      ' (', a.licenseUrl ? extLink(a.licenseUrl, a.license) : a.license, ')',
    ]));
}

function relatedBlock(k) {
  const wrap = h('div', { style: { marginTop: '26px' } });
  if (k.neighbours.length) {
    wrap.append(h('h2', {}, 'Related'), h('div', { class: 'chips' }, k.neighbours.map((n) => h('a', { class: 'chip', href: `#/keyword/${n.id}` }, n.term))));
  }
  const sugg = h('div', { class: 'chips', style: { marginTop: '10px' } });
  const btn = h('button', {
    class: 'btn small', type: 'button', style: { marginTop: '14px' },
    onclick: async () => {
      btn.disabled = true;
      btn.textContent = 'Looking…';
      try {
        const titles = await window.api.suggestKeywords(k.id);
        fill(sugg, ...(titles.length ? titles.map((t) => h('button', {
          class: 'chip', type: 'button', title: `Add “${t}” as a ${k.domainLabel} keyword`,
          onclick: async (e) => {
            try {
              const added = await window.api.addKeyword(t, k.domain);
              e.currentTarget.replaceWith(h('a', { class: 'chip', href: `#/keyword/${added.id}` }, `✓ ${added.term}`));
            } catch (err) {
              toast(errText(err));
            }
          },
        }, `+ ${t}`)) : [h('span', { class: 'muted small' }, 'No suggestions.')]));
        btn.remove();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Suggest more topics from Wikipedia';
        toast(`Couldn't reach Wikipedia: ${errText(err)}`);
      }
    },
  }, 'Suggest more topics from Wikipedia');
  wrap.append(btn, sugg,
    h('p', { class: 'muted small', style: { marginTop: '10px' } }, extLink(wikipediaUrl(k.wikipedia), 'Open on Wikipedia')));
  return wrap;
}
