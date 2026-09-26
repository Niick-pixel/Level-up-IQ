// Syllogisms: does the conclusion follow from the two premises?
// Validity is decided by brute force over every Venn-diagram model of three categories, with
// the traditional assumption that each category has members. No hand-written answer key.

export const meta = {
  id: 'syllogism',
  name: 'Syllogisms',
  blurb: 'Two premises, one conclusion: does it follow logically? Judge the logic, not whether it sounds true.',
  howTo: ['Assume the premises are true and every group has members.', 'Answer Valid (it must follow) or Invalid (it might not).'],
  skills: ['logic'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

const NONSENSE = ['glorps', 'blicks', 'zeems', 'frabs', 'wugs', 'toves', 'snarks', 'quibs', 'drells', 'mimsies'];
const REAL = [
  ['cats', 'mammals', 'pets'], ['roses', 'flowers', 'things that fade'], ['doctors', 'graduates', 'early risers'],
  ['whales', 'fish', 'swimmers'], ['poets', 'writers', 'dreamers'], ['squares', 'rectangles', 'shapes with four sides'],
  ['penguins', 'birds', 'flyers'], ['violins', 'instruments', 'wooden things'], ['chefs', 'artists', 'people who taste food'],
  ['bats', 'mammals', 'flyers'], ['metals', 'conductors', 'solids'], ['teachers', 'readers', 'patient people'],
];

// A statement about categories X and Y. Regions are numbered by bits: 1 = S, 2 = M, 4 = P.
export const TYPES = {
  A: (x, y) => `All ${x} are ${y}.`,
  E: (x, y) => `No ${x} are ${y}.`,
  I: (x, y) => `Some ${x} are ${y}.`,
  O: (x, y) => `Some ${x} are not ${y}.`,
};

function holds(model, type, x, y) {
  let anyXY = false, anyXnotY = false;
  for (let r = 0; r < 8; r++) {
    if (!(model & (1 << r)) || !(r & x)) continue;
    if (r & y) anyXY = true; else anyXnotY = true;
  }
  return { A: !anyXnotY, E: !anyXY, I: anyXY, O: anyXnotY }[type];
}

/** Returns null if valid, else a counterexample model (bitmask of non-empty regions). */
export function counterexample(premises, conclusion) {
  for (let model = 0; model < 256; model++) {
    const exists = [1, 2, 4].every((bit) => [...Array(8).keys()].some((r) => (model & (1 << r)) && (r & bit)));
    if (!exists) continue;
    if (premises.every((p) => holds(model, p.type, p.x, p.y)) && !holds(model, conclusion.type, conclusion.x, conclusion.y)) return model;
  }
  return null;
}

export function describeModel(model, names) {
  const parts = [];
  for (let r = 1; r < 8; r++) {
    if (!(model & (1 << r))) continue;
    const inside = [1, 2, 4].filter((b) => r & b).map((b) => names[b]);
    const outside = [1, 2, 4].filter((b) => !(r & b)).map((b) => names[b]);
    parts.push(`${inside.join(' and ')}${outside.length ? ` (not ${outside.join(' or ')})` : ''}`);
  }
  return parts.join('; ');
}

export function makeQuestions(rng, d) {
  const qs = [];
  const want = rng.shuffle([true, true, true, false, false, false]);
  for (const wantValid of want) {
    for (let tries = 0; tries < 400; tries++) {
      const words = d >= 6 && rng.chance(0.7) ? rng.pick(REAL) : rng.shuffle(NONSENSE).slice(0, 3);
      const [s, m, p] = rng.shuffle(words);
      const names = { 1: s, 2: m, 4: p };
      const t = () => rng.pick(['A', 'E', 'I', 'O']);
      const flip = (a, b) => (rng.chance(0.5) ? [a, b] : [b, a]);
      const [a1, b1] = flip(2, 4);
      const [a2, b2] = flip(1, 2);
      const premises = [{ type: t(), x: a1, y: b1 }, { type: t(), x: a2, y: b2 }];
      const conclusion = { type: t(), x: 1, y: 4 };
      const cx = counterexample(premises, conclusion);
      if ((cx === null) !== wantValid) continue;
      const sentence = (st) => TYPES[st.type](names[st.x], names[st.y]);
      qs.push({
        prompt: 'Does the conclusion follow?',
        detail: `${sentence(premises[0])} ${sentence(premises[1])} Therefore: ${sentence(conclusion)}`,
        options: ['Valid', 'Invalid'],
        answer: wantValid ? 0 : 1,
        explain: wantValid
          ? 'Valid: in every situation where both premises are true, the conclusion is true too.'
          : `Invalid. A counterexample where the premises hold but the conclusion fails: the only things that exist are ${describeModel(cx, names)}.`,
      });
      break;
    }
  }
  return qs;
}
