import { meta, strength, scoreGame, parseScore, whiteShare, fmtEval, classify, capCp } from './logic.js';
import { Chess } from '../../vendor/chess/chess.js';
import { chessBoard, checkedKing, parseUci } from '../_engine/chessboard.js';
import { h, extLink, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

/** A Stockfish Web Worker speaking UCI. */
function uciEngine(url) {
  const worker = new Worker(url);
  const listeners = new Set();
  worker.onmessage = (e) => { const line = String(e.data); listeners.forEach((fn) => fn(line)); };
  const send = (cmd) => worker.postMessage(cmd);
  const waitFor = (test, ms = 30000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { listeners.delete(fn); reject(new Error('The engine did not answer')); }, ms);
    const fn = (line) => { if (test(line)) { clearTimeout(timer); listeners.delete(fn); resolve(line); } };
    listeners.add(fn);
  });
  return {
    async init(opts) {
      send('uci');
      await waitFor((l) => l === 'uciok');
      send(`setoption name Skill Level value ${opts.skill}`);
      send('ucinewgame');
      send('isready');
      await waitFor((l) => l === 'readyok');
    },
    async bestMove(fen, { depth, movetime }) {
      send(`position fen ${fen}`);
      send(`go depth ${depth} movetime ${movetime}`);
      const line = await waitFor((l) => l.startsWith('bestmove'));
      return line.split(' ')[1];
    },
    /** Best move and score (centipawns, side to move) for a position. */
    async analyse(fen, { depth, movetime }) {
      let score = 0;
      const fn = (l) => { if (l.startsWith('info') && l.includes(' score ')) { const v = parseScore(l); if (v != null) score = v; } };
      listeners.add(fn);
      try {
        send(`position fen ${fen}`);
        send(`go depth ${depth} movetime ${movetime}`);
        const line = await waitFor((l) => l.startsWith('bestmove'));
        return { best: line.split(' ')[1], score };
      } finally { listeners.delete(fn); }
    },
    stop() { send('stop'); },
    terminate() { worker.terminate(); },
  };
}

