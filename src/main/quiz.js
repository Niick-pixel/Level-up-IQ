// Builds a keyword quiz from whatever is available: the keyword bank (always, offline),
// the Wikipedia summary, Wikidata facts, and Open Trivia DB. Pure functions, seeded, tested.
//
// Question: { id, kind, prompt, options: string[], answer: number, source, explain? }

const MAX_QUESTIONS = 8;
const MIN_QUESTIONS = 5;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mc(rng, { kind, prompt, correct, distractors, source, explain }) {
  if (!correct) return null;
  const unique = [...new Set(distractors.filter((d) => d && d.toLowerCase() !== String(correct).toLowerCase()))];
  if (unique.length < 3) return null;
  const options = rng.shuffle([correct, ...rng.shuffle(unique).slice(0, 3)]);
  return { kind, prompt, options, answer: options.indexOf(correct), source, explain };
}

/** Sentences of an extract (simple, good enough for encyclopedic prose). */
function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 320);
}

/** Replaces every way of naming the keyword with a blank. */
function blankTerm(sentence, names) {
  let out = sentence;
  let hit = false;
  for (const n of names.filter((x) => x.length >= 3).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${escapeRe(n)}\\b`, 'gi');
    if (re.test(out)) {
      hit = true;
      out = out.replace(re, '_____');
    }
  }
  return hit ? out : null;
}

/** Plausible wrong years near the right one, never in the future, all distinct. */
function yearDistractors(rng, year, thisYear) {
  const age = Math.abs(thisYear - year);
  const spread = Math.max(3, Math.round(age * 0.12));
  const out = new Set();
  let guard = 0;
  while (out.size < 3 && guard++ < 200) {
    const y = year + rng.int(-spread, spread);
    if (y !== year && y <= thisYear && y !== 0) out.add(y);
  }
  return [...out];
}

const fmtYear = (y) => (y < 0 ? `${-y} BC` : String(y));

/**
 * @param {object} args
 * @param {object} args.keyword    the bank entry
 * @param {object} args.bank       KeywordBank (for distractors from the same domain)
 * @param {object|null} args.summary  normalized Wikipedia summary
 * @param {object[]} args.facts    Wikidata facts
 * @param {object[]} args.trivia   decoded Open Trivia DB questions
 * @param {object} args.rng
 * @param {number} args.thisYear
 */
function buildQuiz({ keyword, bank, summary = null, facts = [], trivia = [], rng, thisYear = new Date().getFullYear() }) {
  const names = [keyword.term, ...keyword.aliases, summary?.title].filter(Boolean);
  const sameDomain = bank.keywords.filter((k) => k.domain === keyword.domain && k.id !== keyword.id);
  const others = bank.keywords.filter((k) => k.domain !== keyword.domain);
  const wiki = summary ? { name: 'Wikipedia', url: summary.url } : null;
  const qs = [];
  const add = (q) => { if (q) qs.push(q); };

  // 1. Which concept is this? (first sentence of the summary with the name blanked)
  const sents = sentences(summary?.extract);
  if (sents.length) {
    const blanked = blankTerm(sents[0], names);
    if (blanked) {
      add(mc(rng, {
        kind: 'definition',
        prompt: `Which topic does this describe?\n“${blanked}”`,
        correct: keyword.term,
        distractors: sameDomain.map((k) => k.term),
        source: wiki,
      }));
    }
  }

  // 2. Dated facts from Wikidata
  const { PROPS } = require('./providers/wikidata');
  for (const f of rng.shuffle(facts.filter((x) => x.kind === 'year' && PROPS[x.prop]?.ask)).slice(0, 2)) {
    add(mc(rng, {
      kind: 'fact',
      prompt: PROPS[f.prop].ask(keyword.term),
      correct: fmtYear(f.year),
      distractors: yearDistractors(rng, f.year, thisYear).map(fmtYear),
      source: { name: 'Wikidata', url: null },
    }));
  }

  // 3. Fill the gap: other bank terms that appear in the summary
  const bankNames = bank.keywords
    .filter((k) => k.id !== keyword.id)
    .flatMap((k) => [k.term, ...k.aliases].map((n) => ({ n, k })))
    .filter(({ n }) => n.length >= 5 && !/[()]/.test(n));
  const clozes = [];
  for (const s of sents.slice(1)) {
    for (const { n, k } of bankNames) {
      const re = new RegExp(`\\b${escapeRe(n)}\\b`, 'i');
      const m = re.exec(s);
      if (!m) continue;
      const pool = bank.keywords.filter((x) => x.domain === k.domain && x.id !== k.id && !re.test(x.term)).map((x) => x.term.replace(/\s*\(.*\)$/, '').toLowerCase());
      clozes.push({ s: s.replace(re, '_____'), correct: m[0], pool });
      break;
    }
    // years mentioned in the text
    const y = /\b(1[0-9]{3}|20[0-2][0-9])\b/.exec(s);
    if (y) {
      clozes.push({ s: s.replace(y[0], '_____'), correct: y[0], pool: yearDistractors(rng, Number(y[0]), thisYear).map(String), year: true });
    }
  }
  for (const c of rng.shuffle(clozes).slice(0, 3)) {
    add(mc(rng, {
      kind: 'cloze',
      prompt: `Fill the gap:\n“${c.s}”`,
      correct: c.year ? c.correct : c.correct.toLowerCase(),
      distractors: c.pool,
      source: wiki,
    }));
  }

  // 4. From the keyword graph (always available, even offline)
  const related = keyword.related.map((id) => bank.get(id)).filter(Boolean);
  if (related.length) {
    add(mc(rng, {
      kind: 'related',
      prompt: `Which of these is most closely connected to “${keyword.term}”?`,
      correct: rng.pick(related).term,
      distractors: others.map((k) => k.term),
      source: null,
    }));
  }
  if (keyword.aliases.length) {
    add(mc(rng, {
      kind: 'alias',
      prompt: `“${rng.pick(keyword.aliases)}” is another name for…`,
      correct: keyword.term,
      distractors: sameDomain.map((k) => k.term),
      source: null,
    }));
  }

  // 5. Bonus trivia from Open Trivia DB (same broad category)
  for (const t of trivia.slice(0, 2)) {
    add(mc(rng, {
      kind: 'trivia',
      prompt: t.question,
      correct: t.correct,
      distractors: t.incorrect,
      source: { name: 'Open Trivia DB', url: 'https://opentdb.com/' },
    }));
  }

  // 6. Offline fillers so there are always at least MIN_QUESTIONS, each with its own prompt
  const domainLabel = keyword.domainLabel || keyword.domain;
  const labels = [...new Set(bank.keywords.map((k) => k.domainLabel || k.domain))];
  const fillers = [
    () => mc(rng, {
      kind: 'domain',
      prompt: `Which field is “${keyword.term}” from?`,
      correct: domainLabel,
      distractors: labels,
      source: null,
    }),
    () => mc(rng, {
      kind: 'domain',
      prompt: `Which of these topics belongs to ${domainLabel}, like “${keyword.term}”?`,
      correct: sameDomain.length ? rng.pick(sameDomain).term : null,
      distractors: others.map((k) => k.term),
      source: null,
    }),
    () => {
      const three = rng.shuffle(sameDomain).slice(0, 3);
      if (three.length < 3) return null;
      const odd = rng.pick(others);
      const q = mc(rng, {
        kind: 'odd-one-out',
        prompt: `Odd one out: which of these is NOT about ${domainLabel}?`,
        correct: odd.term,
        distractors: three.map((k) => k.term),
        source: null,
      });
      return q;
    },
    ...keyword.tags.map((tag) => () => {
      const tagged = bank.keywords.filter((k) => k.id !== keyword.id && k.tags.includes(tag));
      if (!tagged.length) return null;
      return mc(rng, {
        kind: 'tag',
        prompt: `“${keyword.term}” is about ${tag}. Which of these is too?`,
        correct: rng.pick(tagged).term,
        distractors: others.filter((k) => !k.tags.includes(tag)).map((k) => k.term),
        source: null,
      });
    }),
    // explore the neighbourhood: connections between other topics in the same field
    ...rng.shuffle(sameDomain.filter((k) => k.related.length)).slice(0, 4).map((n) => () => mc(rng, {
      kind: 'neighbour',
      prompt: `Staying in ${domainLabel}: which of these is connected to “${n.term}”?`,
      correct: bank.get(rng.pick(n.related))?.term,
      distractors: others.map((k) => k.term),
      source: null,
    })),
  ];
  for (const f of fillers) {
    if (qs.length >= MIN_QUESTIONS) break;
    add(f());
  }

  // de-duplicate prompts, cap, number
  const seen = new Set();
  return qs.filter((q) => (seen.has(q.prompt) ? false : seen.add(q.prompt)))
    .slice(0, MAX_QUESTIONS)
    .map((q, i) => ({ id: i + 1, ...q }));
}

module.exports = { buildQuiz, sentences, blankTerm, yearDistractors, MIN_QUESTIONS, MAX_QUESTIONS };
