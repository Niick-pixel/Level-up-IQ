// Chess Academy: the course, as data. Pure (no DOM), so the tests can check every position with
// chess.js: FENs are legal, every goal is reachable in one move, every opening line is legal, and
// every star exercise is solvable in its "par" number of moves.
//
// Exercise types
//   stars   move your piece(s) to collect every star; par = fewest moves (3 stars at par)
//   goal    one move that achieves a goal: capture | check | mate | castle | enpassant | promote | block
//   quiz    a multiple-choice question, optionally about a position
//   line    play one side of a line (openings); the other side is played for you
//   mate    deliver checkmate against a lone king within N moves (the king defends itself)
//   puzzles N Lichess puzzles (CC0) of one theme, easiest first

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const piece = (p, sq, stars, extra = '') => ({ type: 'stars', piece: p, start: sq, stars, extra });

export const UNITS = [
  {
    id: 'pieces',
    title: 'How the pieces move',
    blurb: 'Collect the stars. Fewer moves, more stars.',
    lessons: [
      { id: 'rook', title: 'The rook', icon: '♜', intro: ['The rook moves in straight lines: along ranks (rows) and files (columns), as far as it likes, but it can’t jump over pieces.', 'Worth about 5 pawns.'],
        exercises: [piece('R', 'a1', ['a5']), piece('R', 'a1', ['a8', 'h8']), piece('R', 'c3', ['c7', 'f7', 'f2', 'b2'])] },
      { id: 'bishop', title: 'The bishop', icon: '♝', intro: ['The bishop moves diagonally, any distance. It stays on squares of one colour for the whole game, so each side has a light-squared and a dark-squared bishop.', 'Worth about 3 pawns.'],
        exercises: [piece('B', 'c1', ['h6']), piece('B', 'c1', ['a3', 'e7']), piece('B', 'f1', ['c4', 'e6', 'h3'])] },
      { id: 'queen', title: 'The queen', icon: '♛', intro: ['The queen combines the rook and the bishop: straight lines and diagonals, any distance. The most powerful piece.', 'Worth about 9 pawns.'],
        exercises: [piece('Q', 'd1', ['d8', 'h4']), piece('Q', 'a1', ['h8', 'h1', 'a8']), piece('Q', 'e4', ['b7', 'g2', 'h7', 'a4'])] },
      { id: 'king', title: 'The king', icon: '♚', intro: ['The king moves one square in any direction. It is the piece you must never lose: if it can’t escape attack, the game is over.'],
        exercises: [piece('K', 'e1', ['e2', 'e3', 'f4']), piece('K', 'a1', ['c3', 'e3']), piece('K', 'h8', ['g6', 'e6', 'e8'])] },
      { id: 'knight', title: 'The knight', icon: '♞', intro: ['The knight jumps in an L: two squares one way and one square sideways. It is the only piece that can jump over others.', 'Worth about 3 pawns. Tip: a knight always lands on the other colour.'],
        exercises: [piece('N', 'b1', ['c3']), piece('N', 'g1', ['f3', 'e5']), piece('N', 'b1', ['d2', 'f3', 'h4', 'g6'])] },
      { id: 'pawn', title: 'The pawn', icon: '♟', intro: ['Pawns move straight forward one square, or two from their starting square. They capture one square diagonally forward. A pawn that reaches the last rank promotes, usually to a queen.'],
        exercises: [piece('P', 'e2', ['e4']), piece('P', 'e2', ['e4', 'e6']), piece('P', 'c2', ['d3', 'e4'], 'd3e4'), piece('P', 'b6', ['b8'])] },
    ],
  },
  {
    id: 'rules',
    title: 'The rules',
    blurb: 'Capturing, check, checkmate, and the special moves.',
    lessons: [
      { id: 'capture', title: 'Capturing', icon: '✕', intro: ['You capture by moving onto a square occupied by an enemy piece: it leaves the board. Pieces capture the way they move (except pawns, which capture diagonally).'],
        exercises: [
          { type: 'goal', goal: 'capture', fen: '7k/n7/8/8/8/8/8/R6K w - - 0 1', prompt: 'Capture the black knight.' },
          { type: 'goal', goal: 'capture', fen: '7k/8/8/4q3/8/8/1B6/K7 w - - 0 1', prompt: 'Win the queen.' },
          { type: 'goal', goal: 'capture', fen: '7k/8/8/3r4/8/4N3/8/K7 w - - 0 1', prompt: 'Take the rook with your knight.' },
        ] },
      { id: 'check', title: 'Check', icon: '+', intro: ['A king that is attacked is in check. The player in check must get out of it immediately.', 'Giving check is a move that attacks the enemy king.'],
        exercises: [
          { type: 'goal', goal: 'check', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', prompt: 'Give check with the rook.' },
          { type: 'goal', goal: 'check', fen: '4k3/8/8/8/8/8/8/3BK3 w - - 0 1', prompt: 'Give check with the bishop.' },
          { type: 'goal', goal: 'check', fen: '4k3/8/8/8/4N3/8/8/4K3 w - - 0 1', prompt: 'Give check with the knight.' },
        ] },
      { id: 'escape', title: 'Getting out of check', icon: '⛨', intro: ['There are three ways out of check: move the king, block the attack, or capture the attacker.'],
        exercises: [
          { type: 'goal', goal: 'block', fen: '4r2k/8/8/8/8/8/3B4/4K3 w - - 0 1', prompt: 'You are in check. Block it with a piece.' },
          { type: 'goal', goal: 'capture', fen: '4k3/8/8/8/8/1B6/2n5/4K3 w - - 0 1', prompt: 'You are in check. Capture the attacker.' },
        ] },
      { id: 'checkmate', title: 'Checkmate', icon: '#', intro: ['Checkmate: the king is in check and there is no way out. That ends the game.', 'Find the move that checkmates.'],
        exercises: [
          { type: 'goal', goal: 'mate', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', prompt: 'Checkmate in one. Black’s own pawns trap the king.' },
          { type: 'goal', goal: 'mate', fen: 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1', prompt: 'Checkmate in one with the queen.' },
          { type: 'goal', goal: 'mate', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', prompt: 'Checkmate in one with the knight (a "smothered mate").' },
          { type: 'goal', goal: 'mate', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', prompt: 'The famous four-move mate. Find it.' },
        ] },
      { id: 'stalemate', title: 'Stalemate', icon: '=', intro: ['If the player to move is not in check but has no legal move, it is stalemate: a draw.', 'When you are winning, be careful not to stalemate your opponent!'],
        exercises: [
          { type: 'quiz', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', question: 'Black to move. What is this position?', options: ['Checkmate', 'Stalemate (a draw)', 'Neither'], answer: 1, explain: 'Black is not in check, but the king has no square to go to and Black has no other pieces: stalemate.' },
          { type: 'quiz', fen: 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', question: 'Black to move. What is this position?', options: ['Checkmate', 'Stalemate (a draw)', 'Neither'], answer: 0, explain: 'The king is in check from the rook and every escape square is blocked or attacked.' },
          { type: 'quiz', fen: '7k/8/6K1/8/8/8/8/5Q2 b - - 0 1', question: 'Black to move. What is this position?', options: ['Checkmate', 'Stalemate (a draw)', 'Neither'], answer: 2, explain: 'Black is not in check and can play Kg8, so the game goes on.' },
        ] },
      { id: 'castling', title: 'Castling', icon: '♜♚', intro: ['Castling moves the king two squares toward a rook, and the rook jumps over to the other side of the king. It puts your king in safety and brings a rook into play.', 'Rules: neither piece has moved, nothing in between, and the king is not in check and doesn’t pass through or land on an attacked square. To castle here, move the king two squares.'],
        exercises: [
          { type: 'goal', goal: 'castle', fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', prompt: 'Castle, on either side.' },
          { type: 'goal', goal: 'castle', fen: '4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1', prompt: 'Castle. One side is impossible: the king can’t pass through f1, which the rook attacks.' },
        ] },
      { id: 'en-passant', title: 'En passant', icon: '⇗', intro: ['When a pawn moves two squares and lands right next to an enemy pawn, that enemy pawn may capture it as if it had moved only one square, but only on the very next move. That is "en passant" (French for "in passing").'],
        exercises: [
          { type: 'goal', goal: 'enpassant', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', prompt: 'Black just played d7–d5. Capture en passant.' },
        ] },
      { id: 'promotion', title: 'Promotion', icon: '♛', intro: ['A pawn that reaches the last rank must become a queen, rook, bishop or knight. Almost always, a queen.'],
        exercises: [
          { type: 'goal', goal: 'promote', fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', prompt: 'Promote your pawn.' },
        ] },
    ],
  },
  {
    id: 'mates',
    title: 'Basic checkmates',
    blurb: 'Win when you’re ahead: the techniques every player needs.',
    lessons: [
      { id: 'back-rank', title: 'Back-rank mate', icon: '▁', intro: ['A king behind its own pawns can be mated by a rook or queen on the back rank. It is one of the most common ways games end, so watch your own back rank too.'],
        exercises: [{ type: 'puzzles', theme: 'backRankMate', count: 4, maxRating: 1300 }] },
      { id: 'ladder', title: 'The ladder (two rooks)', icon: '♜♜', intro: ['Two rooks take turns cutting off the king, one rank at a time, until it reaches the edge: the ladder mate.', 'Keep the rooks far from the king so it can’t attack them.'],
        exercises: [{ type: 'mate', fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1', within: 10, prompt: 'Checkmate the black king within 10 moves.' }] },
      { id: 'queen-mate', title: 'Queen and king', icon: '♛♚', intro: ['Use the queen a knight’s move away from the king to shrink its box, then bring your own king close and mate on the edge.', 'Never leave the king without a move unless it is checkmate: that would be stalemate.'],
        exercises: [{ type: 'mate', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', within: 12, prompt: 'Checkmate the black king within 12 moves. Watch out for stalemate!' }] },
      { id: 'rook-mate', title: 'Rook and king', icon: '♜♚', intro: ['The rook cuts the king off along a line; your king walks up to face it (the "opposition"), then the rook checks it toward the edge.', 'It takes patience: up to 16 moves from the worst positions.'],
        exercises: [{ type: 'mate', fen: '8/8/8/4k3/8/8/8/4K2R w - - 0 1', within: 22, prompt: 'Checkmate the black king within 22 moves.' }] },
    ],
  },
  {
    id: 'tactics',
    title: 'Tactics',
    blurb: 'The patterns that win material. Real puzzles from the Lichess database.',
    lessons: [
      { id: 'hanging', title: 'Hanging pieces', icon: '!', intro: ['A piece that is attacked and not defended "hangs". Before every move, ask: what did my opponent just leave unprotected? And what am I leaving unprotected?'], exercises: [{ type: 'puzzles', theme: 'hangingPiece', count: 5, maxRating: 1200 }] },
      { id: 'mate-in-1', title: 'Mate in one', icon: '#', intro: ['Look at every check first. Checks are the most forcing moves, and sometimes one of them ends the game.'], exercises: [{ type: 'puzzles', theme: 'mateIn1', count: 6, maxRating: 1100 }] },
      { id: 'fork', title: 'Forks', icon: '⑂', intro: ['A fork attacks two (or more) pieces at once. Your opponent can save only one. Knights are famous for it, but any piece can fork.'], exercises: [{ type: 'puzzles', theme: 'fork', count: 6, maxRating: 1300 }] },
      { id: 'pin', title: 'Pins', icon: '⇥', intro: ['A pin attacks a piece that can’t move (or shouldn’t), because a more valuable piece stands behind it. A piece pinned to its king can’t legally move at all.'], exercises: [{ type: 'puzzles', theme: 'pin', count: 5, maxRating: 1400 }] },
      { id: 'skewer', title: 'Skewers', icon: '⇉', intro: ['A skewer is a pin in reverse: you attack a valuable piece, it moves out of the way, and you take the piece behind it.'], exercises: [{ type: 'puzzles', theme: 'skewer', count: 5, maxRating: 1500 }] },
      { id: 'discovered', title: 'Discovered attacks', icon: '⇢', intro: ['Move one piece out of the way and the piece behind it attacks. Two threats in one move, and if the uncovered piece gives check, the moving piece can go almost anywhere.'], exercises: [{ type: 'puzzles', theme: 'discoveredAttack', count: 5, maxRating: 1500 }] },
      { id: 'mate-in-2', title: 'Mate in two', icon: '##', intro: ['Two-move combinations: usually a forcing check or sacrifice first, then mate. Look for what the first move forces.'], exercises: [{ type: 'puzzles', theme: 'mateIn2', count: 5, maxRating: 1500 }] },
      { id: 'deflection', title: 'Deflection and attraction', icon: '↯', intro: ['Lure a defender away from its job (deflection), or drag a piece onto a bad square (attraction), often with a sacrifice.'], exercises: [{ type: 'puzzles', theme: 'deflection', count: 5, maxRating: 1600 }] },
    ],
  },
  {
    id: 'openings',
    title: 'Openings',
    blurb: 'Principles first, then a few classic lines with the idea behind each move.',
    lessons: [
      { id: 'principles', title: 'Opening principles', icon: '♙', intro: ['Three ideas cover most of the opening: control the centre, develop your knights and bishops quickly, and castle early. Memorising lines comes later.'],
        exercises: [
          { type: 'quiz', question: 'Early in the game, what is usually best?', options: ['Develop knights and bishops toward the centre', 'Move the same piece several times', 'Bring the queen out right away', 'Push the edge pawns'], answer: 0, explain: 'Every move should bring a new piece into play. An early queen gets chased around and you lose time.' },
          { type: 'quiz', question: 'Why castle early?', options: ['It puts the king in safety and connects the rooks', 'It attacks the enemy king', 'It wins a pawn', 'The rules require it'], answer: 0, explain: 'The centre opens up fast; a king left there gets attacked. Castling also brings a rook toward the middle.' },
          { type: 'quiz', question: 'What does "control the centre" mean?', options: ['Aim pawns and pieces at d4, d5, e4 and e5', 'Keep your pieces on the back rank', 'Trade queens early', 'Move the king to the middle'], answer: 0, explain: 'Pieces in or aimed at the centre reach both wings quickly, and they cramp your opponent.' },
          { type: 'quiz', question: 'Roughly, how many pawns is a rook worth?', options: ['5', '3', '9', '1'], answer: 0, explain: 'A useful guide: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is beyond price.' },
          { type: 'quiz', question: 'Your opponent offers a piece for free in the opening. What should you do first?', options: ['Check whether it’s a trap: what happens after I take?', 'Always take it', 'Never take it', 'Resign'], answer: 0, explain: 'Free material is often free, but checking your opponent’s idea first is the habit that keeps you from walking into tactics.' },
        ] },
      { id: 'italian', title: 'Italian Game', icon: '♗', intro: ['1.e4 e5 2.Nf3 Nc6 3.Bc4: quick development, the bishop aiming at f7. A classic for learning open games. You play White.'],
        exercises: [{ type: 'line', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O'],
          notes: { e4: 'Take the centre and open lines for your bishop and queen.', Nf3: 'Develop a knight and attack the e5 pawn.', Bc4: 'The bishop’s best diagonal: it aims at f7, the weakest square near Black’s king.', c3: 'Prepare d4 for a big centre, and give the bishop a retreat.', d3: 'Solid: support e4 and open the dark-squared bishop.', 'O-O': 'Castle: the king is safe and a rook joins the game.' } }] },
      { id: 'ruy-lopez', title: 'Ruy López', icon: '♗', intro: ['1.e4 e5 2.Nf3 Nc6 3.Bb5: the "Spanish", played for 500 years. White pressures the knight that defends e5. You play White.'],
        exercises: [{ type: 'line', side: 'w', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O'],
          notes: { e4: 'Take the centre.', Nf3: 'Develop and attack e5.', Bb5: 'Pressure the knight that defends e5.', Ba4: 'Keep the pressure: the bishop stays on the diagonal.', 'O-O': 'Castle early; e4 is protected by tactics.', Re1: 'Now protect e4 directly with the rook.', Bb3: 'Retreat to the strong a2–g8 diagonal, aiming at f7.', c3: 'Prepare d4, the main plan of the Spanish.' } }] },
      { id: 'queens-gambit', title: 'Queen’s Gambit', icon: '♕', intro: ['1.d4 d5 2.c4: White offers a pawn to pull Black’s d-pawn away from the centre. In the Declined, Black holds the centre with ...e6. You play White.'],
        exercises: [{ type: 'line', side: 'w', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3'],
          notes: { d4: 'Take the centre with the queen’s pawn.', c4: 'The gambit: challenge d5 from the side.', Nc3: 'Develop and add pressure on d5.', Bg5: 'Pin the knight that defends d5.', e3: 'Open the light-squared bishop and support d4.', Nf3: 'Develop, ready to castle.' } }] },
      { id: 'london', title: 'London System', icon: '♗', intro: ['1.d4 and 2.Bf4: a system rather than a line. The same solid setup against almost anything, so it’s easy to learn. You play White.'],
        exercises: [{ type: 'line', side: 'w', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6', 'Nbd2', 'Bd6', 'Bg3'],
          notes: { d4: 'Take the centre.', Bf4: 'Develop the bishop before e3 locks it in.', e3: 'Support d4 and open the other bishop.', Nf3: 'Develop and control e5.', c3: 'A solid pawn triangle: d4 is rock-solid.', Nbd2: 'Develop and keep c3 for the pawn.', Bg3: 'Keep the bishop: trading it would help Black.' } }] },
      { id: 'sicilian', title: 'Sicilian Najdorf', icon: '♟', intro: ['1.e4 c5: Black fights for the centre from the side, for an unbalanced, sharp game. The Najdorf (5...a6) is a world-championship favourite. You play Black.'],
        exercises: [{ type: 'line', side: 'b', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
          notes: { c5: 'Fight for d4 from the side.', d6: 'Control e5 and open the c8 bishop.', cxd4: 'Trade a side pawn for White’s centre pawn.', Nf6: 'Develop with tempo: e4 is attacked.', a6: 'The Najdorf: control b5, prepare ...e5 or ...b5.' } }] },
      { id: 'caro-kann', title: 'Caro-Kann', icon: '♟', intro: ['1.e4 c6 and 2...d5: solid and sound. Black challenges e4 at once and gets the light-squared bishop out before ...e6. You play Black.'],
        exercises: [{ type: 'line', side: 'b', moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6'],
          notes: { c6: 'Prepare ...d5 with pawn support.', d5: 'Challenge the centre at once.', dxe4: 'Release the tension.', Bf5: 'Develop the bishop outside the pawn chain, with tempo on the knight.', Bg6: 'Keep the bishop on its good diagonal.' } }] },
    ],
  },
  {
    id: 'endgames',
    title: 'Endgames',
    blurb: 'With few pieces left, the king becomes a fighter and every tempo counts.',
    lessons: [
      { id: 'promotion-race', title: 'Pawns and promotion', icon: '♟', intro: ['In the endgame, a passed pawn (no enemy pawns can stop it) is gold. Push it, support it with your king, and promote.'], exercises: [{ type: 'puzzles', theme: 'promotion', count: 5, maxRating: 1500 }] },
      { id: 'pawn-endgames', title: 'King and pawn endgames', icon: '♚', intro: ['Activate your king: in the endgame it is a strong piece. Count moves carefully; one tempo decides everything.'], exercises: [{ type: 'puzzles', theme: 'pawnEndgame', count: 5, maxRating: 1500 }] },
      { id: 'rook-endgames', title: 'Rook endgames', icon: '♜', intro: ['The most common endgame of all. Rooks belong behind passed pawns, and an active rook is worth more than a passive one.'], exercises: [{ type: 'puzzles', theme: 'rookEndgame', count: 5, maxRating: 1600 }] },
    ],
  },
];

export const LESSONS = UNITS.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u.id })));
export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;
export const nextLesson = (id) => LESSONS[LESSONS.findIndex((l) => l.id === id) + 1] || null;

/** FEN with just one piece (plus optional black targets) for a star exercise; white to move. */
export function starFen(ex) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(''));
  const put = (sq, p) => { board[8 - Number(sq[1])]['abcdefgh'.indexOf(sq[0])] = p; };
  put(ex.start, ex.piece);
  // optional black pawns to capture (pawn lesson), given as "d3e4"
  for (let i = 0; i < ex.extra.length; i += 2) put(ex.extra.slice(i, i + 2), 'p');
  const rows = board.map((r) => {
    let out = ''; let gap = 0;
    for (const x of r) { if (!x) gap += 1; else { if (gap) out += gap; gap = 0; out += x; } }
    return out + (gap || '');
  });
  return `${rows.join('/')} w - - 0 1`;
}

/** White to move again (star exercises have no opponent): same position, side reset. */
export const whiteAgain = (fen) => { const f = fen.split(' '); return `${f[0]} w - - 0 1`; };

/** Fewest moves that collect every star (breadth-first search). Chess = the chess.js class. */
export function starPar(ex, Chess) {
  const full = (1 << ex.stars.length) - 1;
  const seen = new Set();
  let frontier = [{ fen: starFen(ex), mask: 0 }];
  for (let depth = 1; depth <= 14; depth++) {
    const next = [];
    for (const { fen, mask } of frontier) {
      const c = new Chess(fen, { skipValidation: true });
      for (const m of c.moves({ verbose: true })) {
        const got = mask | ex.stars.reduce((b, sq, i) => (sq === m.to ? b | (1 << i) : b), 0);
        if (got === full) return depth;
        c.move(m);
        const after = whiteAgain(c.fen());
        c.undo();
        const key = `${after}|${got}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ fen: after, mask: got });
      }
    }
    frontier = next;
  }
  return null;
}

/** Stars for a lesson result: by moves against par (star exercises) or mistakes (others). */
export function starsFor({ moves, par, mistakes = 0, hints = 0 }) {
  if (par) return moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
  const slips = mistakes + 2 * hints;
  return slips === 0 ? 3 : slips <= 2 ? 2 : 1;
}

/**
 * Puzzles for a lesson: the theme's easiest few hundred, then a sample for this attempt.
 * Pack rows are [id, fen, moves, rating, themes].
 */
export function puzzlesFor(pack, { theme, count, maxRating }, rng) {
  const pool = pack.puzzles.filter((p) => p[3] <= maxRating && p[4].split(' ').includes(theme)).sort((a, b) => a[3] - b[3]).slice(0, 300);
  return rng.shuffle(pool).slice(0, count).sort((a, b) => a[3] - b[3])
    .map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes: themes.split(' ') }));
}

/** The lone king's defence in "mate" lessons: grab what it can, avoid mate in one, head for the centre. */
export function defenderMove(chess, rng) {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const centre = (sq) => Math.max(Math.abs('abcdefgh'.indexOf(sq[0]) - 3.5), Math.abs(Number(sq[1]) - 4.5));
  let best = null;
  for (const m of moves) {
    let score = m.captured ? 1000 : 0;
    chess.move(m);
    const replies = chess.moves({ verbose: true });
    const mated = replies.some((r) => { chess.move(r); const x = chess.isCheckmate(); chess.undo(); return x; });
    score += mated ? -500 : 0;
    score -= 10 * centre(m.to);
    score += replies.length * 0.1 * -1; // fewer attacking options for White is good for Black
    chess.undo();
    score += rng ? rng.next() * 0.5 : 0;
    if (!best || score > best.score) best = { m, score };
  }
  return best.m;
}

export { START };
