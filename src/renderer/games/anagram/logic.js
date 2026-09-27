// Anagrams: unscramble a word. Words come from the common-word list and, at higher levels,
// from the keyword bank's one-word topics (with the topic's field as a hint).
export const meta = {
  id: 'anagram',
  name: 'Anagrams',
  blurb: 'Unscramble the letters into a word. Longer words and keyword-bank topics at higher levels.',
  howTo: ['Type the word and press Enter. Any valid anagram counts.', 'Hints unlock after the thinking timer.'],
  skills: ['language'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export function scramble(rng, word) {
  for (let i = 0; i < 20; i++) {
    const s = rng.shuffle([...word]).join('');
    if (s !== word) return s;
  }
  return [...word].reverse().join('');
}

/**
 * @param {{ common5: string[] }} pack
 * @param {{ term: string, domainLabel: string }[]} topics one-word keyword topics (letters only)
 */
export function makeItems(rng, d, pack, topics, dict) {
  const long = topics.filter((t) => t.word.length >= (d <= 6 ? 6 : 7) && t.word.length <= (d <= 6 ? 8 : 10));
  return [...Array(5)].map(() => {
    const useTopic = d >= 4 && long.length && rng.chance(d >= 7 ? 0.8 : 0.5);
    const t = useTopic ? rng.pick(long) : null;
    const word = t ? t.word : rng.pick(pack.common5);
    const letters = scramble(rng, word);
    const sorted = [...word].sort().join('');
    return {
      prompt: t ? `Unscramble this ${t.domain} topic` : 'Unscramble the word',
      detail: letters.toUpperCase().split('').join(' '),
      check: (x) => {
        const w = x.toLowerCase().replace(/[^a-z]/g, '');
        return w === word || ([...w].sort().join('') === sorted && Boolean(dict[w.length]?.has(w)));
      },
      answerText: word.toUpperCase(),
      hint: `Starts with ${word[0].toUpperCase()}, ends with ${word.at(-1).toUpperCase()}`,
    };
  });
}
