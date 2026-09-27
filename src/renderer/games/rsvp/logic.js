// RSVP (rapid serial visual presentation) speed reading: words flash one at a time in the same
// spot, so your eyes don't have to move. Then three questions check you actually understood.
import { PASSAGES } from '../_data/passages.js';

export const meta = {
  id: 'rsvp',
  name: 'Speed reading (RSVP)',
  blurb: 'Read a short passage flashed one word at a time, then answer three questions about it.',
  howTo: ['Keep your eyes on the centre; words appear one after another.', 'Then answer the questions (1–4 keys).', 'The speed rises with the level.'],
  skills: ['attention', 'language'],
  durationRange: [45, 120],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const wpm = (d) => 200 + (d - 1) * 45;

/** Display time for each word: longer words, commas and sentence ends get a little extra. */
export function schedule(text, d) {
  const base = 60000 / wpm(d);
  return text.split(/\s+/).filter(Boolean).map((w) => {
    let k = 1;
    if (w.length > 8) k += 0.3;
    if (/[,;:]$/.test(w)) k += 0.5;
    if (/[.!?]$/.test(w)) k += 1;
    return { word: w, ms: Math.round(base * k) };
  });
}

/** The letter to line up on the fixation point (roughly a third of the way in). */
export const pivot = (w) => Math.min(w.length - 1, Math.max(0, Math.floor((w.replace(/\W+$/, '').length - 1) / 3)));

export const pickPassage = (rng) => rng.pick(PASSAGES);
