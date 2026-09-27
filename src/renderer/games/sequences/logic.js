// Number sequences: find the rule, give the next term. Every rule is generated, so the
// answer is always determined by the rule the level uses (and the explanation names it).
export const meta = {
  id: 'sequences',
  name: 'Number sequences',
  blurb: 'Spot the rule and type the next number.',
  howTo: ['Type the next term and press Enter.', 'Rules get more intricate at higher levels.'],
  skills: ['math', 'logic'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];

// Each rule: min level, and make(rng) → { terms (≥ 6; the term after those shown is the answer), rule }
export const RULES = [
  { min: 1, make: (r) => { const a = r.int(1, 20), s = r.int(2, 9); return { terms: [...Array(6)].map((_, i) => a + s * i), rule: `add ${s} each time` }; } },
  { min: 1, make: (r) => { const a = r.int(60, 99), s = r.int(2, 9); return { terms: [...Array(6)].map((_, i) => a - s * i), rule: `subtract ${s} each time` }; } },
  { min: 2, make: (r) => { const a = r.int(1, 5), q = r.int(2, 3); return { terms: [...Array(6)].map((_, i) => a * q ** i), rule: `multiply by ${q} each time` }; } },
  { min: 3, make: (r) => { const o = r.int(0, 3); return { terms: [...Array(6)].map((_, i) => (i + 1 + o) ** 2), rule: 'square numbers' }; } },
  { min: 3, make: (r) => { const a = r.int(1, 5), b = r.int(1, 5); const t = [a, b]; while (t.length < 7) t.push(t.at(-1) + t.at(-2)); return { terms: t, rule: 'each term is the sum of the two before it' }; } },
  { min: 4, make: (r) => { const a = r.int(1, 10), s = r.int(1, 4); const t = [a]; for (let i = 1; i < 6; i++) t.push(t.at(-1) + s * i); return { terms: t, rule: `the gaps grow by ${s}: +${s}, +${2 * s}, +${3 * s}…` }; } },
  { min: 4, make: (r) => { const o = r.int(0, 8); return { terms: PRIMES.slice(o, o + 6), rule: 'prime numbers' }; } },
  { min: 5, make: (r) => { const o = r.int(1, 4); return { terms: [...Array(6)].map((_, i) => ((i + o) * (i + o + 1)) / 2), rule: 'triangular numbers (1, 3, 6, 10, …)' }; } },
  { min: 5, make: (r) => { const a = r.int(1, 9), b = r.int(20, 40), s = r.int(2, 5), u = r.int(2, 5); const t = []; for (let i = 0; i < 7; i++) t.push(i % 2 ? b - u * ((i - 1) / 2) : a + s * (i / 2)); return { terms: t, rule: `two interleaved sequences: one adds ${s}, the other subtracts ${u}` }; } },
  { min: 6, make: (r) => { const o = r.int(1, 3); return { terms: [...Array(6)].map((_, i) => (i + o) ** 3), rule: 'cube numbers' }; } },
  { min: 6, make: (r) => { const a = r.int(2, 6), m = r.int(2, 3), c = r.int(1, 3); const t = [a]; while (t.length < 6) t.push(t.at(-1) * m + c); return { terms: t, rule: `multiply by ${m}, then add ${c}` }; } },
  { min: 7, make: (r) => { const o = r.int(1, 3); return { terms: [...Array(6)].map((_, i) => 2 ** (i + o) - 1), rule: 'one less than powers of 2' }; } },
  { min: 7, make: (r) => { const a = r.int(1, 4); const t = [a, a + 1, a + 2]; while (t.length < 7) t.push(t.at(-1) + t.at(-2) + t.at(-3)); return { terms: t, rule: 'each term is the sum of the three before it' }; } },
  { min: 8, make: (r) => { const o = r.int(1, 3); return { terms: [...Array(6)].map((_, i) => (i + o) ** 2 + (i + o)), rule: 'n² + n (products of consecutive numbers)' }; } },
  { min: 8, make: () => ({ terms: [1, 2, 6, 24, 120, 720], rule: 'factorials: multiply by 2, 3, 4, 5…' }) },
  { min: 9, make: (r) => { const o = r.int(0, 5); return { terms: PRIMES.slice(o, o + 6).map((p) => p * p), rule: 'squares of prime numbers' }; } },
  { min: 9, make: (r) => { const a = r.int(2, 5); const t = [a]; for (let i = 1; i < 6; i++) t.push(i % 2 ? t.at(-1) * 2 : t.at(-1) + 3); return { terms: t, rule: 'alternately double, then add 3' }; } },
];

export function makeItems(rng, d) {
  const pool = RULES.filter((x) => x.min <= d);
  const recent = pool.filter((x) => x.min >= d - 3);
  return [...Array(5)].map(() => {
    const rule = (recent.length && rng.chance(0.6) ? rng.pick(recent) : rng.pick(pool)).make(rng);
    const shown = rule.terms.slice(0, rule.terms.length - 1);
    const answer = rule.terms.at(-1);
    return {
      prompt: 'What comes next?',
      detail: `${shown.join(',  ')},  …`,
      check: (t) => Number(String(t).replace(/,/g, '')) === answer,
      answerText: String(answer),
      explain: `Rule: ${rule.rule}.`,
      inputmode: 'numeric',
    };
  });
}
