# Mind Gym: Phase 0 plan

Status: **plan only, no app code yet.** Waiting for your review before Phase 1.
Date: 2026-09-26. Spec: [`MIND_GYM_SPEC.md`](MIND_GYM_SPEC.md).

---

## 0. TL;DR

- **Stack:** the same as Focus Point: Electron 44, Node 22, CommonJS in the main process, vanilla JS ES modules and a few web components in the renderer. **No UI framework, no bundler.** Tests use `node --test`, installers use electron-builder NSIS, and updates use electron-updater + GitHub Releases, with the same self-publishing workflow.
- **Storage:** plain JSON and JSONL files in `%APPDATA%/Mind Gym/`. No SQLite and no native modules. Focus Point only needs `koffi` for Win32 calls, and Mind Gym doesn't need any.
- **Networking:** only the main process touches the network, through `providers/`. Each provider declares its hosts and gets an allowlist check, a disk cache with a TTL, a token-bucket limiter, 429 backoff, and an offline fallback. **Remote images also go through the main process** and are served to the UI from a local `mg-cache://` protocol. That keeps the CSP at `img-src 'self' mg-cache:`, makes images work offline, and lets us send headers an `<img>` tag can't (the Art Institute of Chicago needs this).
- **Provider verification:**
  - 12 of the 15 providers are **usable**.
  - **REST Countries is out.** v3.1 was switched off on 2026-09-10, and v5 needs an API key with a 500 requests/month free tier. The replacement is a bundled dataset built from Wikidata (CC0), `flag-icons` (MIT), and `world-atlas` (ISC).
  - **NASA APOD** is moving to a new endpoint, and the legacy API goes offline on 2026-12-01.
  - **Datamuse** requires a key from 2027-01-01.
  - **Stockfish is GPL-3.0**, so it needs a licensing decision (§7, Q2).
  - **Go problems:** no clearly licensed dataset exists, so they're skipped, as the spec allows.
- **Coexistence caveat found in Focus Point's detector:** a *maximized* Mind Gym window is reported as "fullscreen" when the taskbar is auto-hidden, or on a monitor without a taskbar. §2.2 has the fix, which lives entirely on Mind Gym's side.
- **This cloud sandbox blocks every provider host**, so I verified terms from the official docs through web search, not with live calls. I'll add a `verify-providers` GitHub Actions workflow that hits every endpoint, channel ID, and keyword title/QID from CI (§5.2).

---

## 1. What I took from Focus Point (patterns, not code)

| Pattern in Focus Point | File | How Mind Gym reuses it |
| --- | --- | --- |
| JSON store: `DEFAULTS` merged with the saved file, atomic write (`.tmp` + `rename`), `structuredClone` on get | `src/main/store.js` | The same shape for `settings.json`, `stats.json`, `srs.json`, and so on. One small `JsonFile` helper is shared by all stores. |
| Single-instance lock, `setAppUserModelId`, login item with `--hidden` | `src/main/main.js` | The same. The app ID is `com.mindgym.app`, and login launch is **off** by default. |
| `contextIsolation: true`, `nodeIntegration: false`, and a preload that exposes `window.api` with `invoke`/`on` helpers | `src/preload.js` | The same, plus `sandbox: true` and an IPC channel allowlist in the preload. |
| A CSP `<meta>` on every page | `src/renderer/*.html` | The same, tightened: `default-src 'self'; img-src 'self' mg-cache: data:; connect-src 'none'`. The renderer can't make any network calls. |
| Theme tokens on `[data-theme]` (Night, Dusk, Forest, Sand) plus a title-bar colour map in main | `src/renderer/theme.css`, `THEMES` in main | The same token names and values, so the two apps look like siblings. Mind Gym adds game tokens: `--ok`, `--bad`, `--warn`, and the colourblind-safe Stroop palette. |
| `createUpdater({app, getSettings, onChange})` state machine, no-op in dev | `src/main/updater.js` | The same pattern. |
| CI: `windows-latest`, Node 22, `npm ci`, `npm test`, `npm run dist`, check `latest.yml`, auto-release when the `package.json` version has no release yet | `.github/workflows/build-windows.yml` | The same flow. Artifact name `MindGym-Setup-${version}.exe`, and `publish.owner/repo` points at this repo. |
| Injectable clock (`{ now }`) for deterministic tests | `timer.js`, `stats.js`, tests | Used everywhere: stats, SRS, Keyword of the Day, and streaks. |
| README with Features / Install / Run from source / "How it's built" table | `README.md` | The same structure in Phase 6. |

