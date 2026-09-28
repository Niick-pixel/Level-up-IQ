// The curiosity map: which keywords you've explored, how they connect (the bank's "related"
// links), how far each domain is covered, and the frontier: unexplored topics one step away
// from something you already know.
const WEEK = 7 * 24 * 3600 * 1000;

/**
 * @param {{ bank, explored: Record<string, { first, count, domain, sessions?, bestQuiz?, bestExplain? }>, now: number }} args
 */
function curiosityMap({ bank, explored, now }) {
  const known = Object.entries(explored).filter(([id]) => bank.get(id));
  const ids = new Set(known.map(([id]) => id));
  const nodes = known.map(([id, e]) => {
    const k = bank.get(id);
    return { id, term: k.term, domain: k.domain, first: e.first, count: e.count, sessions: e.sessions || 0, quiz: e.bestQuiz || 0 };
  });
  const edges = [];
  const seen = new Set();
  for (const id of ids) {
    for (const r of bank.get(id).related) {
      if (!ids.has(r)) continue;
      const key = [id, r].sort().join('|');
      if (!seen.has(key)) { seen.add(key); edges.push([id, r]); }
    }
  }
  // frontier: related-but-unexplored topics, most connected first
  const pull = new Map();
  for (const id of ids) {
    for (const r of bank.neighbours(id).map((k) => k.id)) {
      if (ids.has(r)) continue;
      const p = pull.get(r) || { id: r, via: [] };
      p.via.push(bank.get(id).term);
      pull.set(r, p);
    }
  }
  const frontier = [...pull.values()].sort((a, b) => b.via.length - a.via.length || a.id.localeCompare(b.id)).slice(0, 12)
    .map((p) => ({ id: p.id, term: bank.get(p.id).term, domain: bank.get(p.id).domain, via: p.via.slice(0, 3) }));
  const domains = bank.domains.map((d) => ({
    id: d.id, label: d.label,
    total: bank.keywords.filter((k) => k.domain === d.id).length,
    explored: nodes.filter((n) => n.domain === d.id).length,
  }));
  // cumulative keywords explored, week by week (12 weeks)
  const growth = [];
  for (let w = 11; w >= 0; w--) {
    const end = now - w * WEEK;
    growth.push({ at: end, total: nodes.filter((n) => n.first <= end).length });
  }
  return { nodes, edges, frontier, domains, growth, total: bank.keywords.length };
}

module.exports = { curiosityMap };
