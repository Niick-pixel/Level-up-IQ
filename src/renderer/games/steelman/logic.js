// Steelman: build the STRONGEST version of an argument, especially one you disagree with. The
// opposite of a straw man; you understand a debate only when you can argue both sides well.
import { STEELMAN } from '../_data/thinking.js';

export const meta = {
  id: 'steelman',
  name: 'Steelman',
  blurb: 'Make the strongest possible case for a view, especially one you don’t hold.',
  howTo: ['Decide whether you agree with the statement.', 'Then write the best case for the side you DON’T hold.', 'Check yourself against the list.'],
  skills: ['deep-thinking'],
  durationRange: [180, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export function makePrompt(rng, d) {
  const s = rng.pick(STEELMAN);
  return {
    title: 'Steelman the other side',
    prompt: `“${s}” Write the strongest case for whichever side you disagree with.`,
    steps: ['State the position in a way its supporters would happily sign.', 'Give its best two or three reasons, with evidence or examples.', 'Answer the strongest objection to it.'],
    checklist: [
      'A supporter of this side would say I described it fairly',
      'I gave at least two real reasons, not jokes or weak ones',
      'I used an example or piece of evidence',
      'I answered the best objection to it',
      d >= 5 ? 'I found something in it I now think is actually true' : 'I didn’t sneak in my own opinion',
    ],
    minWords: 80 + d * 12,
  };
}