### 1.1 Coexistence with Focus Point (analysis)

Focus Point's `fullscreen.js` treats the foreground window as "fullscreen" when:

1. `SHQueryUserNotificationState` says busy (D3D fullscreen, presentation mode, or a fullscreen app), **or**
2. `GetWindowRect(foreground)` covers the **whole monitor rect** (`rcMonitor`, not `rcWork`).

What that means for Mind Gym:

- **Windowed (default):** never detected, so breaks fire normally. ✅
- **Maximized, taskbar visible:** a maximized window fills the *work area* (about 8 px invisible borders overhang it), and the bottom edge stops above the taskbar. It's not detected. ✅
- **Maximized with an auto-hidden taskbar, or on a secondary monitor with "show taskbar on all displays" turned off:** work area = monitor, so a maximized window **is detected as fullscreen, and Focus Point would hold breaks.** ⚠️
- **HTML fullscreen / `setFullScreen(true)`:** detected. That's expected, and the spec already makes it opt-in with a warning.

**Mitigation, entirely in Mind Gym (Focus Point stays untouched):**

- Default to a **1280×820 centered window**, and remember size and position.
- On `maximize`, if the display's `workArea` equals its `bounds` (no visible taskbar), unmaximize and `setBounds(workArea)` minus 1 px at the bottom. It looks the same, but Focus Point's rect check fails, so breaks still fire. There's a Settings toggle ("Keep Focus Point breaks working when maximized", on by default).
- Timed games **auto-pause on window blur**, so a Focus Point break overlay doesn't wreck a Stroop or reaction-time run. Paused time isn't counted as training time.
- Settings → Display → Fullscreen (opt-in) shows the warning text the spec asks for.

---

## 2. Project structure

