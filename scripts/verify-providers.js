// Live checks of every online source, run from CI (the Mind Gym cloud dev environment can't
// reach these hosts). Writes a Markdown report to the GitHub job summary and verify-report.json.
//
//   node scripts/verify-providers.js            check only
//   node scripts/verify-providers.js --write    also save keyword → Wikidata IDs to
//                                                data/keywords/wikidata.json (then run keywords:build)
//
// Checks: each provider's endpoints answer with the shape we parse; every keyword's Wikipedia
// title exists (following redirects) and has a Wikidata item; every capital in
// data/countries.txt matches Wikidata.
const fs = require('fs');
const path = require('path');
const { DiskCache } = require('../src/main/cache');
const { createProviders } = require('../src/main/providers/registry');
const { build: buildKeywords } = require('./build-keywords');
const { build: buildCountries } = require('./build-countries');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const WRITE = process.argv.includes('--write');
const report = { at: new Date().toISOString(), providers: [], keywords: {}, countries: {} };

const providers = createProviders({
  fetch: (url, opts) => fetch(url, opts),
  cache: new DiskCache(null),
  userAgent: `MindGym/${pkg.version} (+https://github.com/Niick-pixel/Level-up-IQ; verification script)`,
  getSettings: () => ({ offlineMode: false, providers: {} }),
});

async function check(name, fn) {
  const t = Date.now();
  try {
    const detail = await fn();
    report.providers.push({ name, ok: true, ms: Date.now() - t, detail });
  } catch (err) {
    report.providers.push({ name, ok: false, ms: Date.now() - t, detail: err.message });
  }
}

async function checkProviders() {
  const { wikipedia, wikidata, opentdb, lichess } = providers;
  await check('Wikipedia summary', async () => {
    const s = await wikipedia.summary('Entropy');
    if (!s.extract || !s.qid) throw new Error('summary missing extract or wikibase_item');
    return `${s.title} → ${s.qid}`;
  });
  await check('Wikipedia random', async () => (await wikipedia.random()).title);
  await check('Wikipedia on this day', async () => `${(await wikipedia.onThisDay()).length} events`);
  await check('Wikipedia search', async () => (await wikipedia.search('tardigrade')).map((r) => r.title).slice(0, 3).join(', '));
  await check('Wikipedia links', async () => `${(await wikipedia.links('Entropy')).length} links`);
  await check('Wikidata facts (Don Quixote, Q480)', async () => (await wikidata.facts('Q480')).map((f) => `${f.label}: ${f.display}`).join('; ') || 'no facts');
  await check('Open Trivia DB', async () => {
    const qs = await opentdb.questions('physics', 2);
    if (!qs.length) throw new Error('no questions');
    return qs[0].question;
  });
  await check('Lichess daily puzzle', async () => {
    const p = await lichess.daily();
    if (!p) throw new Error('unexpected shape');
    return `${p.id} (${p.rating})`;
  });
}

async function checkKeywords() {
  const { bank, errors } = buildKeywords();
  if (errors.length) throw new Error(errors.join('\n'));
  const titles = [...new Set(bank.keywords.map((k) => k.wikipedia))];
  const qidByTitle = {};
  for (let i = 0; i < titles.length; i += 50) {
    Object.assign(qidByTitle, await providers.wikipedia.qids(titles.slice(i, i + 50)));
  }
  const qids = {};
  const missing = [];
  for (const k of bank.keywords) {
    const q = qidByTitle[k.wikipedia];
    if (q) qids[k.id] = q;
    else missing.push(`${k.id} (“${k.wikipedia}”)`);
  }
  report.keywords = { total: bank.keywords.length, resolved: Object.keys(qids).length, missing };
  if (WRITE) {
    const sorted = Object.fromEntries(Object.entries(qids).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(path.join(ROOT, 'data', 'keywords', 'wikidata.json'), JSON.stringify(sorted, null, 1) + '\n');
  }
}

async function checkCountries() {
  const { countries } = buildCountries();
  const query = `SELECT ?iso ?capitalLabel WHERE {
  ?c wdt:P297 ?iso ; wdt:P36 ?capital .
  FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
  const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': `MindGym/${pkg.version} (+https://github.com/Niick-pixel/Level-up-IQ; verification script)` },
  });
  if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
  const data = await res.json();
  const capitals = new Map();
  for (const b of data.results.bindings) {
    const iso = b.iso.value.toUpperCase();
    if (!capitals.has(iso)) capitals.set(iso, new Set());
    capitals.get(iso).add(b.capitalLabel.value.toLowerCase());
  }
  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const mismatches = [];
  for (const c of countries) {
    const wd = capitals.get(c.iso2);
    if (!wd) {
      mismatches.push(`${c.iso2} ${c.name}: no capital on Wikidata`);
      continue;
    }
    const ours = [c.capital, ...c.otherCapitals].map(norm);
    if (![...wd].some((w) => ours.some((o) => norm(w).includes(o) || o.includes(norm(w))))) {
      mismatches.push(`${c.iso2} ${c.name}: ours “${c.capital}”, Wikidata “${[...wd].join(' / ')}”`);
    }
  }
  report.countries = { total: countries.length, mismatches };
}

function markdown() {
  const lines = ['# Mind Gym provider check', '', `Run at ${report.at}.`, '', '| Check | OK | Time | Detail |', '| --- | --- | --- | --- |'];
  for (const p of report.providers) lines.push(`| ${p.name} | ${p.ok ? '✅' : '❌'} | ${p.ms} ms | ${String(p.detail).replace(/\|/g, '\\|').slice(0, 160)} |`);
  const k = report.keywords;
  lines.push('', `## Keywords`, '', k.error ? `❌ ${k.error}` : `${k.resolved} of ${k.total} keywords resolved to a Wikidata item.`);
  if (k.missing?.length) lines.push('', 'Titles to fix:', '', ...k.missing.map((m) => `- ${m}`));
  const c = report.countries;
  lines.push('', '## Country capitals', '', c.error ? `❌ ${c.error}` : `${c.total - c.mismatches.length} of ${c.total} match Wikidata.`);
  if (c.mismatches?.length) lines.push('', ...c.mismatches.map((m) => `- ${m}`));
  return lines.join('\n') + '\n';
}

(async () => {
  await checkProviders();
  try { await checkKeywords(); } catch (err) { report.keywords = { error: err.message }; }
  try { await checkCountries(); } catch (err) { report.countries = { error: err.message }; }
  const md = markdown();
  fs.writeFileSync(path.join(ROOT, 'verify-report.json'), JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
})();
