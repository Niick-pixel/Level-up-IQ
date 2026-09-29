// "Explain it back", graded locally: which of the summary's key ideas did your explanation cover?
// Deliberately simple and transparent. Key ideas come, in order of weight, from:
//   1. topics in the keyword bank that the summary mentions ("information theory")
//   2. names of people and places ("Clausius")
//   3. the summary's most frequent content words
// and you see exactly which ones you hit and missed. With Claude turned on (optional, your own key),
// src/main/ai.js grades for meaning instead, and this stays the offline fallback.

const STOP = new Set(`a about above according across after again against all almost also although always am among an and
another any are around as at be became because become been before being below between both but by can could did do does
doing down during each either else especially even ever every few first for form forms from further generally had has have
having he her here hers him his how however i if in include included includes including into is it its itself just known
later latter least less like made main mainly make many may me might more most much must my named names name near nearly
no nor not now of off often on once one only or other others our out over own part particular per perhaps rather same
several she should since so some such than that the their them then there these they this those though through thus to
too two three under until up upon us use used uses using usually various very was way we well were what when where
whether which while who whom whose why will with within without would yet you your also called concept concepts term terms
field fields associated commonly common diverse description describe described describes refer refers referred
regarded considered example examples type types kind kinds number numbers based around among itself new old recent
recently today modern early large small high low long great major important different similar certain specific
especially notable noted widely primarily typically first second third leading founder founders defined define
recognized recognised principles principle`.split(/\s+/));

/** A tiny suffix stripper: good enough to match "decays" with "decay" and "evolved" with "evolve". */
function stem(w) {
  let s = w;
  for (const [suf, min] of [['ational', 8], ['ization', 8], ['ations', 7], ['ation', 6], ['ities', 6], ['ity', 5], ['ness', 6], ['ments', 7], ['ment', 6], ['ings', 6], ['ing', 5], ['ies', 5], ['ied', 5], ['ed', 4], ['es', 4], ['ly', 4], ['s', 4]]) {
    if (s.length >= min && s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
      if (suf === 'ies' || suf === 'ied') s += 'y';
      break;
    }
  }
  return s.replace(/e$/, '');
}

const fold = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

function words(text) {
  return (fold(text).match(/[a-z][a-z-]{2,}/g) || []).filter((w) => !STOP.has(w));
}

/**
 * @param {string} extract
 * @param {string[]} names    the topic's own names (never counted as ideas)
 * @param {string[]} vocab    known topic phrases (keyword-bank terms, aliases, tags)
 * @returns {{ word: string, stems: string[], weight: number }[]}
 */
function keyIdeas(extract, names = [], max = 10, vocab = []) {
  const skip = new Set(names.flatMap((n) => words(n)).map(stem));
  const ideas = new Map(); // key → idea
  const put = (key, word, stems, weight) => {
    if (!stems.length || stems.every((s) => skip.has(s))) return;
    const prev = ideas.get(key);
    if (!prev || prev.weight < weight) ideas.set(key, { word, stems, weight: (prev?.weight || 0) + weight });
  };
  const text = fold(extract);

  // 1. known topics mentioned in the summary
  for (const phrase of vocab) {
    const p = fold(phrase).trim();
    if (p.length < 4 || names.some((n) => fold(n) === p)) continue;
    if (new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
      const stems = words(p).map(stem);
      put(stems.join(' '), p, stems, 6);
    }
  }
  // 2. names: capitalised words that don't start a sentence
  for (const m of String(extract).matchAll(/(?<![.!?]\s)(?<!^)\b([A-Z][a-z]{3,})\b/g)) {
    const w = fold(m[1]);
    if (STOP.has(w)) continue;
    put(stem(w), m[1], [stem(w)], 3);
  }
  // 3. frequent content words (early words count a bit more: the first sentence is the definition)
  const counts = new Map();
  words(extract).forEach((w, i) => {
    const s = stem(w);
    if (skip.has(s) || s.length < 3) return;
    const c = counts.get(s) || { w, n: 0 };
    c.n += 1 + (i < 25 ? 0.5 : 0);
    counts.set(s, c);
  });
  for (const [s, { w, n }] of counts) put(s, w, [s], n);

  const ranked = [...ideas.values()]
    .filter((i) => !i.stems.every((s) => skip.has(s)))
    .sort((a, b) => b.weight - a.weight || a.word.localeCompare(b.word));
  // a single word that is part of a chosen phrase ("theory" in "information theory") adds nothing
  const inPhrases = new Set(ranked.filter((i) => i.stems.length > 1).flatMap((i) => i.stems));
  return ranked.filter((i) => i.stems.length > 1 || !inPhrases.has(i.stems[0])).slice(0, max);
}

/**
 * @returns {{ score: number, matched: string[], missed: string[], words: number }}
 *   score 0..1 = share of key ideas you mentioned (short answers are capped)
 */
function compareExplanation(explanation, extract, names = [], vocab = []) {
  const ideas = keyIdeas(extract, names, 10, vocab);
  const mine = words(explanation);
  const stems = new Set(mine.map(stem));
  const hit = (idea) => idea.stems.filter((s) => stems.has(s)).length >= Math.ceil(idea.stems.length / 2);
  const matched = ideas.filter(hit).map((k) => k.word);
  const missed = ideas.filter((k) => !hit(k)).map((k) => k.word);
  const coverage = ideas.length ? matched.length / ideas.length : 0;
  const lengthFactor = Math.min(1, mine.length / 12); // a few real sentences ≈ 12+ content words
  return { score: Math.round(coverage * lengthFactor * 100) / 100, matched, missed, words: mine.length };
}

module.exports = { compareExplanation, keyIdeas, stem, words };
