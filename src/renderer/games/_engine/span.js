// Span tasks (digit span, Corsi blocks): a simple staircase. Get one right and the next list is
// one longer; miss two in a row and it's one shorter. The round is a fixed number of trials.
import { clamp01 } from './common.js';

export const SPAN_TRIALS = 8;

export function staircase(startSpan, { min = 2, max = 12 } = {}) {
  let span = startSpan;
  let misses = 0;
  const results = [];
  return {
    get span() { return span; },
    get results() { return results.slice(); },
    get done() { return results.length >= SPAN_TRIALS; },
    record(ok) {
      results.push({ span, ok });
      if (ok) { span = Math.min(max, span + 1); misses = 0; }
      else if (++misses >= 2) { span = Math.max(min, span - 1); misses = 0; }
    },
  };
}

/** Longest list recalled correctly, and how that compares with the level's target. */
export function scoreSpan(results, startSpan, difficulty) {
  const right = results.filter((r) => r.ok);
  const best = right.reduce((m, r) => Math.max(m, r.span), 0);
  const accuracy = results.length ? right.length / results.length : 0;
  const target = startSpan + 2;
  const performance = clamp01(0.6 * Math.min(1, best / target) + 0.4 * accuracy);
  return {
    score: Math.round(right.reduce((s, r) => s + r.span * 10, 0) * (1 + difficulty / 10)),
    accuracy,
    performance,
    best,
  };
}
