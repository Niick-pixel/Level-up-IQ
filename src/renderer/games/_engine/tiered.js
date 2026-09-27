// Picks items for a level: first those at the level's tier (1 easy, 2 medium, 3 hard), then the
// neighbouring tiers, so a small bank never runs dry.
export const tierOf = (d) => (d <= 3 ? 1 : d <= 7 ? 2 : 3);

export function pickTiered(rng, items, d, n) {
  const t = tierOf(d);
  const at = (k) => rng.shuffle(items.filter((x) => x.level === k));
  const order = t === 1 ? [1, 2, 3] : t === 2 ? [2, 1, 3] : [3, 2, 1];
  return order.flatMap(at).slice(0, n);
}
