// Bridge between Mind Gym and one of Simon Tatham's puzzles.
//
// URL: host.html?p=<puzzle>&t=<theme>#<params>#<seed>
// The puzzle's own front end reads the hash as a game id, so the same params and seed always
// give the same puzzle. This bridge loads the right puzzle, reports to the parent when it is
// solved (via mg_status(), a one-line export added at build time), and follows the parent's
// pause and "solution locked" messages.
(function () {
  'use strict';
  var PUZZLES = ['solo', 'keen', 'towers', 'unequal', 'pattern', 'loopy', 'lightup', 'bridges', 'net', 'tents',
    'range', 'galaxies', 'magnets', 'signpost', 'dominosa', 'filling', 'palisade', 'undead', 'mines', 'pearl',
    'tracks', 'unruly', 'map', 'mosaic'];
  var q = new URLSearchParams(location.search);
  var name = q.get('p');
  var theme = q.get('t');
  if (['night', 'dusk', 'forest', 'sand'].indexOf(theme) >= 0) document.documentElement.dataset.theme = theme;
  if (PUZZLES.indexOf(name) < 0) {
    document.getElementById('apology').textContent = 'Unknown puzzle.';
    return;
  }

  var reported = false;
  var revealed = false;
  var solveButton = document.getElementById('solve');
  var cover = document.getElementById('cover');
  var post = function (msg) { if (window.parent !== window) window.parent.postMessage(Object.assign({ source: 'mg-tatham' }, msg), location.origin); };

  // Using "Show solution" ends the round as revealed.
  // Some puzzles (e.g. Mines, Undead) don't count a shown solution as solved, so end the round
  // ourselves shortly after the solution appears.
  solveButton.addEventListener('click', function () {
    revealed = true;
    setTimeout(function () {
      if (!reported) { reported = true; post({ type: 'revealed' }); }
    }, 1200);
  }, true);

  function status() {
    try {
      return typeof Module !== 'undefined' && typeof Module._mg_status === 'function' ? Module._mg_status() : 0;
    } catch (e) {
      return 0;
    }
  }

  var ready = false;
  setInterval(function () {
    if (!ready && document.getElementById('puzzle').style.display === '') {
      ready = true;
      post({ type: 'ready', hasStatus: typeof Module._mg_status === 'function' });
    }
    if (!ready || reported) return;
    var s = status();
    if (s !== 0) {
      reported = true;
      post({ type: s > 0 ? (revealed ? 'revealed' : 'solved') : 'lost' });
    }
  }, 300);

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.source !== 'mg-host') return;
    if (e.data.type === 'pause') cover.hidden = false;
    if (e.data.type === 'resume') {
      cover.hidden = true;
      var c = document.getElementById('puzzlecanvas');
      if (c) c.focus();
    }
    if (e.data.type === 'lock-solve') {
      solveButton.disabled = Boolean(e.data.locked);
      solveButton.textContent = e.data.locked ? 'Show solution (' + e.data.seconds + 's)' : 'Show solution';
    }
  });

  // Helpers for the build-time preset discovery (scripts/tatham-presets.cjs).
  window.mgPresets = function () {
    return Array.prototype.map.call(document.querySelectorAll('#gametype input[name=preset]'), function (el) {
      return { value: el.value, name: el.parentNode.textContent.trim() };
    });
  };
  window.mgPickPreset = function (value) {
    var el = document.querySelector('#gametype input[name=preset][value="' + value + '"]');
    if (el) el.click();
  };
  window.mgPermalink = function () {
    return decodeURIComponent((document.getElementById('permalink-seed').getAttribute('href') || '').replace(/^#/, ''));
  };

  var s = document.createElement('script');
  s.src = '../assets/tatham/' + name + '.js';
  s.onerror = function () {
    document.getElementById('apology').textContent = 'This puzzle has not been built yet (run the "Build Tatham puzzles" workflow).';
    post({ type: 'missing' });
  };
  document.body.appendChild(s);
})();
