# Changelog

## 0.4.0: Phase 4 (watch and learn)

**Added**
- **Videos from 36 curated channels** through their public RSS feeds (no key). Each channel is tagged with topics. Feeds are cached for 6 hours, and a feed that fails falls back to its last good copy. Shorts are left out. You can switch channels off or add your own by channel ID (Settings).
- **Internet Archive documentaries**: only items licensed public domain, CC0, CC BY or CC BY-SA (or from the Prelinger Archives); everything else is hidden.
- **YouTube search with your own key (optional)**: cached for 7 days, at most 20 searches a day.
- **Watch page**: your list, the latest videos from your channels (filter by topic), and what you've watched. Thumbnails come through the main process and load as they scroll into view. Videos always open in your browser; nothing is embedded or downloaded.
- **The keyword session's Watch step** now suggests videos that match the topic (the full name in the title counts most), plus archive films, with "Watch later".
- **Recall after watching**: three questions (the main idea, one fact, and which topic it was about, or what you still wonder). Your answers become a review card and an entry in **Things I've learned**, which also lists your finished keyword sessions by day.
- **Three picture quizzes** (83 game types in total):
  - **Art through time**: public-domain works from The Met and the Art Institute of Chicago; guess the era, the century (level 8+) or the artist.
  - **Name that species**: iNaturalist photos, Costa Rica by default, each credited to its photographer.
  - **What am I looking at?**: NASA's Astronomy Picture of the Day, with the astronomer's explanation afterwards.
  - Pictures you've seen are kept, so these quizzes also work offline after the first time.
- **Encrypted API keys** (YouTube, NASA) with Electron `safeStorage` (DPAPI on Windows) in `secrets.bin`. The page can set a key and see whether it's set, never read it. With no system encryption, keys are refused rather than stored in plain text.
- **The verify workflow** now checks every new source, the AIC image header, the new NASA endpoint, and each channel's feed title.
- 114 tests (16 new), with recorded responses for every new source.

**Fixed**
- The Trivia API couldn't be switched off in Settings (it was missing from the settings' list of sources).
- Art quiz centuries BC were off by one (300 BC is the 3rd century BC); found by the new tests before release.

**Not in this phase**
- Recall questions are generic (main idea, a fact, the topic). Questions about the video's actual content need its transcript or an AI model; that comes with the optional Claude features in Phase 6.
- The legacy NASA APOD endpoint is used until it closes on 2026-12-01; the new science.nasa.gov endpoint is ready (its format was checked live) and takes over automatically.
- Live check (verify workflow, 2026-09-27): all 15 sources answer; 35 of 36 channel feeds match (Vsauce's feed is valid but has no recent videos); 1,540 of 1,541 keywords resolved; the one that didn’t (“Pura vida”, no Wikipedia article) was replaced with “Costa Ricans”.
- Free Dictionary and Datamuse aren't used yet: the word games don't need them.


## 0.3.0: Phase 3 (variety)

**Added**
- **80 game types** (56 of our own plus 24 Tatham puzzles; the spec asked for 60+). Every one is seeded, adaptive (levels 1–10), pausable, and playable offline.
- **Simon Tatham's Portable Puzzle Collection:** 24 puzzles built to WebAssembly in CI from the unmodified upstream source (one exported status function added), with difficulty presets per level, "show solution" locked by the thinking timer, and the MIT notice.
- **Logic:** logic grids with a unique-solution generator, knights and knaves, Mastermind, Tower of Hanoi, syllogisms with counterexamples, spot the fallacy.
- **Math:** Countdown numbers, the 24 game (solver-backed), Fermi estimation, sequences, Kakuro, probability intuition, orders of magnitude.
- **Language:** Countdown letters, anagrams, Wordle-style, cryptograms, mini crosswords, etymology.
- **Memory:** digit span, Corsi blocks, card pairs, Kim's game, memory palace, "yesterday" recall.
- **Attention:** Flanker, Go/No-Go, reaction time, visual search, RSVP speed reading (14 original passages).
- **Spatial:** 3D mental rotation (canvas, no library), 15-puzzle, Rush Hour (728 prebuilt puzzles with exact minimum move counts), map geography (Natural Earth shapes baked to SVG at build time).
- **Strategy:** chess puzzles from the Lichess pack, play vs Stockfish (downloaded on first use, SHA-256 pinned, GPL notice and source links), Connect Four, Nim.
- **Knowledge:** trivia (Open Trivia DB + The Trivia API + 127 offline questions), guess the article, chronology, flags, capitals.
- **Deep thinking:** explain it back, steelman, first principles, no-AI challenge of the day.
- **Riddles:** 204 riddles, situation puzzles and rebuses.
- **Keyword bank: 1,541 keywords** (from 540), about 47 per domain.
- **Home** shows a different set of featured games each day; the **Games** page has a filter and a Tatham section; the **Daily Mix** rotates its games by date.
- **Licenses page** lists Tatham's puzzles, chess.js, flag-icons, world-atlas, the Lichess database, The Trivia API, and the Stockfish status (with the GPL text and a Remove button).
- 98 tests, including one for every new generator (unique solutions, legal chess lines, exact Rush Hour move counts, chirality in mental rotation, solvable 15-puzzles) and the engine download's integrity checks.

**Fixed**
- Optional page elements no longer show up as the text "null".
- Tatham Mines and Undead now end the round after "Show solution".
- Removed `frame-ancestors` from the page's meta CSP (browsers ignore it there and warn).

**Not in this phase**
- Tangrams: skipped. Dragging and rotating polygons needs more UI work than it's worth right now, and Tatham's puzzles already cover pipe connecting (Net).
- Go problems: no clearly licensed problem set was found, as the spec allowed.
- Kim's game uses emoji instead of museum images; the art, species and space providers arrive in Phase 4.
- The live Stockfish download couldn't be tested from this sandbox (its proxy blocks Electron's network stack). The installer is covered by unit tests, and the engine itself was tested end to end from verified local copies.
- The new keywords get their Wikidata IDs from the next *Verify online sources* run.


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