export function start(root, ctx) {
  const time = clock();
  let destroyed = false;
  let engine = null;
  const analystRef = { current: null }; // the coach's full-strength engine
  let board = null;
  let offProgress = null;
  const card = h('div', { class: 'quiz-card wide' }, h('p', { class: 'muted' }, 'Checking for the engine…'));
  root.append(card);

  window.api.engineStatus().then((st) => {
    if (destroyed) return;
    if (st.installed) play(st);
    else offer(st);
  });

  function offer(st) {
    const bar = h('div', { class: 'engine-bar', hidden: true }, h('div'));
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const btn = h('button', { class: 'btn primary', type: 'button', onclick: install }, `Download Stockfish (${(st.bytes / 1e6).toFixed(1)} MB)`);
    fill(card, 
      h('h3', {}, 'One-time download'),
      h('p', {}, `To play, Mind Gym needs the Stockfish chess engine. It's free software under the GNU GPL v3, so it isn't bundled with the app; it's downloaded once, unmodified, from its official release, and checked against a fingerprint before use.`),
      h('p', { class: 'muted small' }, st.credit, ' Source code: ', extLink(st.sourceUrl, 'stockfish.js v19.0.0'), ' · ', extLink(st.upstreamUrl, 'Stockfish'), '.'),
      h('div', { class: 'row' }, btn), bar, msg);
    function install() {
      btn.disabled = true;
      bar.hidden = false;
      msg.textContent = 'Downloading…';
      offProgress = window.api.onEngineProgress((p) => { bar.firstChild.style.width = `${Math.round((100 * p.received) / p.total)}%`; });
      window.api.installEngine().then((ready) => {
        offProgress?.();
        if (!destroyed) play(ready);
      }).catch((err) => {
        offProgress?.();
        btn.disabled = false;
        msg.textContent = `Couldn't download: ${String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`;
        msg.className = 'g-msg bad';
      });
    }
  }

  async function play(st) {
    // ---- before the game: colour and coach
    const pick = await new Promise((resolve) => {
      let color = 'random';
      let coach = true;
      const colors = [['w', 'White'], ['b', 'Black'], ['random', 'Random']].map(([v, label]) => h('button', {
        class: `chip${v === color ? ' on' : ''}`, type: 'button', 'aria-pressed': String(v === color),
        onclick: (e) => { color = v; colors.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
      }, label));
      const coachBox = h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: true, onchange: (e) => { coach = e.target.checked; } });
      fill(card,
        h('h3', {}, `Stockfish, level ${ctx.difficulty}`),
        h('div', { class: 'field' }, h('div', {}, 'Play as'), h('div', { class: 'chips' }, colors)),
        h('div', { class: 'field' }, h('div', {}, h('div', {}, 'Coach'), h('div', { class: 'hint' }, 'Hints, take-backs, a live evaluation bar, and a move-by-move review at the end. Each hint or take-back costs a little score.')), coachBox),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => resolve({ color, coach }) }, 'Start the game')));
      card.querySelector('.btn.primary').focus();
    });
    if (destroyed) return;

    const chess = new Chess();
    const player = pick.color === 'random' ? (ctx.rng.chance(0.5) ? 'w' : 'b') : pick.color;
    const coach = pick.coach;
    const s = strength(ctx.difficulty);
    const ANALYSIS = { depth: 12, movetime: 400 };
    let over = false;
    let help = 0;
    let analyst = null;
    let evalToken = 0;
    const positions = [chess.fen()]; // for the review

    const status = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const moves = h('div', { class: 'chess-moves' });
    const evalFill = h('div', { class: 'eval-fill' });
    const evalText = h('div', { class: 'eval-text' }, '0.0');
    const evalBar = h('div', { class: `eval-bar${player === 'b' ? ' flipped' : ''}`, title: 'Evaluation (White’s view)', hidden: !coach }, evalFill, evalText);
    const resign = h('button', { class: 'btn small', type: 'button', onclick: () => end('loss', 'You resigned.') }, 'Resign');
    const hintBtn = h('button', { class: 'btn small', type: 'button', hidden: !coach, onclick: hint }, 'Hint');
    const backBtn = h('button', { class: 'btn small', type: 'button', hidden: !coach, onclick: takeBack }, 'Take back');
    const after2 = h('div', { class: 'row' });
    board = chessBoard({
      orientation: player,
      legalFrom: (sq) => (over || chess.turn() !== player ? [] : chess.moves({ square: sq, verbose: true })),
      onMove: (from, to, promotion) => {
        const m = chess.move({ from, to, promotion });
        board.mark([], 'hint');
        after(m);
      },
    });
    fill(card, h('div', { class: 'chess-layout coach' }, h('div', { class: 'row', style: { alignItems: 'stretch', gap: '8px' } }, evalBar, board.el), h('div', { class: 'chess-side' },
      h('h3', { class: 'quiz-prompt' }, `You play ${player === 'w' ? 'White' : 'Black'}`),
      h('div', { class: 'muted small' }, `Stockfish, level ${ctx.difficulty} (skill ${s.skill} of 20)${coach ? ' · coach on' : ''}`),
      status, moves, h('div', { class: 'row' }, hintBtn, backBtn, resign), after2,
      h('p', { class: 'muted small' }, 'Engine: Stockfish 19 (GPL-3.0). See Licenses.'))));

    const render = (m) => {
      board.set(chess.board());
      board.last(m?.from, m?.to);
      board.check(checkedKing(chess));
      const hist = chess.history();
      moves.textContent = hist.reduce((acc, san, i) => acc + (i % 2 ? ` ${san}\n` : `${i / 2 + 1}. ${san}`), '');
      moves.scrollTop = moves.scrollHeight;
    };
    render();

    try {
      engine = uciEngine(st.url);
      status.textContent = 'Starting the engine…';
      board.lock(true);
      await engine.init(s);
      if (coach) {
        analyst = uciEngine(st.url);
        analystRef.current = analyst;
        await analyst.init({ skill: 20 });
      }
    } catch (err) {
      status.textContent = `The engine failed to start: ${err.message}`;
      status.className = 'g-msg bad';
      return;
    }
    if (destroyed) return;
    board.lock(false);
    if (player === 'w') status.textContent = 'Your move.';
    else engineMove();
    updateEval();

    // the analyst runs one job at a time; a newer request makes older results irrelevant
    let analystBusy = Promise.resolve();
    const analyse = (fen, opts = ANALYSIS) => {
      const job = analystBusy.then(() => analyst.analyse(fen, opts));
      analystBusy = job.catch(() => {});
      return job;
    };

    async function updateEval() {
      if (!analyst) return;
      const token = ++evalToken;
      const fen = chess.fen();
      const turn = chess.turn();
      try {
        const r = await analyse(fen, { depth: 10, movetime: 250 });
        if (token !== evalToken || destroyed) return;
        const white = turn === 'w' ? r.score : -r.score;
        evalFill.style.height = `${Math.round(whiteShare(capCp(white)) * 100)}%`;
        evalText.textContent = fmtEval(white);
      } catch { /* the bar is optional */ }
    }

    async function hint() {
      if (over || chess.turn() !== player || !analyst) return;
      const left = Math.ceil(ctx.hints.lockedFor() / 1000);
      if (left > 0) { status.textContent = `Think for ${left} more seconds first.`; return; }
      help += 1;
      hintBtn.disabled = true;
      status.textContent = 'The coach is looking…';
      try {
        const r = await analyse(chess.fen());
        if (destroyed || over) return;
        const m = parseUci(r.best);
        board.mark([m.from, m.to], 'hint');
        const san = chess.moves({ verbose: true }).find((x) => x.from === m.from && x.to === m.to)?.san || r.best;
        status.textContent = `Coach: consider ${san}.`;
      } finally { hintBtn.disabled = false; }
    }

    function takeBack() {
      if (over || chess.turn() !== player || chess.history().length < 2) return;
      help += 1;
      chess.undo(); chess.undo();
      positions.splice(-2);
      board.mark([], 'hint');
      render();
      status.textContent = 'Taken back. Your move.';
      updateEval();
    }

    function after(m) {
      positions.push(chess.fen());
      render(m);
      updateEval();
      if (checkEnd()) return;
      if (chess.turn() !== player) engineMove();
      else status.textContent = 'Your move.';
    }

    async function engineMove() {
      board.lock(true);
      status.textContent = 'Stockfish is thinking…';
      try {
        const uci = await engine.bestMove(chess.fen(), s);
        if (destroyed || over) return;
        const m = chess.move(parseUci(uci));
        board.lock(false);
        after(m);
      } catch (err) {
        status.textContent = `Engine error: ${err.message}`;
      }
    }

    function checkEnd() {
      if (!chess.isGameOver()) return false;
      if (chess.isCheckmate()) end(chess.turn() === player ? 'loss' : 'win', chess.turn() === player ? 'Checkmate. Stockfish wins.' : 'Checkmate! You win.');
      else if (chess.isStalemate()) end('draw', 'Stalemate: a draw.');
      else if (chess.isThreefoldRepetition()) end('draw', 'Threefold repetition: a draw.');
      else if (chess.isInsufficientMaterial()) end('draw', 'Not enough material to mate: a draw.');
      else end('draw', 'Draw (fifty-move rule).');
      return true;
    }

    function end(outcome, text) {
      if (over) return;
      over = true;
      board.lock(true);
      engine?.stop();
      [resign, hintBtn, backBtn].forEach((b) => { b.disabled = true; });
      status.textContent = text;
      status.className = `g-msg ${outcome === 'win' ? 'ok' : outcome === 'loss' ? 'bad' : ''}`;
      time.pause();
      const result = { ...scoreGame({ outcome, plies: chess.history().length, difficulty: ctx.difficulty, help }), timeMs: time.ms(), difficulty: ctx.difficulty };
      const finish = h('button', { class: 'btn primary', type: 'button', onclick: () => ctx.onFinish(result) }, 'Finish');
      const review = h('button', { class: 'btn', type: 'button', hidden: !analyst || chess.history().length < 2, onclick: () => { review.disabled = true; runReview(); } }, 'Review my game');
      fill(after2, review, finish);
      (analyst ? review : finish).focus();
    }

    // ---- post-game review: how much each of your moves gave away
    async function runReview() {
      const hist = chess.history({ verbose: true });
      const list = h('ul', { class: 'review-list' });
      const bar = h('div', { class: 'engine-bar' }, h('div'));
      const summary = h('div', { class: 'muted small' }, 'Analysing your moves…');
      fill(moves, summary, bar, list);
      moves.classList.add('reviewing');
      const evals = [];
      for (let i = 0; i < positions.length && !destroyed; i++) {
        evals.push(await analyse(positions[i], { depth: 11, movetime: 220 }).catch(() => ({ best: null, score: 0 })));
        bar.firstChild.style.width = `${Math.round((100 * (i + 1)) / positions.length)}%`;
      }
      if (destroyed) return;
      bar.remove();
      const counts = { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
      hist.forEach((m, i) => {
        if (m.color !== player) return;
        // scores are for the side to move: before = mine, after = opponent's
        const before = capCp(evals[i].score);
        const afterMine = capCp(-evals[i + 1].score);
        const best = evals[i].best;
        const isBest = best === m.from + m.to + (m.promotion || '');
        const kind = classify(before - afterMine, isBest);
        counts[kind] += 1;
        const bm = best ? parseUci(best) : null;
        const c = new Chess(positions[i]);
        const bestSan = bm ? c.moves({ verbose: true }).find((x) => x.from === bm.from && x.to === bm.to)?.san : null;
        const label = { best: 'Best', good: 'Good', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' }[kind];
        list.append(h('li', { class: `review-${kind}` },
          h('button', { class: 'linklike', type: 'button', onclick: () => show(i, m, bm) }, `${Math.floor(i / 2) + 1}${m.color === 'w' ? '.' : '…'} ${m.san}`),
          ` ${label}`, kind !== 'best' && bestSan ? h('span', { class: 'muted' }, ` · better: ${bestSan}`) : null));
      });
      const mine = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
      summary.textContent = `${counts.best + counts.good} of ${mine} moves best or good · ${counts.inaccuracy} inaccuracies · ${counts.mistake} mistakes · ${counts.blunder} blunders. Click a move to see it.`;
    }

    function show(i, m, bm) {
      const c = new Chess(positions[i]);
      board.set(c.board());
      board.last(m.from, m.to);
      board.mark(bm ? [bm.from, bm.to] : [], 'hint');
      status.textContent = `Position before ${m.san}. Green: the engine’s choice.`;
      status.className = 'g-msg';
    }
  }

  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() { destroyed = true; offProgress?.(); board?.destroy(); engine?.terminate(); analystRef.current?.terminate(); },
  };
}
