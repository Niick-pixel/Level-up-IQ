// Word-list loading shared by the word games.
import { loadPack } from './common.js';

let dictPromise = null;
/** Map length → Set of words (3–9 letters). */
export function loadDictionary() {
  dictPromise ||= loadPack('dictionary-en').then((d) => {
    const out = {};
    for (const [k, v] of Object.entries(d)) if (/^\d+$/.test(k)) out[k] = new Set(v.split(' '));
    return out;
  });
  return dictPromise;
}

export const loadWordPack = () => loadPack('words-en');

/** Can `word` be made from `letters` (each letter used at most as often as it appears)? */
export function canMake(word, letters) {
  const left = [...letters];
  for (const ch of word) {
    const i = left.indexOf(ch);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}
