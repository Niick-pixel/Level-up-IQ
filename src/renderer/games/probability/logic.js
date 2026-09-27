// Probability intuition: predict first, then watch a simulation converge on the exact answer.
// Each scenario has an exact probability (computed, not typed in) and a simulator.

export const meta = {
  id: 'probability',
  name: 'Probability intuition',
  blurb: 'Predict a probability, then watch thousands of simulated trials reveal the truth. Monty Hall, birthdays, medical tests…',
  howTo: ['Drag the slider (or use ← →) to your prediction, then lock it in.', 'The closer your guess, the higher the score.'],
  skills: ['math', 'deep-thinking'],
  durationRange: [90, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

/** P(at least one run of k heads in n fair flips), by dynamic programming. */
export function runProbability(n, k) {
  // state: current run length (0..k-1); absorbing when reaching k
  let dist = new Array(k).fill(0);
  dist[0] = 1;
  let hit = 0;
  for (let i = 0; i < n; i++) {
    const next = new Array(k).fill(0);
    for (let s = 0; s < k; s++) {
      next[0] += dist[s] / 2; // tails
      if (s + 1 === k) hit += dist[s] / 2;
      else next[s + 1] += dist[s] / 2;
    }
    dist = next;
  }
  return hit;
}

export function birthdayProbability(n) {
  let none = 1;
  for (let i = 0; i < n; i++) none *= (365 - i) / 365;
  return 1 - none;
}

export const SCENARIOS = [
  (rng, d) => {
    const n = d <= 4 ? 3 : rng.pick([3, 4, 5]);
    return {
      title: 'Monty Hall',
      text: `A prize is behind one of ${n} doors. You pick a door. The host, who knows where the prize is, opens ${n === 3 ? 'another door' : 'one of the other doors'} with nothing behind it and offers you a switch. You always switch to ${n === 3 ? 'the other closed door' : 'a random other closed door'}. What is the chance you win?`,
      exact: n === 3 ? 2 / 3 : (n - 1) / (n * (n - 2)),
      explain: n === 3 ? 'Your first pick is right 1/3 of the time, so switching wins the other 2/3. The host\'s choice gives you information.' : `Switching wins when your first pick was wrong ((n−1)/n) and you then pick the prize among the n−2 remaining doors: (n−1)/(n(n−2)).`,
      trial: (r) => {
        const prize = r.int(0, n - 1), pick = r.int(0, n - 1);
        const hostChoices = [...Array(n).keys()].filter((x) => x !== prize && x !== pick);
        const opened = r.pick(hostChoices);
        const switchTo = r.pick([...Array(n).keys()].filter((x) => x !== pick && x !== opened));
        return switchTo === prize;
      },
    };
  },
  (rng) => {
    const n = rng.pick([10, 15, 23, 30, 40, 50, 57]);
    return {
      title: 'The birthday problem',
      text: `In a room of ${n} people, what is the chance that at least two share a birthday? (Ignore leap years; birthdays are random.)`,
      exact: birthdayProbability(n),
      explain: `With ${n} people there are ${(n * (n - 1)) / 2} pairs, each with a 1/365 chance of matching, so matches come much sooner than intuition says. 23 people already give just over 50%.`,
      trial: (r) => {
        const seen = new Set();
        for (let i = 0; i < n; i++) { const b = r.int(0, 364); if (seen.has(b)) return true; seen.add(b); }
        return false;
      },
    };
  },
  (rng) => {
    const prevalence = rng.pick([0.001, 0.005, 0.01, 0.02, 0.05]);
    const sensitivity = rng.pick([0.9, 0.95, 0.99]);
    const falsePos = rng.pick([0.01, 0.05, 0.1]);
    const exact = (prevalence * sensitivity) / (prevalence * sensitivity + (1 - prevalence) * falsePos);
    return {
      title: 'A positive test',
      text: `A disease affects ${pct(prevalence)} of people. A test catches ${pct(sensitivity)} of real cases, but also comes back positive for ${pct(falsePos)} of healthy people. You test positive. What is the chance you actually have the disease?`,
      exact,
      explain: 'Bayes\' theorem: when a disease is rare, false positives from the huge healthy group can outnumber the true positives.',
      trial: (r) => {
        // sample people until one tests positive, then report whether they are sick
        for (;;) {
          const sick = r.chance(prevalence);
          if (r.chance(sick ? sensitivity : falsePos)) return sick;
        }
      },
    };
  },
  (rng, d) => {
    const n = rng.pick([10, 20, 30]);
    const k = d <= 5 ? 4 : rng.pick([4, 5, 6]);
    return {
      title: 'Streaks',
      text: `You flip a fair coin ${n} times. What is the chance of seeing at least ${k} heads in a row somewhere?`,
      exact: runProbability(n, k),
      explain: 'Streaks are more common than they feel: randomness is clumpy. That is why "hot hands" are easy to imagine.',
      trial: (r) => {
        let run = 0;
        for (let i = 0; i < n; i++) { if (r.chance(0.5)) { run++; if (run >= k) return true; } else run = 0; }
        return false;
      },
    };
  },
  () => ({
    title: 'The gambler',
    text: 'A fair coin has just landed heads 5 times in a row. What is the chance the next flip is heads?',
    exact: 0.5,
    explain: 'The coin has no memory. Expecting tails to be "due" is the gambler\'s fallacy.',
    trial: (r) => r.chance(0.5),
  }),
  () => ({
    title: 'Two children',
    text: 'A family has two children, and you are told at least one of them is a boy. What is the chance both are boys? (Each child is a boy or girl with equal chance.)',
    exact: 1 / 3,
    explain: 'The possibilities with at least one boy are BB, BG and GB, equally likely, so both are boys in 1 of 3.',
    trial: (r) => {
      for (;;) {
        const a = r.chance(0.5), b = r.chance(0.5);
        if (a || b) return a && b;
      }
    },
  }),
  (rng) => rng.pick([
    { title: 'The Chevalier de Méré (1)', text: 'You roll one die four times. What is the chance of at least one six?', exact: 1 - (5 / 6) ** 4, explain: '1 − (5/6)⁴ ≈ 51.8%. A 17th-century gambler noticed he won this bet slightly more often than not.', trial: (r) => [0, 1, 2, 3].some(() => r.int(1, 6) === 6) },
    { title: 'The Chevalier de Méré (2)', text: 'You roll two dice 24 times. What is the chance of at least one double six?', exact: 1 - (35 / 36) ** 24, explain: '1 − (35/36)²⁴ ≈ 49.1%: just under even odds. This puzzle helped start probability theory (Pascal and Fermat, 1654).', trial: (r) => [...Array(24)].some(() => r.int(1, 6) === 6 && r.int(1, 6) === 6) },
    { title: 'Sum of two dice', text: 'You roll two dice. What is the chance their sum is 7?', exact: 1 / 6, explain: '6 of the 36 outcomes add to 7, the most of any sum.', trial: (r) => r.int(1, 6) + r.int(1, 6) === 7 },
  ]),
];

export function scoreGuess(guess, exact) {
  return Math.max(0, 1 - Math.abs(guess - exact) / 0.4);
}
