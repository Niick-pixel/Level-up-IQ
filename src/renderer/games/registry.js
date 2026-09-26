// Every game in the catalog. Metadata is loaded up front (it's tiny); each game's UI module is
// loaded only when you open it, so the app starts fast.
import { meta as mentalMath } from './mental-math/logic.js';
import { meta as stroop } from './stroop/logic.js';
import { meta as nback } from './nback/logic.js';
import { meta as schulte } from './schulte/logic.js';
import { meta as wordLadder } from './word-ladder/logic.js';

export const GAMES = [
  { meta: mentalMath, load: () => import('./mental-math/index.js') },
  { meta: stroop, load: () => import('./stroop/index.js') },
  { meta: nback, load: () => import('./nback/index.js') },
  { meta: schulte, load: () => import('./schulte/index.js') },
  { meta: wordLadder, load: () => import('./word-ladder/index.js') },
];

export const byId = (id) => GAMES.find((g) => g.meta.id === id) || null;

export function searchGames(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return GAMES.filter(({ meta }) =>
    meta.name.toLowerCase().includes(q) || meta.id.includes(q) || meta.skills.some((s) => s.startsWith(q)));
}
