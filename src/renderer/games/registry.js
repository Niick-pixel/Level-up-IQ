// Every game in the catalog. Metadata (and small pure logic) loads up front; each game's UI
// module loads only when you open it, so the app starts fast.
import { meta as mentalMath } from './mental-math/logic.js';
import { meta as stroop } from './stroop/logic.js';
import { meta as nback } from './nback/logic.js';
import { meta as schulte } from './schulte/logic.js';
import { meta as wordLadder } from './word-ladder/logic.js';
import { meta as zebra } from './zebra/logic.js';
import { meta as knights } from './knights/logic.js';
import { meta as mastermind } from './mastermind/logic.js';
import { meta as hanoi } from './hanoi/logic.js';
import { meta as syllogism } from './syllogism/logic.js';
import { meta as fallacy } from './fallacy/logic.js';
import { meta as countdownNumbers } from './countdown-numbers/logic.js';
import { meta as game24 } from './game-24/logic.js';
import { meta as fermi } from './fermi/logic.js';
import { meta as sequences } from './sequences/logic.js';
import { meta as kakuro } from './kakuro/logic.js';
import { meta as probability } from './probability/logic.js';
import { meta as magnitude } from './magnitude/logic.js';
import { meta as higherLower } from './higher-lower/logic.js';
import { meta as countdownLetters } from './countdown-letters/logic.js';
import { meta as anagram } from './anagram/logic.js';
import { meta as wordle } from './wordle/logic.js';
import { meta as cryptogram } from './cryptogram/logic.js';
import { meta as crossword } from './crossword/logic.js';
import { meta as etymology } from './etymology/logic.js';
import { TATHAM } from './tatham/logic.js';

const G = (meta, load) => ({ meta, load });

export const GAMES = [
  // attention and speed
  G(stroop, () => import('./stroop/index.js')),
  G(schulte, () => import('./schulte/index.js')),
  // memory
  G(nback, () => import('./nback/index.js')),
  // math
  G(mentalMath, () => import('./mental-math/index.js')),
  G(countdownNumbers, () => import('./countdown-numbers/index.js')),
  G(game24, () => import('./game-24/index.js')),
  G(fermi, () => import('./fermi/index.js')),
  G(sequences, () => import('./sequences/index.js')),
  G(kakuro, () => import('./kakuro/index.js')),
  G(probability, () => import('./probability/index.js')),
  // logic
  G(zebra, () => import('./zebra/index.js')),
  G(knights, () => import('./knights/index.js')),
  G(mastermind, () => import('./mastermind/index.js')),
  G(hanoi, () => import('./hanoi/index.js')),
  G(syllogism, () => import('./syllogism/index.js')),
  G(fallacy, () => import('./fallacy/index.js')),
  // language
  G(wordLadder, () => import('./word-ladder/index.js')),
  G(countdownLetters, () => import('./countdown-letters/index.js')),
  G(anagram, () => import('./anagram/index.js')),
  G(wordle, () => import('./wordle/index.js')),
  G(cryptogram, () => import('./cryptogram/index.js')),
  G(crossword, () => import('./crossword/index.js')),
  G(etymology, () => import('./etymology/index.js')),
  // knowledge
  G(magnitude, () => import('./magnitude/index.js')),
  G(higherLower, () => import('./higher-lower/index.js')),
  // Simon Tatham's Portable Puzzle Collection
  ...TATHAM.map((t) => G(t.meta, () => import('./tatham/index.js'))),
];

export const byId = (id) => GAMES.find((g) => g.meta.id === id) || null;

export function searchGames(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return GAMES.filter(({ meta }) =>
    meta.name.toLowerCase().includes(q) || meta.id.includes(q) || meta.skills.some((s) => s.startsWith(q)));
}
