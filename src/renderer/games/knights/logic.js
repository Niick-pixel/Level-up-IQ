// Knights and knaves (Raymond Smullyan's island): knights always tell the truth, knaves always lie.
// Each puzzle is checked by brute force to have exactly one consistent assignment.

export const meta = {
  id: 'knights',
  name: 'Knights and knaves',
  blurb: 'Knights always tell the truth; knaves always lie. From what they say, work out who is who.',
  howTo: ['Set each islander to Knight or Knave.', 'Check your answer when you are sure. Three islands per round.'],
  skills: ['logic'],
  durationRange: [60, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const NAMES = ['Ada', 'Bo', 'Cy', 'Dee'];
export const peopleFor = (d) => (d <= 3 ? 2 : d <= 7 ? 3 : 4);

/** Truth of a statement under an assignment (true = knight). */
export function truth(s, knights) {
  switch (s.kind) {
    case 'is': return knights[s.x] === s.knight;
    case 'same': return (knights[s.x] === knights[s.y]) === s.same;
    case 'exactly': return knights.filter(Boolean).length === s.k;
    case 'atLeastOneKnave': return knights.some((k) => !k);
    case 'or': return truth(s.a, knights) || truth(s.b, knights);
    case 'if': return !truth(s.a, knights) || truth(s.b, knights);
    default: return false;
  }
}

export function text(s, speaker) {
  const who = (x) => (x === speaker ? 'I' : NAMES[x]);
  const be = (x) => (x === speaker ? 'am' : 'is');
  switch (s.kind) {
    case 'is': return `${who(s.x)} ${be(s.x)} a ${s.knight ? 'knight' : 'knave'}`;
    case 'same': {
      const pair = s.x === speaker ? `${NAMES[s.y]} and I` : s.y === speaker ? `${NAMES[s.x]} and I` : `${NAMES[s.x]} and ${NAMES[s.y]}`;
      return `${pair} are ${s.same ? 'the same kind' : 'different kinds'}`;
    }
    case 'exactly': return `exactly ${s.k === 1 ? 'one of us is a knight' : `${s.k} of us are knights`}`;
    case 'atLeastOneKnave': return 'at least one of us is a knave';
    case 'or': return `${text(s.a, speaker)}, or ${text(s.b, speaker)}`;
    case 'if': return `if ${text(s.a, speaker)}, then ${text(s.b, speaker)}`;
    default: return '';
  }
}

function randomStatement(rng, n, speaker, level) {
  const other = () => { let x; do x = rng.int(0, n - 1); while (x === speaker); return x; };
  const simple = () => {
    const r = rng.next();
    if (r < 0.4) return { kind: 'is', x: other(), knight: rng.chance(0.5) };
    if (r < 0.7 && n >= 2) {
      const x = rng.chance(0.5) ? speaker : other();
      let y; do y = rng.int(0, n - 1); while (y === x);
      return { kind: 'same', x, y, same: rng.chance(0.5) };
    }
    if (r < 0.85) return { kind: 'exactly', k: rng.int(0, n) };
    return { kind: 'atLeastOneKnave' };
  };
  if (level >= 6 && rng.chance(0.35)) {
    const a = simple();
    let b;
    do b = simple(); while (JSON.stringify(b) === JSON.stringify(a));
    return { kind: rng.chance(0.5) ? 'or' : 'if', a, b };
  }
  return simple();
}

/** Every assignment consistent with the statements. */
export function solutions(n, statements) {
  const out = [];
  for (let m = 0; m < 1 << n; m++) {
    const knights = [...Array(n)].map((_, i) => Boolean(m & (1 << i)));
    if (statements.every(({ speaker, s }) => truth(s, knights) === knights[speaker])) out.push(knights);
  }
  return out;
}

export function generate(rng, level) {
  const n = peopleFor(level);
  for (let attempt = 0; attempt < 500; attempt++) {
    const knights = [...Array(n)].map(() => rng.chance(0.5));
    const statements = [];
    // one statement from each islander at easy levels; some say two things at hard levels
    const speakers = [...Array(n).keys()];
    if (level >= 8) speakers.push(rng.int(0, n - 1));
    for (const speaker of speakers) {
      for (let tries = 0; tries < 50; tries++) {
        const s = randomStatement(rng, n, speaker, level);
        if (truth(s, knights) === knights[speaker]) {
          statements.push({ speaker, s });
          break;
        }
      }
    }
    const sols = solutions(n, statements);
    if (sols.length === 1) return { n, statements, answer: sols[0] };
  }
  throw new Error('Could not generate an island');
}
