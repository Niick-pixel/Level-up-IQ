// No-AI challenge of the day: one small real-world task, the same for everyone on a given date,
// done by hand and with your own head. Plan it now; come back later to reflect.
import { CHALLENGES } from '../_data/thinking.js';
import { makeRng, localDateKey } from '../../../shared/rng.js';

export const meta = {
  id: 'no-ai-challenge',
  name: 'No-AI challenge of the day',
  blurb: 'A small real-world task to do by hand today. Plan it, do it, then reflect.',
  howTo: ['Read today’s challenge.', 'Write how you will do it (or how it went, if you already did).', 'Tick what applies.'],
  skills: ['deep-thinking'],
  durationRange: [120, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

/** Today's challenge: picked by the date, not the round's seed. */
export const challengeFor = (dateKey) => makeRng(`no-ai:${dateKey}`).pick(CHALLENGES);

export function makePrompt(_rng, d, dateKey = localDateKey()) {
  return {
    title: `No-AI challenge · ${dateKey}`,
    prompt: challengeFor(dateKey),
    steps: ['Write your plan: when, where, and how you will do it.', 'If you have done it already: what was hard, and what did you learn?'],
    checklist: [
      'I have a concrete plan (a time and a place)',
      'I did it (or I will today)',
      'I didn’t use AI or search to do the thinking for me',
      'I noticed something I would not have noticed otherwise',
    ],
    minWords: 40 + d * 8,
  };
}
