// Stats (spec §6), all local: activity, skills over time, learning (curiosity map growth, spaced
// repetition, videos) and "thinking without AI" minutes. Charts: views/charts.js.
import { h, fill, fmtMinutes, pct, toast, plural } from '../ui.js';
import { SKILLS, SKILL_LABELS } from '../../shared/game-contract.js';
import { GAMES } from '../games/registry.js';
import { svg, columnChart, lineChart } from './charts.js';

const DAY = 24 * 3600 * 1000;

/** Skill radar: now (filled accent) against 30 days ago (muted outline), with a legend. */
function radar(ratings) {
  const size = 340, c = size / 2, R = 105;
  const norm = (r) => Math.min(1, Math.max(0.04, (r - 800) / 1200));
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / SKILLS.length;
    return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f];
  };
  const monthAgo = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const past = (k) => {
    const hist = ratings[k].history.filter(([d]) => d <= monthAgo);
    return hist.length ? hist[hist.length - 1][1] : (ratings[k].history[0]?.[1] ?? 1200);
  };
  const hasPast = SKILLS.some((k) => ratings[k].history.some(([d]) => d <= monthAgo));
  const el = svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'radar', width: size, height: size, role: 'img', 'aria-label': 'Skill ratings radar chart' },
    [0.25, 0.5, 0.75, 1].map((f) => svg('polygon', { class: 'ring', points: SKILLS.map((_, i) => pt(i, f).join(',')).join(' ') })),
    hasPast ? svg('polygon', { class: 'area past', points: SKILLS.map((k, i) => pt(i, norm(past(k))).join(',')).join(' ') }) : null,
    svg('polygon', { class: 'area', points: SKILLS.map((k, i) => pt(i, norm(ratings[k].r)).join(',')).join(' ') }),
    SKILLS.map((k, i) => {
      const [x, y] = pt(i, 1.22);
      return svg('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, SKILL_LABELS[k]);
    }));
  const legend = hasPast ? h('div', { class: 'legend' },
    h('span', {}, h('i', { class: 'key now' }), 'Now'), h('span', {}, h('i', { class: 'key past' }), '30 days ago')) : '';
  return h('div', { class: 'radar-wrap' }, el, legend);
}

