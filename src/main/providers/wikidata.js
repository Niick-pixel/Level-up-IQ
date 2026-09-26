// Wikidata (CC0): a few dated facts about an item, for "key facts" and quiz questions.
// One small SPARQL query per keyword, cached for 30 days. The query service is slow in 2026,
// so the timeout is generous and everything works without it.
const { Provider } = require('./provider');

const DAY = 24 * 3600 * 1000;
const SPARQL = 'https://query.wikidata.org/sparql';

// Properties we read, with how to phrase a question about each.
const PROPS = {
  P571: { label: 'Began / founded', ask: (t) => `In what year did “${t}” come into being?` },
  P575: { label: 'Discovered', ask: (t) => `In what year was “${t}” discovered?` },
  P577: { label: 'First published', ask: (t) => `In what year was “${t}” first published or released?` },
  P569: { label: 'Born', ask: (t) => `In what year was ${t} born?` },
  P570: { label: 'Died', ask: (t) => `In what year did ${t} die?` },
  P580: { label: 'Started', ask: (t) => `In what year did “${t}” start?` },
  P582: { label: 'Ended', ask: (t) => `In what year did “${t}” end?` },
  P585: { label: 'Took place', ask: (t) => `In what year did “${t}” take place?` },
  P1619: { label: 'Opened', ask: (t) => `In what year did “${t}” open?` },
  P61: { label: 'Discovered or invented by' },
  P170: { label: 'Created by' },
  P50: { label: 'Author' },
  P84: { label: 'Architect' },
  P57: { label: 'Director' },
  P86: { label: 'Composer' },
  P17: { label: 'Country' },
  P138: { label: 'Named after' },
};

const INFO = {
  id: 'wikidata',
  name: 'Wikidata',
  hosts: ['query.wikidata.org'],
  license: 'CC0 1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  attribution: 'Facts from Wikidata (public domain, CC0).',
  homepage: 'https://www.wikidata.org/',
  minIntervalMs: 1500,
  concurrency: 1,
  ttlMs: 30 * DAY,
  timeoutMs: 30000,
};

function factsQuery(qid) {
  const props = Object.keys(PROPS).map((p) => `wd:${p}`).join(' ');
  return `SELECT ?prop ?value ?valueLabel ?precision WHERE {
  VALUES ?prop { ${props} }
  ?prop wikibase:claim ?claim ; wikibase:statementProperty ?ps .
  wd:${qid} ?claim ?st .
  ?st ?ps ?value ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?prop wikibase:statementValue ?psv . ?st ?psv ?node . ?node wikibase:timePrecision ?precision . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 80`;
}

/** Year from an xsd:dateTime string like "+1905-06-30T00:00:00Z" or "-0490-01-01T00:00:00Z". */
function yearOf(value) {
  const m = /^([+-]?)(\d{1,6})-/.exec(String(value));
  if (!m) return null;
  const y = Number(m[2]);
  return m[1] === '-' ? -y : y;
}

const formatYear = (y) => (y < 0 ? `${-y} BC` : String(y));

/** Turns SPARQL bindings into facts. Pure; exported for tests. */
function parseFacts(json) {
  const facts = [];
  const seen = new Set();
  for (const b of json?.results?.bindings || []) {
    const pid = String(b.prop?.value || '').split('/').pop();
    const def = PROPS[pid];
    if (!def || !b.value) continue;
    let fact;
    if (b.value.datatype === 'http://www.w3.org/2001/XMLSchema#dateTime') {
      const precision = Number(b.precision?.value ?? 9);
      const year = yearOf(b.value.value);
      if (year === null || precision < 9) continue; // decade/century precision: don't quiz on it
      fact = { prop: pid, label: def.label, kind: 'year', year, display: formatYear(year) };
    } else if (b.value.type === 'uri') {
      const label = b.valueLabel?.value;
      if (!label || /^Q\d+$/.test(label)) continue; // unlabelled item
      fact = { prop: pid, label: def.label, kind: 'item', display: label };
    } else {
      continue;
    }
    const k = `${pid}:${fact.display}`;
    if (seen.has(k)) continue;
    seen.add(k);
    facts.push(fact);
  }
  // several statements for one time property (e.g. two start dates): keep the earliest
  const firstYear = new Map();
  for (const f of facts) if (f.kind === 'year' && (!firstYear.has(f.prop) || f.year < firstYear.get(f.prop).year)) firstYear.set(f.prop, f);
  return facts.filter((f) => f.kind !== 'year' || firstYear.get(f.prop) === f);
}

class Wikidata extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  async facts(qid) {
    if (!/^Q\d+$/.test(qid || '')) return [];
    const url = `${SPARQL}?format=json&query=${encodeURIComponent(factsQuery(qid))}`;
    const { data } = await this.getJson(url, {
      key: `wikidata:facts:${qid}`,
      headers: { Accept: 'application/sparql-results+json' },
      accept: (d) => Array.isArray(d?.results?.bindings),
    });
    return parseFacts(data);
  }
}

module.exports = { Wikidata, PROPS, parseFacts, yearOf, formatYear, factsQuery, INFO };
