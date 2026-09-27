// Kim's game (from Kipling's novel "Kim"): study a tray of objects, then spot which one was taken away.
import { OBJECTS } from '../_data/emoji.js';

export const meta = {
  id: 'kims-game',
  name: "Kim's game",
  blurb: 'Study a tray of objects. One disappears: which one?',
  howTo: ['Memorise the objects before the time runs out (or press Ready).', 'Then pick the object that was removed.', 'At higher levels the tray is shuffled too.'],
  skills: ['memory', 'attention'],
  durationRange: [60, 150],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const ROUNDS = 5;
export const itemsFor = (d) => 4 + d;
export const studyMs = (d) => Math.round(itemsFor(d) * (1100 - d * 60));
export const shuffles = (d) => d >= 5;

/** One round: the tray, what's left after one is removed, and the answer options. */
export function genRound(rng, d) {
  const pool = rng.shuffle(OBJECTS);
  const n = itemsFor(d);
  const tray = pool.slice(0, n);
  const gone = rng.int(0, n - 1);
  const left = tray.filter((_, i) => i !== gone);
  const optionCount = d >= 6 ? 6 : 4;
  // distractors come from the tray too at higher levels (they were there, but not removed)
  const fromTray = d >= 4 ? rng.shuffle(left).slice(0, Math.floor((optionCount - 1) / 2)) : [];
  const unseen = pool.slice(n, n + optionCount - 1 - fromTray.length);
  const options = rng.shuffle([tray[gone], ...fromTray, ...unseen]);
  return {
    tray,
    left: shuffles(d) ? rng.shuffle(left) : left,
    keepSlots: !shuffles(d), // when not shuffled, the gap stays where the object was
    gone: tray[gone],
    goneIndex: gone,
    options,
    answer: options.indexOf(tray[gone]),
  };
}
