// Memory palace (method of loci): place each word at a spot along a walk through a house you
// know, picturing something vivid there. Then walk the route again and read the words back.
import { NOUNS, LOCI } from '../_data/nouns.js';

export const meta = {
  id: 'memory-palace',
  name: 'Memory palace',
  blurb: 'Learn the method of loci: pin each word to a spot on a familiar walk, then recall them in order.',
  howTo: [
    'Picture each word AT its spot, as strange and vivid as you can (a giant lobster blocking the front door).',
    'Press Ready when you have them all.',
    'Then walk the route again and type the word at each spot.',
  ],
  skills: ['memory'],
  durationRange: [120, 360],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const wordsFor = (d) => Math.min(LOCI.length, 4 + d);
/** Seconds of study allowed per word (the round never forces you on; this sets the par). */
export const parSecondsPerWord = (d) => Math.max(5, 12 - d * 0.7);

export function genRound(rng, d) {
  const n = wordsFor(d);
  const words = rng.shuffle(NOUNS).slice(0, n);
  return { pairs: LOCI.slice(0, n).map((locus, i) => ({ locus, word: words[i] })) };
}

/** Singular/plural and small typos count; the word must be at the right spot. */
export function checkRecall(pairs, answers, matches) {
  return pairs.map((p, i) => matches(answers[i] || '', [p.word, `${p.word}s`, `${p.word}es`]));
}