/** A 2px sparkline of one skill's rating history (last 60 entries). */
function sparkline(history) {
  const pts = history.slice(-60).map(([, r]) => r);
  if (pts.length < 2) return h('span', { class: 'muted small' }, '–');
  const W = 120, H = 26, min = Math.min(...pts), max = Math.max(...pts), span = Math.max(1, max - min);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * (W - 4) + 2},${H - 3 - ((v - min) / span) * (H - 6)}`).join('');
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart-svg spark', role: 'img', 'aria-label': `from ${pts[0]} to ${pts[pts.length - 1]}` },
    svg('path', { d, class: 'line' }));
}

function stat(num, label, extra) {
  return h('div', { class: 'card stat' }, h('div', { class: 'num' }, num), h('div', { class: 'muted small' }, label), extra || '');
}

export async function renderStats(el) {
  const [sum, streak, srs, extra, map] = await Promise.all([
    window.api.statsSummary(), window.api.streak(), window.api.srsStats(), window.api.statsExtra(), window.api.curiosity(),
  ]);
  const nameOf = (id) => (id === 'keyword-session' ? 'Keyword sessions' : GAMES.find((g) => g.meta.id === id)?.meta.name || id);
  const exp = async (format) => {
    const file = await window.api.exportStats(format);
    if (file) toast(`Saved ${file}`);
  };
  const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // activity, scoped by the range picker
  const activity = h('div', {});
  const range = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Range' });
  async function drawActivity(n) {
    range.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.n) === n)));
    const days = await window.api.statsDays(n);
    const every = n <= 14 ? 2 : n <= 30 ? 5 : 15;
    const total = days.reduce((a, d) => a + d.ms, 0);
    const active = days.filter((d) => d.games || d.reviews).length;
    fill(activity,
      h('p', { class: 'muted small' }, `${fmtMinutes(total)} over ${plural(active, 'active day')} in the last ${n} days.`),
      columnChart(days.map((d) => ({ label: d.date, short: shortDate(d.date), value: Math.round(d.ms / 60000), detail: `${shortDate(d.date)}: ${d.games} rounds${d.reviews ? `, ${d.reviews} reviews` : ''}` })),
        { width: 980, height: 170, format: (v) => `${v} min`, name: 'Minutes', labelEvery: every, ariaLabel: `Minutes trained per day, last ${n} days` }));
  }
  [7, 30, 90].forEach((n) => range.append(h('button', { class: 'btn small', type: 'button', role: 'radio', 'data-n': n, onclick: () => drawActivity(n) }, `${n} days`)));
  drawActivity(30);

  const topGames = Object.entries(extra.gameCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const growth = map.growth.map((g) => ({ label: new Date(g.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: g.total }));
  const forecast = srs.forecast.map((n, i) => ({ label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `In ${i} days`, short: i === 0 ? 'now' : `+${i}`, value: n }));

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Stats'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => exp('json') }, 'Export JSON'),
        h('button', { class: 'btn small', type: 'button', onclick: () => exp('csv') }, 'Export CSV'))),
    h('p', { class: 'muted small' }, 'Everything stays on this computer.'),

    h('div', { class: 'stat-row' },
      stat(fmtMinutes(sum.today.ms), 'today'),
      stat(streak.current ? plural(streak.current, 'day') : '–', 'streak', h('div', { class: 'muted small' }, streak.current ? `best ${streak.best}${streak.restLeft ? ` · ${plural(streak.restLeft, 'rest day')} left this week` : ''}` : 'train today to start one')),
      stat(fmtMinutes(sum.totals.ms), 'thinking without AI, all time'),
      stat(String(sum.totals.keywords), 'keywords explored'),
      stat(String(srs.dueNow), 'cards due'),
      stat(String(extra.watched), 'videos watched')),

    h('h2', { class: 'stats-h' }, 'Activity'),
    h('div', { class: 'card' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { style: { margin: 0 } }, 'Minutes per day'), range), activity),
    h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', marginTop: '14px', alignItems: 'start' } },
      h('div', { class: 'card' }, h('h3', {}, 'Most played'),
        topGames.length ? h('table', {}, h('tbody', {}, topGames.map(([id, n]) => h('tr', {}, h('td', {}, nameOf(id)), h('td', { class: 'num-col' }, String(n))))))
          : h('p', { class: 'muted' }, 'Nothing yet.')),
      h('div', { class: 'card' }, h('h3', {}, 'Personal bests'),
        Object.keys(sum.bests).length
          ? h('table', {},
            h('thead', {}, h('tr', {}, ['Game', 'Score', 'Accuracy', 'Level'].map((t) => h('th', {}, t)))),
            h('tbody', {}, Object.entries(sum.bests).sort((a, b) => b[1].at - a[1].at).slice(0, 10).map(([id, b]) => h('tr', { title: new Date(b.at).toLocaleDateString() },
              h('td', {}, nameOf(id)), h('td', { class: 'num-col' }, String(b.score)), h('td', { class: 'num-col' }, pct(b.accuracy)), h('td', { class: 'num-col' }, String(b.difficulty))))))
          : h('p', { class: 'muted' }, 'Play a round to set your first personal best.'))),

    h('h2', { class: 'stats-h' }, 'Skills'),
    h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1.2fr', alignItems: 'start' } },
      h('div', { class: 'card', style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, radar(sum.ratings)),
      h('div', { class: 'card' }, h('h3', {}, 'Ratings over time'),
        h('table', {},
          h('thead', {}, h('tr', {}, ['Skill', 'Rating', 'Rounds', 'Trend'].map((t) => h('th', {}, t)))),
          h('tbody', {}, SKILLS.map((k) => h('tr', {},
            h('td', {}, SKILL_LABELS[k]), h('td', { class: 'num-col' }, String(sum.ratings[k].r)), h('td', { class: 'num-col' }, String(sum.ratings[k].n)),
            h('td', {}, sparkline(sum.ratings[k].history)))))),
        h('p', { class: 'muted small' }, 'Levels aim for about 75 % success, so a rising rating means the games are getting harder for you.'))),

    h('h2', { class: 'stats-h' }, 'Learning'),
    h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', alignItems: 'start' } },
      h('div', { class: 'card' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { style: { margin: 0 } }, 'Keywords explored'), h('a', { class: 'btn small', href: '#/map' }, 'Curiosity map →')),
        h('p', { class: 'muted small' }, `${map.nodes.length} of ${map.total} topics, in ${map.domains.filter((d) => d.explored).length} of ${map.domains.length} domains. Last 12 weeks:`),
        lineChart(growth, { width: 460, name: 'Keywords explored', ariaLabel: 'Keywords explored, cumulative, last 12 weeks' })),
      h('div', { class: 'card' },
        h('h3', {}, 'Reviews due, next 14 days'),
        h('p', { class: 'muted small' }, `${srs.total} cards: ${srs.byState.new} new, ${srs.byState.learning + srs.byState.relearning} learning, ${srs.byState.review} in review (${srs.mature} well known). ${srs.retention30d == null ? '' : `Recalled ${pct(srs.retention30d)} of reviews in the last 30 days.`}`),
        columnChart(forecast, { width: 460, name: 'Cards due', labelEvery: 2, ariaLabel: 'Review cards due per day, next 14 days', empty: 'Nothing scheduled yet: cards get a date after their first review.' }))),
    h('div', { class: 'card', style: { marginTop: '14px' } },
      h('h3', {}, 'Videos'),
      h('p', {}, `${plural(extra.watched, 'video')} watched, ${extra.recalled} with your own recall summary. ${extra.queued ? `${extra.queued} waiting in your list.` : ''}`),
      h('a', { class: 'btn small', href: '#/learned' }, 'Things I’ve learned →'))));
}
