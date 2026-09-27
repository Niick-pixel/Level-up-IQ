import { meta, strength, scoreGame } from './logic.js';
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
    stop() { send('stop'); },
    terminate() { worker.terminate(); },
  };
}

export function start(root, ctx) {
  const time = clock();
  let destroyed = false;
  let engine = null;
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
    const chess = new Chess();
    const player = ctx.rng.chance(0.5) ? 'w' : 'b';
    const s = strength(ctx.difficulty);
    let over = false;

    const status = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const moves = h('div', { class: 'chess-moves' });
    const resign = h('button', { class: 'btn small', type: 'button', onclick: () => end('loss', 'You resigned.') }, 'Resign');
    board = chessBoard({
      orientation: player,
      legalFrom: (sq) => (over || chess.turn() !== player ? [] : chess.moves({ square: sq, verbose: true })),
      onMove: (from, to, promotion) => {
        const m = chess.move({ from, to, promotion });
        after(m);
      },
    });
    fill(card, h('div', { class: 'chess-layout' }, board.el, h('div', { class: 'chess-side' },
      h('h3', { class: 'quiz-prompt' }, `You play ${player === 'w' ? 'White' : 'Black'}`),
      h('div', { class: 'muted small' }, `Stockfish, level ${ctx.difficulty} (skill ${s.skill} of 20)`),
      status, moves, h('div', { class: 'row' }, resign),
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
    } catch (err) {
      status.textContent = `The engine failed to start: ${err.message}`;
      status.className = 'g-msg bad';
      return;
    }
    if (destroyed) return;
    board.lock(false);
    if (player === 'w') status.textContent = 'Your move.';
    else engineMove();

    function after(m) {
      render(m);
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
      resign.disabled = true;
      status.textContent = text;
      status.className = `g-msg ${outcome === 'win' ? 'ok' : outcome === 'loss' ? 'bad' : ''}`;
      time.pause();
      setTimeout(() => ctx.onFinish({ ...scoreGame({ outcome, plies: chess.history().length, difficulty: ctx.difficulty }), timeMs: time.ms(), difficulty: ctx.difficulty }), 1800);
    }
  }

  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() { destroyed = true; offProgress?.(); board?.destroy(); engine?.terminate(); },
  };
}
