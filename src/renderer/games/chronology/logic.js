// Chronology: put events in order, oldest first. Online, the events are what happened on
// today's date in history (Wikipedia's "On this day"); offline, a built-in set spanning 4,500 years.
import { EVENTS } from '../_data/events.js';

export const meta = {
  id: 'chronology',
  name: 'Chronology',
  blurb: 'Put historical events in order, oldest first. Online: things that happened on today’s date.',
  howTo: ['Move events with the ▲ ▼ buttons (or Alt + arrow keys).', 'Press Check when the list runs from oldest to newest.'],
  skills: ['knowledge', 'logic'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const ROUNDS = 3;
export const sizeFor = (d) => Math.min(7, 3 + Math.ceil(d / 3));
/** Minimum gap in years between events: wide at low levels, narrow at high ones. */
export const gapFor = (d) => [200, 150, 100, 60, 40, 25, 15, 10, 5, 2][Math.min(9, d - 1)];

/** Picks n events with distinct years at least `gap` apart. */
export function pickSet(rng, events, n, gap) {
  const out = [];
  for (const e of rng.shuffle(events)) {
    if (out.every((o) => Math.abs(o.year - e.year) >= gap)) out.push(e);
    if (out.length === n) break;
  }
  return out.length === n ? out : null;
}

export function makeRounds(rng, d, online = null) {
  const n = sizeFor(d);
  const rounds = [];
  const pool = online?.length ? online.slice() : EVENTS;
  for (let r = 0; r < ROUNDS; r++) {
    let set = null;
    for (let g = gapFor(d); !set && g >= 1; g = Math.floor(g / 2)) set = pickSet(rng, pool, n, g);
    if (!set) set = pickSet(rng, EVENTS, n, gapFor(d));
    rounds.push(rng.shuffle(set));
  }
  return rounds;
}

/** Share of event pairs in the right relative order (1 = perfect, 0 = exactly reversed). */
export function orderScore(list) {
  let good = 0, total = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      total += 1;
      if (list[i].year <= list[j].year) good += 1;
    }
  }
  return total ? good / total : 1;
}
