// "Yesterday" recall: questions about things you learned 1, 3 and 7 days ago. Pulling a memory
// back out after a gap (the testing effect, with spacing) is what makes it last.
export const meta = {
  id: 'yesterday',
  name: 'Yesterday recall',
  blurb: 'Recall facts from your keyword sessions 1, 3 and 7 days ago, before you peek.',
  howTo: ['Read the question and answer it from memory (type it, or just say it in your head).', 'Then reveal and mark yourself honestly.'],
  skills: ['memory', 'knowledge'],
  durationRange: [60, 240],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
  needsCards: true,
};

export const CREDIT = { got: 1, partly: 0.5, missed: 0 };

export function ageLabel(days) {
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function scoreRound(marks, difficulty) {
  const total = marks.length || 1;
  const credit = marks.reduce((s, m) => s + CREDIT[m], 0);
  const accuracy = credit / total;
  return { score: Math.round(credit * 80 * (1 + difficulty / 10)), accuracy, performance: accuracy };
}
