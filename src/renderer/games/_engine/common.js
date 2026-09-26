// Small helpers shared by the game engines and custom games.

/** Active-time clock that stops while the round is paused. */
export function clock() {
  let total = 0;
  let since = performance.now();
  let running = true;
  return {
    pause() { if (running) { total += performance.now() - since; running = false; } },
    resume() { if (!running) { since = performance.now(); running = true; } },
    ms() { return Math.round(total + (running ? performance.now() - since : 0)); },
  };
}

/** Lower-case, strip accents and punctuation: for comparing typed answers. */
export function norm(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Does a typed answer match any accepted answer (ignoring case, articles and small typos)? */
export function matches(input, accepted) {
  const a = norm(input);
  if (!a) return false;
  return accepted.some((x) => {
    const b = norm(x);
    if (a === b) return true;
    if (b.length >= 6 && editDistance(a, b) <= 1) return true;
    return false;
  });
}

export function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** Picks n distinct items (or all, if fewer). */
export const sample = (rng, arr, n) => rng.shuffle(arr).slice(0, n);

/** Clamp to [0, 1]. */
export const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

/** Level 1–10 → index into a list of n difficulty tiers. */
export const tier = (d, n) => Math.min(n - 1, Math.max(0, Math.round(((d - 1) / 9) * (n - 1))));

/** Loads a JSON pack from assets/packs once. */
const packs = new Map();
export function loadPack(name) {
  if (!packs.has(name)) {
    packs.set(name, fetch(new URL(`../../../assets/packs/${name}.json`, import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`Missing pack ${name}`);
      return r.json();
    }));
  }
  return packs.get(name);
}