```
package.json                  # "main": "src/main/main.js", scripts: start, dev, test, dist, keywords:build, verify:providers
src/
  preload.js                  # contextBridge → window.api (allowlisted channels only)
  main/
    main.js                   # single window, menus, protocol handlers (app://, mg-cache://), IPC registration
    ipc.js                    # every ipcMain.handle in one place, with argument validation
    store.js                  # settings.json (DEFAULTS + atomic writes) — Focus Point pattern
    json-file.js              # shared atomic JSON/JSONL read/write helper
    secrets.js                # safeStorage (DPAPI on Windows) → secrets.bin; never in settings.json
    updater.js                # electron-updater (Phase 6 wires it into the UI)
    window-guard.js           # "safe maximize" + blur/focus events (Focus Point coexistence)
    keywords.js               # load bank, Fuse index, random modes, related-graph walk, Keyword of the Day
    stats.js                  # per-day aggregates (stats.json) + history.jsonl (append-only results)
    rating.js                 # per-skill Glicko-2-lite; pick difficulty targeting ~75 % success
    srs.js                    # ts-fsrs wrapper; cards in srs.json
    cache.js                  # %APPDATA%/Mind Gym/cache/{json,img}/ — key = sha1(url), TTL, stale-if-offline, size cap + LRU
    net.js                    # electron net.fetch wrapper: UA, timeout, allowlist, 429/Retry-After backoff
    providers/
      provider.js             # base class: id, name, hosts[], license, attribution(), limiter, ttl, isAvailable(), fetch(), fallback()
      registry.js             # enabled providers from settings; exposes provider:* IPC
      wikipedia.js wikidata.js opentdb.js triviaapi.js lichess.js
      met.js aic.js inaturalist.js apod.js dictionary.js datamuse.js
      youtube-rss.js youtube-api.js archive.js anthropic.js
  shared/
    rng.js                    # cyrb128 string hash → sfc32 PRNG; seed codes "gameId:difficulty:seed"
    game-contract.js          # the game interface + validator (also used in tests)
  renderer/
    index.html app.js app.css theme.css
    router.js                 # hash router; views and games load via dynamic import() (lazy)
    components/               # <mg-timer>, <mg-card>, <mg-search>, <mg-skill-chip>, <mg-attrib> (web components)
    views/                    # home, daily-mix, keyword-session, catalog, review, watch-later, stats, settings, licenses
    games/
      mental-math/ stroop/ nback/ schulte/ word-ladder/   # Phase 1
      …                                                   # one folder each: index.js (meta + start) + game.css
    vendor/                   # served from node_modules via app:// allowlist (three, chess.js, dompurify) — no bundler
assets/
  keywords.json               # built artifact (see scripts/build-keywords.js)
  packs/                      # offline: trivia, riddles, fallacies, words-en, words-es, countries, on-this-day, lichess-puzzles
  tatham/                     # Phase 3: Emscripten build output + LICENCE
  icon.png tray.png
data/keywords/<domain>.json   # hand-authored shards (easier review and diffs), merged + validated at build
scripts/
  build-keywords.js           # merge shards, check unique ids, dangling `related`, domains, difficulty 1–5
  verify-providers.js         # live checks of every endpoint, channel ID, keyword title → QID (CI + locally)
  build-countries.js          # Wikidata SPARQL → assets/packs/countries.json (CC0)
  build-lichess-subset.js     # stream lichess_db_puzzle.csv.zst → ~30k stratified puzzles
  make-icons.js
test/                         # node --test; network always mocked
.github/workflows/
  build-windows.yml           # test + NSIS + self-publishing release (Focus Point flow)
  verify-providers.yml        # weekly + manual; writes a Markdown report to the job summary; never blocks builds
docs/
```

### 2.1 Key design decisions

- **Why no framework or bundler:** the spec asks for vanilla JS. Chromium in Electron 44 runs native ES modules, dynamic `import()` (lazy games), and custom elements. Views and games are small, self-contained modules. A bundler would only add build steps and slow down iteration. Libraries the renderer needs (three.js, chess.js, DOMPurify) ship ESM builds and are served read-only from `node_modules` through the `app://` protocol handler, with a path allowlist.
- **`app://` protocol instead of `file://`:** it's registered as `standard` and `secure`. That gives the pages a real origin, so ES modules, `'self'` in the CSP, and `fetch('app://…/packs/x.json')` all behave. It also makes it impossible for a page to read arbitrary local files.
- **Game contract** (`shared/game-contract.js`):
  ```js
  export const meta = { id, name, skills: ['attention'], durationRange: [60, 120], difficultyRange: [1, 10], offline: true, lang: ['en','es'] };
  export function start(root, { difficulty, seed, rng, thinkingTimerSec, onFinish, onProgress }) { … return { pause, resume, destroy }; }
  // onFinish({ score, accuracy, timeMs, difficulty, seed, meta: {...} })
  ```
  `pause`/`resume` are mandatory, which is how auto-pause on blur works.
