// Every theme keeps text readable: WCAG AA (4.5:1) for body and muted text and for accent buttons.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'theme.css'), 'utf8');

function tokens(theme) {
  const out = {};
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1];
    const applies = sel.includes(`[data-theme="${theme}"]`) || (theme === 'night' && /:root/.test(sel));
    if (!applies) continue;
    for (const [, k, v] of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[k] = v.trim();
  }
  return out;
}

const lum = (hex) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const theme of ['night', 'dusk', 'forest', 'sand']) {
  test(`${theme}: contrast`, () => {
    const t = tokens(theme);
    for (const k of ['bg', 'text', 'muted', 'accent', 'accent-ink', 'ok', 'bad']) assert.match(t[k] || '', /^#[0-9a-f]{6}$/i, `${theme} --${k}`);
    assert.ok(ratio(t.text, t.bg) >= 7, `${theme} text ${ratio(t.text, t.bg).toFixed(2)}`);
    assert.ok(ratio(t.muted, t.bg) >= 4.5, `${theme} muted ${ratio(t.muted, t.bg).toFixed(2)}`);
    assert.ok(ratio(t['accent-ink'], t.accent) >= 4.5, `${theme} accent button ${ratio(t['accent-ink'], t.accent).toFixed(2)}`);
    assert.ok(ratio(t.ok, t.bg) >= 3 && ratio(t.bad, t.bg) >= 3, `${theme} ok/bad`);
    // chart series (views/charts.js): graphics need 3:1 against the surface they sit on
    for (const k of ['chart-1', 'chart-2']) {
      assert.match(t[k] || '', /^#[0-9a-f]{6}$/i, `${theme} --${k}`);
      assert.ok(ratio(t[k], t['bg-2']) >= 3, `${theme} ${k} ${ratio(t[k], t['bg-2']).toFixed(2)}`);
    }
  });
}

test('stroop inks are readable on the fixed stimulus panel', () => {
  for (const ink of ['#D55E00', '#0072B2', '#009E73', '#F0E442']) {
    assert.ok(ratio(ink, '#1b1b24') >= 3, `${ink} ${ratio(ink, '#1b1b24').toFixed(2)}`);
  }
});
