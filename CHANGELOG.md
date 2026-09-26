# Changelog

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
