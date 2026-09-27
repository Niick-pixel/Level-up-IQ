// A Wordle-style game: guess the five-letter word in six tries.
export const meta = {
  id: 'wordle',
  name: 'Five-letter word',
  blurb: 'Guess the hidden five-letter word in six tries. Each guess shows which letters are right, and where.',
  howTo: ['Type a word and press Enter.', '✓ right letter, right place · ~ right letter, wrong place · · not in the word.'],
  skills: ['language', 'logic'],
  durationRange: [60, 400],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const MAX_TRIES = 6;

/** Per-letter result: 'hit' | 'near' | 'miss', handling repeated letters like the original. */
export function score(answer, guess) {
  const res = Array(5).fill('miss');
  const left = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) res[i] = 'hit';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'hit') continue;
    if (left[guess[i]] > 0) { res[i] = 'near'; left[guess[i]] -= 1; }
  }
  return res;
}
