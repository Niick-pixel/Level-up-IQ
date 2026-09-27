// A small chessboard for the chess games: Unicode pieces (no image assets), click a piece then
// a square, or use the keyboard (arrows to move the cursor, Enter to pick up / drop).
// It knows nothing about rules; the game passes in legal moves from chess.js.
import { h } from '../../ui.js';

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const FILES = 'abcdefgh';

/**
 * @param {{ orientation: 'w'|'b', legalFrom: (sq) => {to, promotion?}[], onMove: (from, to, promotion?) => void }} opts
 */
export function chessBoard({ orientation = 'w', legalFrom, onMove }) {
  let selected = null;
  let cursor = orientation === 'w' ? 'e2' : 'e7';
  let locked = false;
  let pendingPromo = null;
  const squares = new Map();
  const grid = h('div', { class: 'cb-board', role: 'grid', 'aria-label': 'Chessboard' });
  const promo = h('div', { class: 'cb-promo', hidden: true });
  const el = h('div', { class: 'cb-wrap' }, grid, promo);

  const order = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const rank = orientation === 'w' ? 8 - r : r + 1;
      const file = orientation === 'w' ? FILES[c] : FILES[7 - c];
      order.push(`${file}${rank}`);
    }
  }
  for (const sq of order) {
    const dark = (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 0;
    const b = h('button', { class: `cb-sq ${dark ? 'dark' : 'light'}`, type: 'button', tabindex: '-1', 'data-sq': sq, onclick: () => click(sq) });
    squares.set(sq, b);
    grid.append(b);
  }
  // coordinates on the edge squares
  order.forEach((sq, i) => {
    if (i % 8 === 0) squares.get(sq).append(h('span', { class: 'cb-rank' }, sq[1]));
    if (i >= 56) squares.get(sq).append(h('span', { class: 'cb-file' }, sq[0]));
  });

  function set(board) {
    // board: chess.js board() → 8 rows from rank 8, each [{ type, color } | null]
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = `${FILES[c]}${8 - r}`;
        const p = board[r][c];
        const b = squares.get(sq);
        b.querySelector('.cb-piece')?.remove();
        b.dataset.piece = p ? p.color + p.type : '';
        if (p) b.prepend(h('span', { class: `cb-piece ${p.color === 'w' ? 'white' : 'black'}`, 'aria-hidden': 'true' }, `${GLYPH[p.type]}︎`));
        b.setAttribute('aria-label', `${sq}${p ? `, ${p.color === 'w' ? 'white' : 'black'} ${NAME[p.type]}` : ''}`);
      }
    }
    clearMarks();
  }

  function clearMarks() {
    selected = null;
    squares.forEach((b) => b.classList.remove('sel', 'target', 'capture'));
  }

  function select(sq) {
    clearMarks();
    const moves = legalFrom(sq);
    if (!moves.length) return;
    selected = sq;
    squares.get(sq).classList.add('sel');
    for (const m of moves) squares.get(m.to).classList.add(squares.get(m.to).dataset.piece ? 'capture' : 'target');
  }

  function click(sq) {
    if (locked || pendingPromo) return;
    setCursor(sq);
    if (selected && sq !== selected) {
      const moves = legalFrom(selected).filter((m) => m.to === sq);
      if (moves.length) {
        const from = selected;
        clearMarks();
        if (moves.some((m) => m.promotion)) return askPromotion(from, sq);
        return onMove(from, sq);
      }
    }
    if (sq === selected) return clearMarks();
    select(sq);
  }

  function askPromotion(from, to) {
    pendingPromo = { from, to };
    const color = squares.get(from).dataset.piece[0];
    promo.replaceChildren(h('span', { class: 'muted small' }, 'Promote to:'), ...['q', 'r', 'b', 'n'].map((t) => h('button', {
      class: 'btn', type: 'button', 'aria-label': NAME[t],
      onclick: () => { promo.hidden = true; pendingPromo = null; onMove(from, to, t); },
    }, h('span', { class: `cb-piece ${color === 'w' ? 'white' : 'black'}` }, `${GLYPH[t]}︎`))));
    promo.hidden = false;
    promo.querySelector('button').focus();
  }

  function setCursor(sq) {
    squares.get(cursor)?.classList.remove('cursor');
    cursor = sq;
    squares.get(cursor).classList.add('cursor');
  }

  function onKey(e) {
    if (locked || pendingPromo || !document.body.contains(el)) return;
    const f = FILES.indexOf(cursor[0]);
    const r = Number(cursor[1]);
    const flip = orientation === 'w' ? 1 : -1;
    const d = { ArrowUp: [0, flip], ArrowDown: [0, -flip], ArrowLeft: [-flip, 0], ArrowRight: [flip, 0] }[e.key];
    if (d) {
      e.preventDefault();
      const nf = Math.min(7, Math.max(0, f + d[0]));
      const nr = Math.min(8, Math.max(1, r + d[1]));
      setCursor(`${FILES[nf]}${nr}`);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      click(cursor);
    } else if (e.key === 'Escape') clearMarks();
  }
  document.addEventListener('keydown', onKey);
  setCursor(cursor);

  return {
    el,
    set,
    /** Marks the last move played. */
    last(from, to) {
      squares.forEach((b) => b.classList.remove('last'));
      if (from) squares.get(from).classList.add('last');
      if (to) squares.get(to).classList.add('last');
    },
    check(sq) {
      squares.forEach((b) => b.classList.remove('check'));
      if (sq) squares.get(sq).classList.add('check');
    },
    flash(sq, cls) {
      const b = squares.get(sq);
      b.classList.add(cls);
      setTimeout(() => b.classList.remove(cls), 700);
    },
    lock(on) { locked = on; if (on) clearMarks(); },
    destroy() { document.removeEventListener('keydown', onKey); },
  };
}

/** Square of the king of the side to move if it's in check (for highlighting). */
export function checkedKing(chess) {
  if (!chess.inCheck()) return null;
  const turn = chess.turn();
  const b = chess.board();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c]?.type === 'k' && b[r][c].color === turn) return `${FILES[c]}${8 - r}`;
  return null;
}

/** UCI "e7e8q" → { from, to, promotion }. */
export const parseUci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] || undefined });
