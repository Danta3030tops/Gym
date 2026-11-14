# Gym tracker (Dantá & Desrica)

A self-hosted PWA gym tracker for two people. Plain HTML/CSS/JS, no build step, no framework, no package.json.

- **Live:** https://danta3030tops.github.io/Gym/ (capital G matters)
- **Repo:** `Danta3030tops/Gym`, branch `main`, served by GitHub Pages from the repo root
- **Backend:** Supabase project `xszyjrrrqpcciofrrfiu` (URL and publishable key are in `config.js`; the key is meant to be public, Row Level Security protects the data)
- **Current version:** `gym-v19` (see `sw.js`)

## Deploying

Push to `main`. Pages redeploys in about a minute.

**Always bump `VERSION` in `sw.js` when any app file changes**, otherwise phones keep the cached copy. If you add a new file, add it to `SHELL` in `sw.js` too. After a deploy, users close and reopen the app twice (first open downloads, second loads).

Verify a deploy: `curl -s https://danta3030tops.github.io/Gym/sw.js | grep VERSION`

## Profiles

Two fixed profiles, picked on a split screen at launch:

| Key | Person | Accent | Routine file |
|---|---|---|---|
| `king` | Dantá | amber | `data.js` (`DAYS_KING`) |
| `qxeen` | Desrica | violet | `data-qxeen.js` (`DAYS_QXEEN`) |

The keys `king`/`qxeen` are internal only. Show "Dantá" and "Desrica" in the UI.

## Files (load order matters, see the bottom of index.html)

`config.js` → supabase-js (CDN) → `data.js` → `data-qxeen.js` → `figures.js` → `library.js` → `app.js` → `extras.js` → `chat.js` → `coach.js` → `motion.js`

| File | What's in it |
|---|---|
| `index.html` | All markup and all CSS (theme variables, iOS-style glass UI) |
| `data.js` | Movement patterns `P` (stick-figure poses) and Dantá's routine |
| `data-qxeen.js` | Desrica's routine |
| `figures.js` | `S()` pose builder, extra patterns, `window.FIG_NAMES` (exercise name → pattern) |
| `library.js` | Exercise library, `libFind`, `figFor`, fills `PAT_CATS` |
| `app.js` | Core: state, workout screen, set logging, rest timer, rep pacer (with voice), body/photos, More tab, cloud sync, merge, profile picker |
| `extras.js` | Exercise-count picker and remove/add, auto weight suggestions, PRs, plates, streaks, scoreboard, partner mode, fuel, routine editor, swap sheet, live activity, session timer |
| `chat.js` | Chat tab, bubble, photo messages (table `gym_messages`, bucket `chat-photos`) |
| `coach.js` | Muscle map, effort rating, workout summary card, couple challenges, strength trends (e1RM), warm-up player |
| `motion.js` | Nav pill, swipe-to-dismiss sheets, entry stagger |
| `sw.js` | Service worker: cache-first app shell, keyed by `VERSION` |
| `supabase-*.sql` | Database setup scripts (all already run on the live project) |
| `.github/workflows/keepalive.yml` | Pings Supabase every 3 days so the free project doesn't pause |

Later files wrap functions from earlier ones (for example `coach.js` wraps `afterLog`, `renderScore`, `renderPRs`, `excountHtml`, `renderWorkout`). Check for wrappers before changing a function's signature.

## Data model

Local-first. Each profile's whole state is one JSON blob in `localStorage` (`gym.v2.king`, `gym.v2.qxeen`), synced to Supabase when signed in.

```
S = { v, settings, logs, body, photos, fuel, routine, routineU, updated }
S.logs[weekKey][dayIndex][exerciseId] = { n, sets: [{ w, r, t, rir?, w2?, r2? }], u, note }
```

- `weekKey` is the Monday date `YYYY-MM-DD`. `dayIndex` is 0–4 (Mon–Fri).
- `exerciseId` is the slugged exercise name, so history follows the exercise, not the slot.
- Supersets: name contains `" + "`; the second half uses `w2`/`r2`.
- `merge()` in `app.js` resolves sync conflicts per entry using the `u` timestamps. Anything new you store needs a `u` or it won't merge correctly.
- Swaps are keyed `dayIndex-slotKey`, where `slotKey` (`sl.k`) is the slot's index in the full routine, so removing an exercise doesn't shift the others.
- Per-day plan: `settings.exCount` / `exCountDef` (how many) and `settings.exSkip` / `exSkipDef` (which slot keys are removed). `buildDays()` in `extras.js` produces the day's slots. Minimum 4, maximum 10.
- Progress photos live in IndexedDB (`gym-photos`), uploaded to bucket `progress-photos` at `{uid}/...`.

## Supabase

One client per profile (`clients[prof] = { cl, session }`, auth storage key `gym-auth-{prof}`), so both people can be signed in on one phone.

| Table | Purpose |
|---|---|
| `gym_state` | Full state blob per user (private) |
| `gym_public` | Shareable summary for the scoreboard and live activity (realtime) |
| `gym_messages` | Chat (realtime) |

Buckets: `progress-photos`, `chat-photos` (both private).

## Stick figures

SVG figures animate between two poses per pattern: `P[key] = { A, B, props, tempo, ph, cats, lin? }`. Joints interpolate along arcs from planted joints (`rig`/`poseAt` in `app.js`); set `lin: true` for moves where arcs look wrong (horizontal-plane flyes). In `figures.js`, `S()` builds poses from angles (0 = right, 90 = down) with segment lengths torso 32, neck 12, upper arm 16, forearm 16, thigh 24, shin 24.

## Testing

No test framework. `dev/tests/smoke.py` (Playwright) loads the app with seeded data and a mock Supabase. See the docstring in that file. Serve with `python3 -m http.server 8765` from the repo root.

Things that bit before:
- The profile picker needs about 500 ms before it's clickable in tests.
- A variable used before its definition in `renderWorkout` blanks the whole screen; check the console for page errors after every change.

## Conventions

- Keep it dependency-free and build-free. No frameworks, no bundler.
- Compact code style, 2-space indent, template-string rendering, event delegation via `data-*` attributes on `document`.
- Escape user text with `esc()`.
- Don't crowd the UI. New features go behind a chip, a sheet, or an existing tab.
- UI copy is plain and short. Units default to lb, with a kg toggle.
- Design language: iOS-style translucent glass, dark by default, light and auto modes; per-profile accent via CSS variables set in `applyTheme()`.

## Don't

- Don't rename or drop the Supabase tables or change the `S` shape without a migration; both phones hold live data.
- Don't change the routines in `data.js` / `data-qxeen.js` without bumping `ROUTINE_V` and updating `ROUTINE_CHG` in `extras.js` (it clears stale swaps on changed slots).
- Don't disable signups or change Supabase account settings without asking the owner.
