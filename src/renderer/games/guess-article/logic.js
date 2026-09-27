// Guess the article: read the opening of a Wikipedia article with its subject blanked out, and
// name the subject. Offline, the clue is the keyword's tags and related topics instead.
export const meta = {
  id: 'guess-article',
  name: 'Guess the article',
  blurb: 'Read a Wikipedia summary with its subject blanked out. What is it about?',
  howTo: ['Read the clue; the blanks hide the subject’s name.', 'Pick the topic (1–4).'],
  skills: ['knowledge', 'language'],
  durationRange: [60, 150],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export function makeQuestions(_rng, _d, data) {
  return (data?.items || []).map((it) => ({
    prompt: 'Which topic is this?',
    detail: it.clue.text,
    options: it.options,
    answer: it.answer,
    explain: it.clue.kind === 'wikipedia' ? `“${it.term}” · text from Wikipedia, CC BY-SA 4.0` : `“${it.term}” · clue from the offline keyword bank`,
  }));
}
