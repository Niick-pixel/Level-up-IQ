// Exact arithmetic for number puzzles: fractions, a safe expression parser (no eval), and a
// solver that proves a Countdown or 24 puzzle can be done.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

export const frac = (n, d = 1) => {
  if (d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
const add = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => frac(a.n * b.n, a.d * b.d);
const div = (a, b) => (b.n === 0 ? null : frac(a.n * b.d, a.d * b.n));
export const isInt = (f) => f && f.d === 1;
export const value = (f) => f.n / f.d;

/**
 * Parses and evaluates an expression with + − × ÷ ( ) and whole numbers.
 * @returns {{ value: {n,d}, numbers: number[] }} or throws with a friendly message
 */
export function evaluate(text) {
  const src = String(text).replace(/[×x*]/g, '*').replace(/[÷/:]/g, '/').replace(/[−–]/g, '-');
  const tokens = src.match(/\d+|[-+*/()]|\S/g) || [];
  let i = 0;
  const numbers = [];
  const peek = () => tokens[i];
  const take = () => tokens[i++];
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = take();
      const r = term();
      v = op === '+' ? add(v, r) : sub(v, r);
    }
    return v;
  }
  function term() {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = take();
      const r = factor();
      v = op === '*' ? mul(v, r) : div(v, r);
      if (!v) throw new Error('Division by zero');
    }
    return v;
  }
  function factor() {
    const t = take();
    if (t === '(') {
      const v = expr();
      if (take() !== ')') throw new Error('Missing )');
      return v;
    }
    if (t && /^\d+$/.test(t)) {
      numbers.push(Number(t));
      return frac(Number(t));
    }
    throw new Error(t ? `Unexpected “${t}”` : 'Incomplete expression');
  }
  if (!tokens.length) throw new Error('Type an expression');
  const v = expr();
  if (i < tokens.length) throw new Error(`Unexpected “${tokens[i]}”`);
  return { value: v, numbers };
}

/** Were only the given numbers used, each at most as often as it appears? */
export function usesOnly(used, available) {
  const left = [...available];
  for (const n of used) {
    const k = left.indexOf(n);
    if (k < 0) return false;
    left.splice(k, 1);
  }
  return true;
}

/**
 * Searches for an expression reaching `target` from `nums`.
 * @param {object} opts  { useAll: must use every number (24), integerSteps: Countdown rules
 *                         (every intermediate result a positive whole number) }
 * @returns {string|null} one solution, e.g. "(8 − 3) × 4 + 4"
 */
export function solve(nums, target, { useAll = false, integerSteps = false } = {}) {
  const goal = frac(target);
  const items = nums.map((n) => ({ v: frac(n), s: String(n) }));
  const seen = new Set();
  function rec(list) {
    if (!useAll) for (const it of list) if (it.v.n === goal.n && it.v.d === goal.d) return it.s;
    if (list.length === 1) return useAll && list[0].v.n === goal.n && list[0].v.d === goal.d ? list[0].s : null;
    const key = list.map((x) => `${x.v.n}/${x.v.d}`).sort().join(',');
    if (seen.has(key)) return null;
    seen.add(key);
    for (let a = 0; a < list.length; a++) {
      for (let b = 0; b < list.length; b++) {
        if (a === b) continue;
        const A = list[a], B = list[b];
        const rest = list.filter((_, k) => k !== a && k !== b);
        const cands = [];
        if (a < b) cands.push({ v: add(A.v, B.v), s: `(${A.s} + ${B.s})` }, { v: mul(A.v, B.v), s: `(${A.s} × ${B.s})` });
        cands.push({ v: sub(A.v, B.v), s: `(${A.s} − ${B.s})` });
        const q = div(A.v, B.v);
        if (q) cands.push({ v: q, s: `(${A.s} ÷ ${B.s})` });
        for (const c of cands) {
          if (!c.v) continue;
          if (integerSteps && (c.v.d !== 1 || c.v.n <= 0)) continue;
          const r = rec([...rest, c]);
          if (r) return r;
        }
      }
    }
    return null;
  }
  const out = rec(items);
  return out ? tidy(out) : null;
}

/** Drops the outermost parentheses. */
function tidy(s) {
  if (!s.startsWith('(') || !s.endsWith(')')) return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (depth === 0 && i < s.length - 1) return s;
  }
  return s.slice(1, -1);
}