- **Seeded RNG:** `cyrb128(seedString)` feeds `sfc32`, which is fast, well tested, and gives the same output on every platform. Seed strings are human-shareable, e.g. `stroop:4:k9x2`. Keyword of the Day = `rng('kotd:' + localDate)` picking from the bank.
- **Adaptivity:** each skill gets a Glicko-2-lite rating (μ, φ). Each game maps difficulty 1–10 to an item rating curve. The picker chooses the difficulty whose expected success rate is closest to 75 % (the spec's 70–80 % band), and a "difficulty bias" setting shifts the target ±10 %.
- **SRS:** `ts-fsrs` v5 (MIT, CommonJS export available) runs in main. Cards are `{id, type: fact|vocab|video|keyword, front, back, source, fsrs}`.
- **Stats:** `stats.json` holds per-day aggregates (minutes, sessions, per-skill counts, "thinking without AI" minutes). `history.jsonl` holds one line per finished game, so the radar-over-time and personal bests can be recomputed any time. Both export to JSON or CSV.
- **Secrets:** stored with `safeStorage.encryptString` in `secrets.bin`. If `safeStorage.isEncryptionAvailable()` is false, keys are refused with a clear message and never fall back to plaintext.

---

## 3. Dependencies

Versions come from the npm registry on 2026-09-26.

| Package | Ver | License | Where | Why |
| --- | --- | --- | --- | --- |
| electron | 44.4.5 | MIT | dev | same as Focus Point |
| electron-builder | 26.x | MIT | dev | NSIS installer |
| electron-updater | 6.8.9 | MIT | main | auto-update (wired in Phase 6, like Focus Point) |
| fuse.js | 7.5.0 | Apache-2.0 | main | fuzzy keyword + game search |
| ts-fsrs | 5.4.2 | MIT | main | FSRS scheduling (Phase 5) |
| dompurify | 3.4.x | MPL-2.0 / Apache-2.0 | renderer | sanitize any external HTML (plain-text extracts preferred) |
| fast-xml-parser | 5.x | MIT | main | YouTube RSS (Phase 4) |
| chess.js | 1.4.0 | BSD-2 | renderer | move validation for puzzles / vs engine (Phase 3) |
| three | 0.186 | MIT | renderer | 3D mental rotation (Phase 3) |
| world-atlas + topojson-client | 2.0.2 / 3.1 | ISC | renderer | map geography (Natural Earth, public domain) |
| flag-icons | 7.5 | MIT | assets | SVG flags (replaces REST Countries flags) |
| an-array-of-english-words / -spanish-words | 2.0 | MIT | build-time | word lists, filtered into curated packs (common words, profanity removed) |
| stockfish (nmrugg) | 19.0 | **GPL-3.0** | first-use download | see §7, Q2 |
| Tatham puzzles | upstream | MIT | assets | Emscripten build in CI (Phase 3) |

No `koffi`: Mind Gym doesn't need Win32 calls.

---

## 4. Release workflow

It works like Focus Point's `build-windows.yml`:

1. It runs on every push, on `v*` tags, and on manual dispatch, using `windows-latest` and Node 22.
2. It runs `npm ci`, then `npm test`, then `npm run keywords:build -- --check` (fails if `assets/keywords.json` is stale or invalid), then `npm run dist`.
3. It checks that `dist/latest.yml` exists and uploads the `.exe`, `.blockmap`, and `latest.yml` as build artifacts.
4. On `main`, if the `package.json` version has no release yet, it creates tag `vX.Y.Z` and a GitHub Release with the three files attached. Installed copies update from that.
5. **Requirement:** electron-updater reads Releases anonymously, so **this repository's Releases must be public** (see §7, Q1).

A second workflow, `verify-providers.yml` (weekly cron + manual), runs `scripts/verify-providers.js`:
- It sends one light request per provider with our User-Agent and records status, latency, and whether the response shape matches.
- It checks each curated YouTube channel ID (the RSS feed returns 200 and the `<title>` matches the expected name).
- It checks keyword titles: it resolves each `wikipedia` title through the Action API (`prop=pageprops`, 50 titles per request, ≤ 1 request/s), follows redirects, and **fills `wikidata` QIDs from `pageprops.wikibase_item`** instead of trusting hand-typed QIDs.
- Output: a Markdown table in the job summary and a `verify-report.json` artifact. It never fails the release build.

---

## 5. Provider verification

**Method and caveat:** this cloud session's network policy blocks all of these hosts (CONNECT 403), so I couldn't make live calls. I checked each provider's official docs and recent announcements through web search. Everything marked "verify live" gets confirmed by `verify-providers.yml` before its phase ships.

### 5.1 Results

| Provider | Alive? | Terms / license | Limits | Decision |
| --- | --- | --- | --- | --- |
| **Wikipedia REST** (`en.wikipedia.org/api/rest_v1/page/summary`, `/page/random/summary`, `/feed/onthisday`, `/feed/featured`) | ✅ | Text CC BY-SA 4.0: show article title + link + license on every card | New 2026 global limits: an identified UA with contact info gets roughly 200 req/min; unidentified gets about 10 req/min. `api.wikimedia.org` Core API is being deprecated from July 2026; the `rest_v1/feed/*` removal date is "TBA, not before Sept 2026". | **Use.** UA: `MindGym/<ver> (+https://github.com/Niick-pixel/Level-up-IQ)`. ≤ 1 req/s. Endpoints live in one table so a migration is a one-line change. On This Day falls back to Wikidata + an offline pack. |
| **Wikidata** (SPARQL `query.wikidata.org` = main graph since the 2025 graph split; `Special:EntityData`) | ✅, but reported much slower in 2026 | CC0 | 60 s of query time per 60 s per UA+IP; 60 s timeout; 429 + Retry-After | **Use lightly.** Heavy question generation (capitals, populations, dates) is **precomputed by build scripts into offline packs**. Live queries are small, `LIMIT`ed, cached 30 days, with a 20 s timeout and the pack as fallback. |
| **Open Trivia DB** | ✅ (≈ 21k+ questions reported) | CC BY-SA 4.0 | 1 request / 5 s per IP; session tokens avoid repeats (expire after 6 h idle) | **Use.** Limiter 1 per 5.5 s, batches of up to 50, token stored in cache. |
| **The Trivia API** (`/v2/questions`) | ✅ | **CC BY-NC 4.0**; free for non-commercial use, attribution appreciated | free tier needs no key | **Use, for a free app only.** If Mind Gym is ever sold, this must go or become a paid plan. Credited in Licenses. |
| **Lichess API** (`/api/puzzle/daily`, `/api/puzzle/{id}`) | ✅ | Puzzle DB **CC0** (≈ 6.1 M puzzles, updated 2026-09-10) | **One request at a time**; on 429 wait a full minute | **Use.** Concurrency 1, 60 s lockout on 429. Offline: a **~30k puzzle subset** stratified by rating and theme (~2–3 MB), built by a script in CI. |
| **REST Countries** | ⚠️ **v3.1 switched off 2026-09-10**; v5 needs an API key (free tier 500 req/month) | — | — | **Skip the API.** Replace with `assets/packs/countries.json` built from Wikidata (CC0: name EN/ES, capital, borders, population, area, continent, ISO codes) + `flag-icons` (MIT) + `world-atlas` (ISC). Fully offline, no key. |
| **The Met Collection API** | ✅ | Open Access objects (`isPublicDomain: true`) are **CC0** | no documented limit | **Use.** Politely at ≤ 2 req/s, public-domain images only, attribution line anyway. |
| **Art Institute of Chicago API** | ✅ | Data mostly CC0 (descriptions CC BY 4.0); images only when `is_public_domain` | 60 req/min anonymous. **Known issue (June 2026):** IIIF images return a 403 Cloudflare challenge unless an `AIC-User-Agent` header is sent | **Use.** Always send `AIC-User-Agent: MindGym (+repo URL)`. Images come through our main-process image cache, which is why that design matters. |
| **iNaturalist API v1** | ✅ | Photo license is per photo | ≤ 60 req/min recommended (hard limit 100), < 10k/day, media download caps (5 GB/h, 24 GB/day) | **Use.** Filter `photo_license=cc0,cc-by,cc-by-nc`, show each photo's attribution string, cache photos locally. Costa Rica `place_id` checked by verify script. |
| **NASA APOD** | ⚠️ Migrated in Sept 2026 to a WordPress-backed API (`science.nasa.gov/wp-json/wp/v2/apod-basic`); **legacy `api.nasa.gov/planetary/apod` offline 2026-12-01** | APOD images: copyright varies per image, so show the credit/copyright field | DEMO_KEY: 30/h, 50/day per IP | **Use the new endpoint** (Phase 4, verify live first). DEMO_KEY by default, optional personal key. Cache 1 year per date. |
| **Free Dictionary API** (`api.dictionaryapi.dev`) | ✅ | Data from Wiktionary, CC BY-SA | no key; community-run, no SLA | **Use as enrichment only.** Cache for ever; word games never depend on it. |
| **Datamuse** | ✅ | Attribution requested | 100k/day without key **until 2027-01-01**; **API key required after that** | **Use.** Optional key field in Settings now; word games run on offline lists, so nothing breaks in 2027. |
| **YouTube channel RSS** | ✅, but intermittent 404s since Dec 2025 (reported stable by May 2026) | YouTube ToS: we only link out, never download | 15 latest videos per feed | **Use.** Cache 6 h, keep last good copy, retry with backoff. Channel IDs checked by the verify workflow (I can't reach YouTube from here). |
| **YouTube Data API v3** | ✅ | Google API ToS; key is the user's own | 10,000 units/day; `search.list` = 100 units (reportedly a separate 100-search/day bucket since June 2026) | **Optional, off without a key.** Cache searches 7 days, ≤ 20 searches/day guard. |
| **Internet Archive** (`advancedsearch.php`, metadata API) | ✅ | Varies per item; must check `licenseurl` | reasonable use, no deep paging | **Use** for items where `licenseurl` is Public Domain Mark / CC0 / CC BY or the collection is public-domain (e.g. Prelinger). Everything else is hidden. |
| **Anthropic API** | ✅ | Your own key and account | per-key | **Phase 6, off by default.** Model IDs get picked from the current docs at that point. |
| **Link-outs** (Project Euler, Advent of Code, Khan Academy, MIT OCW, Brilliant, Lichess studies) | — | link only | — | `shell.openExternal` only, no fetching. |

### 5.2 Library and content checks

- **Simon Tatham's Puzzles:** MIT. The official site publishes JS/WASM builds produced with Emscripten from the C source. **Plan:** a CI job builds the 24 puzzles from a pinned upstream commit into `assets/tatham/`, with `LICENCE` kept. Each puzzle runs in its own `app://` page inside an `<iframe sandbox="allow-scripts">`, themed through injected CSS, with the game contract implemented by a thin wrapper that reads completion status. This is the most integration-heavy item in Phase 3.
- **Stockfish WASM:** `stockfish` 19.0 on npm is **GPL-3.0**, and the "lite single-threaded" build is about 1.6 MB. See §7, Q2.
- **Go problems:** I found no clearly licensed (CC0/CC BY) tsumego dataset. **Skipped**, as the spec allows. If you know one, I'll add it.
- **Offline packs derived from CC BY-SA sources** (Wikipedia facts, OpenTDB snapshot) ship with their own `LICENSE-CC-BY-SA.txt` and per-item source links. The app code stays MIT.

---

## 6. Risks and mitigations

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | **Keyword accuracy at 3,000 entries.** Wrong Wikipedia titles or invented QIDs. | I author `term`, `aliases`, `domain`, `tags`, `difficulty`, `related`, and `wikipedia` only. **QIDs are filled by `verify-providers.js`** from Wikipedia pageprops, and unresolved titles get flagged in the report. The build script checks structure (unique IDs, no dangling `related`, valid domain). |
| 2 | Wikimedia endpoint churn (2026–27 API migration) | One endpoint table, Action API fallback for summaries, weekly verify job, offline packs. |
| 3 | Wikidata Query Service slowness | Precompute packs at build time; live queries tiny and cached. |
| 4 | Remote images can't carry headers, and CSP would need many hosts | Main-process image cache served over `mg-cache://`. |
| 5 | Focus Point sees a maximized Mind Gym as fullscreen in taskbar-less setups | "Safe maximize" (§1.1) + auto-pause on blur. |
| 6 | Stockfish GPL | Your call (§7, Q2). |
| 7 | Tatham integration effort (24 puzzles, Emscripten toolchain) | Pin the upstream commit, build in CI, cache the output. If WASM embedding fights us, fall back to the upstream JS build. |
| 8 | Colour reliance in Stroop | Okabe–Ito palette, and a pattern/shape variant of Stroop for colourblind mode; contrast checked per theme in tests (WCAG AA for text tokens). |
| 9 | "Brain training" overclaiming | Research on far transfer from n-back-style training is mixed to weak. The app frames games as practice and fun, and puts its effort into retrieval, SRS, explain-it-back, and curiosity, which have much stronger evidence. No "IQ" claims in the UI. |
| 10 | I can't reach provider hosts from this sandbox | Every provider is built against **recorded fixtures** (mocked `net`), and the verify workflow checks the live API in CI. Optionally, you allowlist hosts for this environment (§7, Q4). |
| 11 | 2027 changes (Datamuse key, NASA endpoint) | Optional key fields exist from day one; offline fallbacks mean nothing hard-breaks. |

---

## 7. Decisions I need from you

1. **Repo and name.** The spec says a new `Mind-Gym` repo, but this session is in **`Niick-pixel/Level-up-IQ`** (empty). My plan: build Mind Gym here (product name "Mind Gym", app ID `com.mindgym.app`, updates published from this repo's Releases). **Is that OK, and are this repo's Releases public?** Auto-update doesn't work from a private repo without embedding a token, which I won't do. You can rename the repo later; GitHub redirects, but I'd update `publish.repo`.
2. **Stockfish (GPL-3.0).** Options:
   - **(a) Recommended:** keep Mind Gym MIT, and **download the unmodified Stockfish WASM on first use** into the cache. It runs as a separate UCI engine in a Web Worker (separate program, "mere aggregation"). Licenses page shows GPL-3.0 text + source link.
   - **(b)** Ship Stockfish in the installer and license the whole app GPL-3.0.
   - **(c)** No Stockfish: my own small alpha-beta engine on chess.js (weaker, fine for casual play).
3. **The Trivia API is CC BY-NC.** Fine as long as Mind Gym stays free. Keep it?
4. **Network for this cloud environment (optional).** To test providers live from here, add these hosts to the environment's allowed domains (cloud environment menu in the session title bar → Edit → Network access): `en.wikipedia.org`, `www.wikidata.org`, `query.wikidata.org`, `opentdb.com`, `the-trivia-api.com`, `lichess.org`, `database.lichess.org`, `collectionapi.metmuseum.org`, `images.metmuseum.org`, `api.artic.edu`, `www.artic.edu`, `api.inaturalist.org`, `science.nasa.gov`, `api.nasa.gov`, `api.dictionaryapi.dev`, `api.datamuse.com`, `www.youtube.com`, `archive.org`, `www.chiark.greenend.org.uk`, `cdn.jsdelivr.net`. Without them, the plan still works through fixtures + the CI verify job.
5. **Spanish Wordle list.** Accents folded (`á` counts as `a`) and `ñ` kept as its own letter. OK?

---

## 8. Game count check (target: 60+)

| Group | Types | Count |
| --- | --- | --- |
| A. Tatham | Solo, Keen, Towers, Unequal, Pattern, Loopy, Light Up, Bridges, Net, Tents, Range, Galaxies, Magnets, Signpost, Dominosa, Filling, Palisade, Undead, Mines, Pearl, Tracks, Unruly, Map, Mosaic | 24 |
| A. Logic (own) | zebra, knights & knaves, Mastermind, Hanoi, syllogisms, spot-the-fallacy | 6 |
| B. Math | mental math, Countdown numbers, 24, Fermi, sequences, Kakuro, probability intuition, orders of magnitude | 8 |
| C. Language | Countdown letters, anagrams, word ladder, Wordle EN/ES, cryptogram, mini crossword, etymology | 7 |
| D. Memory | dual n-back, digit span, Corsi, pairs, Kim's game, memory palace, yesterday recall | 7 |
| E. Attention | Stroop, Schulte, Flanker, Go/No-Go, reaction time, visual search, RSVP | 7 |
| F. Spatial | mental rotation, tangram, 15-puzzle, sliding blocks, pipes, map geography | 6 |
| G. Strategy | chess puzzles, vs engine, Connect Four, Nim | 4 |
| H. Knowledge | trivia, guess-the-article, chronology, higher/lower, art era, species ID, APOD, flags & capitals | 8 |
| I/J. Deep + riddles | explain-back, predict-verify, steelman, first principles, riddles, situation puzzles, rebuses | 7 |
| **Total** | | **84** |

Vocab SRS and Socratic mode are modes, so they aren't counted.

---

## 9. Phase 1 scope and acceptance criteria

1. `npm start` opens a 1280×820 window. The home screen shows Daily Mix (placeholder that chains the 5 games), Keyword of the Day, search (keywords + games), Random Anything, Review (empty state), Watch later (empty state), and Stats.
2. Settings: theme (4 themes, live switch + title-bar colour), session length, difficulty bias, word-game language, thinking-timer seconds, tray / reminder / start-with-Windows toggles (all off), safe-maximize toggle, reset stats, and a Licenses page.
3. Keyword bank: **500 entries** across all 33 domains. Fuzzy search with alias, tag, and domain filters; random / in-domain / comfort-zone / rabbit hole; Keyword of the Day stable per local date.
4. Game contract + 5 games: **mental math, Stroop (with colourblind variant), dual n-back, Schulte, word ladder (EN + ES)**. All seeded, keyboard-first, auto-pause on blur, thinking timer respected.
5. Stats: per-day minutes, sessions, games, personal bests, a simple skill radar, and JSON/CSV export.
6. Tests: RNG determinism, every generator (word-ladder solvable via BFS, Schulte grid valid, n-back target rate within bounds, mental-math answers correct), keyword build and search, store and stats, rating updates.
7. CI: `build-windows.yml` produces `MindGym-Setup-0.1.0.exe`. Auto-publishing to Releases goes live once you confirm Q1.
8. Deliverable: changelog + skipped items.

I can't open a Windows GUI here. I'll run the tests, launch Electron headless under `xvfb` on Linux to smoke-test that windows and views load, and CI builds the Windows installer. **You** do the real click-through on Windows.

---

## Sources

- Wikimedia API rate limits: https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits · API Portal deprecation: https://wikitech.wikimedia.org/wiki/API_Portal/Deprecation · REST changelog: https://www.mediawiki.org/wiki/API:REST_API/Changelog
- WDQS limits: https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual · graph split: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/WDQS_graph_split
- Open Trivia DB: https://opentdb.com/api_config.php · The Trivia API license: https://the-trivia-api.com/license/
- Lichess API tips: https://lichess.org/page/api-tips · puzzle DB: https://database.lichess.org/
- REST Countries versions: https://restcountries.com/docs/api-versions · https://countries.dev/blog/alternative-to-restcountries
- The Met Open Access: https://www.metmuseum.org/hubs/open-access · AIC API docs: http://api.artic.edu/docs/ · AIC IIIF 403 issue: https://github.com/art-institute-of-chicago/api-data/issues/9
- iNaturalist API recommended practices: https://www.inaturalist.org/pages/api+recommended+practices
- NASA APIs: https://api.nasa.gov/ · APOD migration: https://github.com/nasa/apod-api
- Free Dictionary API: https://dictionaryapi.dev/ · Datamuse: https://www.datamuse.com/api/
- YouTube RSS notes: https://www.wprssaggregator.com/youtube-rss-feed/ · YouTube quota: https://developers.google.com/youtube/v3/determine_quota_cost
- Internet Archive API: https://help.archive.org/help/api-information/
- Tatham puzzles: https://www.chiark.greenend.org.uk/~sgtatham/puzzles/ · stockfish.js: https://github.com/nmrugg/stockfish.js/
