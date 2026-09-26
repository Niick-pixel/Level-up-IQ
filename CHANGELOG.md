# Changelog

## 0.2.0: Phase 2 (online content)

**Added**
- **Provider framework** (`src/main/providers/`):
  - Every online source declares its hosts, license, attribution, rate limit and cache TTL.
  - Requests run through one pipeline: host allowlist (redirects included), fresh-cache check, offline / turned-off / rate-limited checks, a per-source rate limiter, our identifying User-Agent and a timeout, then the cache.
  - A 429 or 503 pauses that source for `Retry-After` (or its default), and requests stop meanwhile.
  - If the network fails, the last saved copy is used.
- **Disk cache** in `%APPDATA%/Mind Gym/cache/`: stale entries still show when offline, and the cache is capped at 200 MB (least recently used files go first).
  - Images are downloaded by the main process and shown through a private `mg-cache://` protocol, so the pages still can't reach the network.
- **Sources:**
  - **Wikipedia:** summaries, lead images, "On this day", topic search, and page links.
  - **Wikidata:** dated key facts, with date precision respected.
  - **Open Trivia DB:** bonus trivia per domain, with a session token so questions don't repeat, and a 5.5-second spacing between requests.
  - **Lichess:** the daily puzzle; one request at a time, with a one-minute pause after a 429.
- **The full keyword session** (spec §2): predict → learn → quiz → puzzle tie-in → explain it back → watch → remember.
  - The quiz has 5–8 seeded questions: "which topic is this?", Wikidata dates, fill-the-gap from the summary, related topics, aliases and bonus trivia.
  - Offline, it still builds at least 5 questions from the keyword bank alone. A test checks this for every keyword.
  - Explain-it-back is checked locally against the summary's key ideas (bank topics, names, frequent words), and you see exactly what you covered and missed.
  - Finishing a session saves review cards and updates your stats and your Knowledge and Deep-thinking ratings.
- **Add your own keywords:** search Wikipedia, or roll a random article, pick a domain, and add it. Each keyword page can also suggest more topics from its Wikipedia links.
- **Home:** an "On this day" event (linked to a keyword when one matches) and the Lichess daily puzzle. Both are hidden when offline.
- **Settings:** offline mode, per-source switches with live status, cache size, and "clear cache". The Licenses page credits every source.
- **Review page:** lists the cards saved from sessions. FSRS scheduling arrives in Phase 5.
- **Offline countries pack** (195 countries, capitals, continents, flags from `flag-icons`), replacing the REST Countries API. REST Countries v3.1 was switched off on 2026-09-10, and v5 needs an API key.
- **`verify-providers` workflow** (weekly, plus manual):
  - Checks every live endpoint, resolves every keyword's Wikipedia title to a Wikidata ID, and compares capitals with Wikidata.
  - Can commit the keyword IDs, and can build the 30,000-puzzle offline Lichess pack (`scripts/build-lichess-subset.js`).
- 72 tests, including recorded API responses for every provider, offline fallback with the network mocked off, rate limiting, lockouts, host checks, and cache pruning.

**Fixed**
- Windows CI: pinned LF line endings (`.gitattributes`), since the keyword check failed on CRLF checkouts.

**Not in this phase**
- Live checks against the real APIs happen in CI; this development sandbox can't reach them.
- The offline Lichess puzzle pack is built by the workflow; the chess games that use it arrive in Phase 3.
- Video suggestions (the "Watch" step) arrive in Phase 4. For now the step offers a YouTube search and the full article.

## 0.1.0: Phase 1 (skeleton)

**Added**
- Electron app modelled on Focus Point: single window, the Night/Dusk/Forest/Sand themes, settings in `%APPDATA%/Mind Gym/settings.json`, and electron-updater with GitHub Releases.
- Security:
  - Pages load from a private `app://` protocol, with `contextIsolation`, `sandbox`, no Node access, and a strict CSP.
  - The renderer can't make network requests.
  - External links open in the browser, for allowlisted sites only.
- Home screen:
  - Daily Mix, Keyword of the Day, Ctrl+K search (keywords + games), and Random Anything.
  - Stats and settings.
  - Review and Watch later are placeholders for now.
- **Keyword bank: 540 keywords across 33 domains.**
  - Fuzzy search with aliases and typos, plus domain and tag filters.
  - Random modes: any, in domain, outside my comfort zone, rabbit hole.
  - Keyword of the Day is stable per date.
  - Keywords are written as shards in `data/keywords/` and validated by `npm run keywords:build`.
- **Game contract** (`start(root, ctx)` → `onFinish`). Every game is seeded, with shareable seed codes (`stroop:4:k9x2mf`), pause/resume, and auto-pause when the window loses focus.
- **Five games:** mental math sprint, Stroop (plus a colour-blind spatial variant), dual n-back, Schulte table, and word ladder (English).
- Per-skill adaptive difficulty, aiming for about 75 % success with a user bias.
- A thinking timer that locks hints and "show solution".
- Stats:
  - Minutes per day, rounds, sessions, and "thinking without AI" time.
  - Personal bests, a 14-day chart, and a skill radar.
  - JSON and CSV export, and reset.
- Settings: theme, mix length, difficulty bias, thinking timer, colour-blind mode, safe maximize, opt-in fullscreen with a Focus Point warning, tray / reminder / start with Windows (all off by default), updates, reset stats and settings, and a licenses page.
- Focus Point coexistence: "safe maximize" stops Mind Gym from looking fullscreen to Focus Point when the taskbar is auto-hidden or missing.
- 43 tests:
  - RNG determinism.
  - Every generator is solvable and correct at every level.
  - Keyword build and search.
  - Store, stats, and ratings.
  - Protocol path escapes, the link allowlist, and the window guard.
  - WCAG contrast for all four themes.
- GitHub Actions: test, check the keyword bank, build the NSIS installer, and self-publish a release when `main` has a new version.

**Not in this phase**
- Online content (Wikipedia, Wikidata, trivia, Lichess), the full keyword session, and the provider framework: Phase 2.
- The Daily Mix doesn't use its length setting or weak-skill weighting yet: Phase 5.
- Spanish word lists: later, as decided.
- Keyword Wikidata IDs: filled by the Phase 2 verification script, not typed by hand.
