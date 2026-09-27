// The Trivia API (CC BY-NC 4.0): a second trivia source. Free for non-commercial use without a
// key, so it stays only while Mind Gym is free (see docs/PHASE0_PLAN.md, decision 3).
const { Provider } = require('./provider');

const API = 'https://the-trivia-api.com/v2';

const INFO = {
  id: 'triviaapi',
  name: 'The Trivia API',
  hosts: ['the-trivia-api.com'],
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'Trivia questions from The Trivia API (the-trivia-api.com), CC BY-NC 4.0.',
  homepage: 'https://the-trivia-api.com/',
  minIntervalMs: 2000,
  concurrency: 1,
  ttlMs: 0,
};

/** Normalizes one question. Pure; exported for tests. */
function normalize(q) {
  return {
    category: String(q.category || '').replace(/_/g, ' '),
    difficulty: String(q.difficulty || ''),
    question: String(q.question?.text || ''),
    correct: String(q.correctAnswer || ''),
    incorrect: (q.incorrectAnswers || []).map(String),
  };
}

class TriviaApi extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  /** Multiple-choice questions. difficulty: 'easy' | 'medium' | 'hard'. */
  async questions(amount = 5, difficulty = 'medium') {
    const url = `${API}/questions?limit=${Math.min(20, amount)}&difficulties=${encodeURIComponent(difficulty)}`;
    const { data } = await this.getJson(url, { cache: false, accept: Array.isArray });
    return data.map(normalize).filter((q) => q.question && q.correct && q.incorrect.length >= 3);
  }
}

module.exports = { TriviaApi, normalize, INFO };
