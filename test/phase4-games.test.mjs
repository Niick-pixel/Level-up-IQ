// Phase 4 picture quizzes: questions are well formed, and they explain themselves when there's
// nothing to show (first run offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/shared/rng.js';
import * as art from '../src/renderer/games/art-quiz/logic.js';
import * as species from '../src/renderer/games/species-quiz/logic.js';
import * as apod from '../src/renderer/games/apod-quiz/logic.js';

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
const artItems = [
  [-1200, 'Egyptian', null], [150, 'Roman', null], [1100, 'French', null], [1505, 'Italian', 'Leonardo da Vinci'],
  [1665, 'Dutch', 'Johannes Vermeer'], [1785, 'French', 'Jacques-Louis David'], [1889, 'Dutch', 'Vincent van Gogh'],
  [1930, 'American', 'Grant Wood'],
].map(([year, culture, artist], i) => ({ id: `t${i}`, source: i % 2 ? 'met' : 'aic', title: `Work ${i}`, artist, culture, date: String(year), year, image: `mg-cache://img/${i}`, credit: 'Credit', license: 'CC0', url: 'https://www.metmuseum.org/x' }));

test('art quiz: eras and centuries are right, options distinct, artists only when known', () => {
  assert.equal(art.eraOf(-1200), 0);
  assert.equal(art.eraOf(1665), 4);
  assert.equal(art.eraOf(1990), 8);
  assert.equal(art.centuryOf(1665), 17);
  assert.equal(art.centuryOf(1900), 19);
  assert.equal(art.centuryOf(-300), -3);
  assert.equal(art.centuryLabel(-3), '3rd century BC');
  assert.equal(art.centuryLabel(21), '21st century');
  for (const d of LEVELS) {
    const qs = art.makeQuestions(makeRng(`art${d}`), d, { items: artItems });
    assert.equal(qs.length, artItems.length);
    qs.forEach((q, i) => {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4, q.options.join(' | '));
      assert.ok(q.answer >= 0);
      if (q.kind === 'era') assert.equal(q.options[q.answer], art.ERAS[art.eraOf(artItems[i].year)].label);
      if (q.kind === 'century') assert.equal(q.options[q.answer], art.centuryLabel(art.centuryOf(artItems[i].year)));
      if (q.kind === 'artist') assert.equal(q.options[q.answer], artItems[i].artist);
    });
  }
  assert.throws(() => art.makeQuestions(makeRng('x'), 3, { items: [] }), /Connect once/);
});

test('species and APOD quizzes: answer is among the options; clear message with nothing to show', () => {
  const q = { name: 'Resplendent Quetzal', scientific: 'Pharomachrus mocinno', group: 'Aves', image: 'mg-cache://img/a', credit: '(c) X', license: 'CC-BY', url: 'https://www.inaturalist.org/taxa/1' };
  const data = { place: 'Costa Rica', questions: [1, 2, 3].map(() => ({ ...q, options: ['Keel-billed Toucan', 'Resplendent Quetzal', 'Scarlet Macaw', 'Turquoise-browed Motmot'] })) };
  for (const s of species.makeQuestions(makeRng('s'), 5, data)) assert.equal(s.options[s.answer], 'Resplendent Quetzal');
  assert.throws(() => species.makeQuestions(makeRng('s'), 5, { questions: [] }), /iNaturalist/);
  const items = ['Horsehead Nebula', 'Aurora over Iceland', 'The Moon and Venus'].map((title, i) => ({ title, image: `mg-cache://img/${i}`, explanation: 'One. Two. Three. Four.', credit: 'NASA', date: '2026-01-0' + i, url: 'https://apod.nasa.gov/' }));
  const qs = apod.makeQuestions(makeRng('a'), 7, { items, titles: ['Saturn at night', 'M31'] });
  for (const [i, x] of qs.entries()) {
    assert.equal(x.options[x.answer], items[i].title);
    assert.equal(new Set(x.options).size, 4);
    assert.equal(x.explain, 'One. Two. Three.');
  }
  assert.throws(() => apod.makeQuestions(makeRng('a'), 5, { items: [], titles: [] }), /Astronomy Picture/);
});
