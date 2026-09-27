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
import { meta as digitSpan } from './digit-span/logic.js';
import { meta as corsi } from './corsi/logic.js';
import { meta as cardPairs } from './card-pairs/logic.js';
import { meta as kimsGame } from './kims-game/logic.js';
import { meta as memoryPalace } from './memory-palace/logic.js';
import { meta as yesterday } from './yesterday/logic.js';
import { meta as flanker } from './flanker/logic.js';
import { meta as goNoGo } from './go-no-go/logic.js';
import { meta as reactionTime } from './reaction-time/logic.js';
import { meta as visualSearch } from './visual-search/logic.js';
import { meta as rsvp } from './rsvp/logic.js';
import { meta as mentalRotation } from './mental-rotation/logic.js';
import { meta as fifteen } from './fifteen/logic.js';
import { meta as rushHour } from './rush-hour/logic.js';
import { meta as mapQuiz } from './map-quiz/logic.js';
import { meta as chessPuzzles } from './chess-puzzles/logic.js';
import { meta as chessEngine } from './chess-engine/logic.js';
import { meta as connectFour } from './connect-four/logic.js';
import { meta as nim } from './nim/logic.js';
import { meta as trivia } from './trivia/logic.js';
import { meta as guessArticle } from './guess-article/logic.js';
import { meta as chronology } from './chronology/logic.js';
import { meta as flags } from './flags/logic.js';
import { meta as capitals } from './capitals/logic.js';
import { meta as explainBack } from './explain-back/logic.js';
import { meta as steelman } from './steelman/logic.js';
import { meta as firstPrinciples } from './first-principles/logic.js';
import { meta as noAiChallenge } from './no-ai-challenge/logic.js';
import { meta as riddles } from './riddles/logic.js';
import { meta as situationPuzzles } from './situation-puzzles/logic.js';
import { meta as rebus } from './rebus/logic.js';
import { meta as artQuiz } from './art-quiz/logic.js';
import { meta as speciesQuiz } from './species-quiz/logic.js';
import { meta as apodQuiz } from './apod-quiz/logic.js';
import { TATHAM } from './tatham/logic.js';

const G = (meta, load) => ({ meta, load });

export const GAMES = [
  // attention and speed
  G(stroop, () => import('./stroop/index.js')),
  G(schulte, () => import('./schulte/index.js')),
  G(flanker, () => import('./flanker/index.js')),
  G(goNoGo, () => import('./go-no-go/index.js')),
  G(reactionTime, () => import('./reaction-time/index.js')),
  G(visualSearch, () => import('./visual-search/index.js')),
  G(rsvp, () => import('./rsvp/index.js')),
  // memory
  G(nback, () => import('./nback/index.js')),
  G(digitSpan, () => import('./digit-span/index.js')),
  G(corsi, () => import('./corsi/index.js')),
  G(cardPairs, () => import('./card-pairs/index.js')),
  G(kimsGame, () => import('./kims-game/index.js')),
  G(memoryPalace, () => import('./memory-palace/index.js')),
  G(yesterday, () => import('./yesterday/index.js')),
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
  // spatial
  G(mentalRotation, () => import('./mental-rotation/index.js')),
  G(fifteen, () => import('./fifteen/index.js')),
  G(rushHour, () => import('./rush-hour/index.js')),
  G(mapQuiz, () => import('./map-quiz/index.js')),
  // strategy
  G(chessPuzzles, () => import('./chess-puzzles/index.js')),
  G(chessEngine, () => import('./chess-engine/index.js')),
  G(connectFour, () => import('./connect-four/index.js')),
  G(nim, () => import('./nim/index.js')),
  // knowledge
  G(magnitude, () => import('./magnitude/index.js')),
  G(higherLower, () => import('./higher-lower/index.js')),
  G(trivia, () => import('./trivia/index.js')),
  G(guessArticle, () => import('./guess-article/index.js')),
  G(chronology, () => import('./chronology/index.js')),
  G(flags, () => import('./flags/index.js')),
  G(capitals, () => import('./capitals/index.js')),
  G(artQuiz, () => import('./art-quiz/index.js')),
  G(speciesQuiz, () => import('./species-quiz/index.js')),
  G(apodQuiz, () => import('./apod-quiz/index.js')),
  // deep thinking
  G(explainBack, () => import('./explain-back/index.js')),
  G(steelman, () => import('./steelman/index.js')),
  G(firstPrinciples, () => import('./first-principles/index.js')),
  G(noAiChallenge, () => import('./no-ai-challenge/index.js')),
  // riddles and lateral thinking
  G(riddles, () => import('./riddles/index.js')),
  G(situationPuzzles, () => import('./situation-puzzles/index.js')),
  G(rebus, () => import('./rebus/index.js')),
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
