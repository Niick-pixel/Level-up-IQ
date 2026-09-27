// Open Trivia DB (CC BY-SA 4.0): bonus trivia matched to a keyword's domain.
// Limits: one request every 5 seconds per IP. A session token keeps questions from repeating;
// tokens expire after 6 hours idle, so we request a new one when told to.
const { Provider, ProviderError } = require('./provider');

const API = 'https://opentdb.com';

const INFO = {
  id: 'opentdb',
  name: 'Open Trivia DB',
  hosts: ['opentdb.com'],
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution: 'Trivia questions from Open Trivia DB, available under CC BY-SA 4.0.',
  homepage: 'https://opentdb.com/',
  minIntervalMs: 5500,
  concurrency: 1,
  ttlMs: 0,
};

// Our domains → Open Trivia DB category ids
const CATEGORY = {
  physics: 17, chemistry: 17, biology: 17, neuroscience: 17, medicine: 17, astronomy: 17, 'earth-science': 17,
  nature: 27, 'food-science': 17, 'sports-science': 21,
  mathematics: 19, 'computer-science': 18, engineering: 17, 'technology-history': 18, inventions: 30,
  history: 23, 'military-strategy': 23, 'law-politics': 24, geography: 22, 'latin-america': 22,
  'religion-mythology': 20, literature: 10, 'art-history': 25, music: 12, film: 11, architecture: 25,
  economics: 9, philosophy: 9, psychology: 9, logic: 9, linguistics: 9, unsolved: 17, mysteries: 9,
};

/** Decodes a question fetched with encode=url3986 into plain text. Pure; exported for tests. */
function decodeQuestion(q) {
  const d = (s) => decodeURIComponent(String(s));
  return {
    category: d(q.category),
    difficulty: d(q.difficulty),
    type: d(q.type),
    question: d(q.question),
    correct: d(q.correct_answer),
    incorrect: (q.incorrect_answers || []).map(d),
  };
}

class OpenTdb extends Provider {
  constructor(deps) {
    super(INFO, deps);
    this.token = null;
  }

  async #newToken() {
    const { data } = await this.getJson(`${API}/api_token.php?command=request`, { cache: false });
    if (data.response_code !== 0 || !data.token) throw new ProviderError('Open Trivia DB token failed', 'http');
    this.token = data.token;
  }

  /** Multiple-choice questions for a domain (or any category with domain null). */
  async questions(domain, amount = 3, difficulty = null) {
    const category = domain === null ? null : CATEGORY[domain] ?? 9;
    if (!this.token) await this.#newToken();
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = `${API}/api.php?amount=${amount}&type=multiple&encode=url3986${category ? `&category=${category}` : ''}${difficulty ? `&difficulty=${difficulty}` : ''}&token=${this.token}`;
      const { data } = await this.getJson(url, { cache: false, accept: (d) => typeof d?.response_code === 'number' });
      if (data.response_code === 0) return data.results.map(decodeQuestion);
      if (data.response_code === 3 || data.response_code === 4) {
        // token unknown or every question in this category already seen: start over
        await this.#newToken();
        continue;
      }
      if (data.response_code === 5) {
        this.lockedUntil = this.now + 6000;
        throw new ProviderError('Open Trivia DB asked us to slow down', 'locked');
      }
      return []; // 1 = not enough questions, 2 = invalid parameter
    }
    return [];
  }
}

module.exports = { OpenTdb, CATEGORY, decodeQuestion, INFO };
