import { meta, makeItems } from './logic.js';
import { inputGame } from '../_engine/input.js';
import { loadWordPack, loadDictionary } from '../_engine/words.js';


export { meta };

async function load() {
  const [pack, dict, bank] = await Promise.all([loadWordPack(), loadDictionary(), fetch(new URL('../../../assets/keywords.json', import.meta.url)).then((r) => r.json())]);
  const labels = new Map(bank.domains.map((d) => [d.id, d.label]));
  const topics = bank.keywords
    .map((k) => ({ word: k.term.toLowerCase(), domain: labels.get(k.domain) }))
    .filter((t) => /^[a-z]+$/.test(t.word));
  return { pack, dict, topics };
}

export const game = inputGame({
  meta,
  load,
  makeItems: (rng, d, data) => makeItems(rng, d, data.pack, data.topics, data.dict),
  attempts: 3,
  hintFor: (it) => it.hint,
});
export const start = game.start;
