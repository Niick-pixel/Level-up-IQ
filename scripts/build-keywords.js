// Builds assets/keywords.json from the hand-written shards in data/keywords/*.txt.
//
// Shard format, one keyword per line (blank lines and # comments are ignored):
//   id | Term | alias; alias | tag, tag | difficulty 1-5 | related-id, related-id | Wikipedia title (optional)
// The file name is the domain id. If the Wikipedia title is left out, the term is used.
// Wikidata QIDs are not typed by hand: the provider verification script fills them from
// Wikipedia's page properties (see docs/PHASE0_PLAN.md §4).
//
//   node scripts/build-keywords.js           build
//   node scripts/build-keywords.js --check   fail if assets/keywords.json is stale or invalid
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHARDS = path.join(ROOT, 'data', 'keywords');
const OUT = path.join(ROOT, 'assets', 'keywords.json');
const QIDS = path.join(ROOT, 'data', 'keywords', 'wikidata.json'); // { id: "Q123" }, written by verification

const DOMAINS = [
  ['physics', 'Physics'],
  ['chemistry', 'Chemistry'],
  ['biology', 'Biology'],
  ['neuroscience', 'Neuroscience'],
  ['medicine', 'Medicine'],
  ['astronomy', 'Astronomy and space'],
  ['earth-science', 'Earth science and climate'],
  ['mathematics', 'Mathematics'],
  ['computer-science', 'Computer science'],
  ['engineering', 'Engineering'],
  ['history', 'History'],
  ['geography', 'Geography and cultures'],
  ['economics', 'Economics and finance'],
  ['philosophy', 'Philosophy'],
  ['psychology', 'Psychology and cognitive biases'],
  ['logic', 'Logic and fallacies'],
  ['linguistics', 'Linguistics and etymology'],
  ['literature', 'Literature'],
  ['art-history', 'Art history'],
  ['music', 'Music'],
  ['architecture', 'Architecture'],
  ['film', 'Film'],
  ['technology-history', 'Technology history'],
  ['inventions', 'Inventions'],
  ['military-strategy', 'Military strategy'],
  ['law-politics', 'Law and political systems'],
  ['religion-mythology', 'Religion and mythology'],
  ['nature', 'Nature and animals'],
  ['food-science', 'Food science'],
  ['sports-science', 'Sports science'],
  ['latin-america', 'Latin America and Costa Rica'],
  ['unsolved', 'Unsolved problems'],
  ['mysteries', 'Mysteries and anomalies'],
].map(([id, label]) => ({ id, label }));

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const split = (s, sep) => (s || '').split(sep).map((x) => x.trim()).filter(Boolean);

function parseShard(domain, text, errors) {
  const out = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const where = `${domain}.txt:${i + 1}`;
    const f = line.split('|').map((x) => x.trim());
    if (f.length < 6 || f.length > 7) {
      errors.push(`${where}: expected 6 or 7 fields, got ${f.length}`);
      return;
    }
    const [id, term, aliases, tags, difficulty, related, wikipedia] = f;
    const d = Number(difficulty);
    if (!ID.test(id)) errors.push(`${where}: bad id "${id}"`);
    if (!term) errors.push(`${where}: missing term`);
    if (!Number.isInteger(d) || d < 1 || d > 5) errors.push(`${where}: difficulty must be 1-5`);
    out.push({
      id,
      term,
      aliases: split(aliases, ';'),
      domain,
      tags: split(tags, ','),
      difficulty: d,
      related: split(related, ','),
      wikipedia: wikipedia || term,
      wikidata: null,
    });
  });
  return out;
}

function build() {
  const errors = [];
  const domainIds = new Set(DOMAINS.map((d) => d.id));
  const files = fs.readdirSync(SHARDS).filter((f) => f.endsWith('.txt')).sort();
  let keywords = [];
  for (const f of files) {
    const domain = f.replace(/\.txt$/, '');
    if (!domainIds.has(domain)) {
      errors.push(`${f}: unknown domain`);
      continue;
    }
    keywords = keywords.concat(parseShard(domain, fs.readFileSync(path.join(SHARDS, f), 'utf8'), errors));
  }

  const seen = new Map();
  for (const k of keywords) {
    if (seen.has(k.id)) errors.push(`duplicate id "${k.id}" (${seen.get(k.id)} and ${k.domain})`);
    seen.set(k.id, k.domain);
  }
  const titles = new Map();
  for (const k of keywords) {
    const t = k.wikipedia.toLowerCase();
    if (titles.has(t)) errors.push(`duplicate Wikipedia title "${k.wikipedia}" (${titles.get(t)} and ${k.id})`);
    titles.set(t, k.id);
    for (const r of k.related) {
      if (!seen.has(r)) errors.push(`${k.id}: related "${r}" does not exist`);
      if (r === k.id) errors.push(`${k.id}: related to itself`);
    }
  }
  for (const d of DOMAINS) {
    if (!keywords.some((k) => k.domain === d.id)) errors.push(`domain "${d.id}" has no keywords`);
  }

  let qids = {};
  try { qids = JSON.parse(fs.readFileSync(QIDS, 'utf8')); } catch { /* not verified yet */ }
  for (const k of keywords) if (/^Q\d+$/.test(qids[k.id] || '')) k.wikidata = qids[k.id];

  keywords.sort((a, b) => a.domain.localeCompare(b.domain) || a.term.localeCompare(b.term));
  return { errors, bank: { version: 1, domains: DOMAINS, keywords } };
}

if (require.main === module) {
  const { errors, bank } = build();
  if (errors.length) {
    console.error(errors.join('\n'));
    console.error(`\n${errors.length} problem(s).`);
    process.exit(1);
  }
  const json = JSON.stringify(bank, null, 1) + '\n';
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== json) {
      console.error('assets/keywords.json is out of date. Run: npm run keywords:build');
      process.exit(1);
    }
    console.log(`keywords.json is up to date (${bank.keywords.length} keywords).`);
  } else {
    fs.writeFileSync(OUT, json);
    const per = {};
    for (const k of bank.keywords) per[k.domain] = (per[k.domain] || 0) + 1;
    console.log(`Wrote ${bank.keywords.length} keywords across ${Object.keys(per).length} domains.`);
  }
}

module.exports = { build, parseShard, DOMAINS };
