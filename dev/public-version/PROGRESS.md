# Public version: build progress

Read `PLAN.md` first. This file is the hand-over between work sessions: update it at the end of every session.

## Rules for every session

- Work in `/Users/versinati/Documents/Gym`, on branch `public-version`. The public app lives in `public/`.
- The couple app (repo root) must keep working unchanged. Do not edit root app files for the public build; `public/` loads `../data.js`, `../data-qxeen.js`, `../figures.js`, `../library.js` read-only for figures and the exercise library.
- Commit locally after each milestone. **Do not push and do not merge to `main`**: the owner wants to see what changed first.
- Never touch the live Supabase project (`xszyjrrrqpcciofrrfiu`) and never run SQL anywhere. The public app needs a new Supabase project that only the owner can create; until then everything is built and tested against `dev/tests/mock-public.js`.
- After every round run both tests from the repo root with a local server on port 8765:
  `python3 dev/tests/smoke.py` (couple app) and `python3 dev/tests/smoke-public.py` (public app).
- **Do the work in the main session; do not spawn subagents** (owner decision, 14 Nov 2026: cheaper on their plan).
- Same conventions as `CLAUDE.md`: no build step, no frameworks, compact style, `esc()` for user text, iOS glass look.

## Decisions (owner, 14 Nov 2026)

- Sign-up collects **username + email + password**. The email is the real one, so password reset by email works.
- Public app lives in **`public/` inside this repo** (served at `https://danta3030tops.github.io/Gym/public/`).
- Build order: sign-in / sign-up, then friends, then the trainer portal.

## Open questions for the owner

- Sign-in is by **email** + password for now. Signing in by username needs a server-side lookup (an edge function), because a public "username to email" lookup would leak everyone's email.
- A new Supabase project is needed before the public app can go live (then: run `supabase-public-schema.sql`, put its URL and publishable key in `public/config.js`).
- Should trainers see client progress photos only when the client allows it? (proposed in PLAN.md, not confirmed)

## Milestones

Status values: `todo`, `in progress`, `done`.

| # | Milestone | Status |
|---|---|---|
| 1 | Sign-in / sign-up screen, first-time setup (role, goal, days), routine built from templates, mock backend + smoke test | done |
| 2 | Single-user core in `public/`: port workout, history, body, fuel, more tabs to one signed-in user on `app_state` / `app_routines` | done |
| 3 | Friends: add by username, accept / decline, friends list | done |
| 4 | Friends features: leaderboard, 1-on-1 chats, group chats, nudges, challenges | todo |
| 5 | Trainer portal: add trainer, Clients tab, Inbox tab, routine edits with client notification, remove trainer | todo |
| 6 | Multi-user tests on the mock, service worker + manifest for `public/`, final review of the schema | todo |

## Session log

(newest first)

### 15 Nov 2026 — milestone 3 done (friends)

- New `public/friends.js` (loaded after `motion.js`) and a sixth tab, **Friends**, between Fuel and More, with a red badge for incoming requests.
- Add by username (sheet; `@` and capitals are tolerated), Sent list with Cancel, Requests with Accept / Decline, friends list, tap a friend for a sheet with "Remove friend" (confirm sheet). Adding someone who already asked you accepts their request. Declining, cancelling and removing all delete the `app_friends` row.
- Data: `FR.rows` (my `app_friends` rows, fetched as two queries: `requester = me` and `addressee = me`) and `FR.profs` (their `app_profiles` rows), cached in `gymp.friends.<uid>`. Refreshes on start, on opening the tab, on coming back to the app, on reconnect, and on a realtime `postgres_changes` subscription to `app_friends` (a no-op in the mock).
- **For later milestones use `friendList()` (profile rows), `friendIds()`, `isFriend(id)`, and the row helpers `frAv(p)` / `frWho(p)` / `frName(p)` / `frColor(p)`.** Another person's `color` must always go through `frColor` (it is validated) before it reaches a style attribute.
- `app.js` calls `startFriends()` / `stopFriends()` from `startApp` / `stopApp` and `renderFriends()` from `renderAll`.
- No `app_notes` row is written for a friend request: the pending row itself is the notification. Revisit when notifications are built (milestones 4 and 5).
- Schema notes for the milestone 6 review: realtime DELETE events on `app_friends` are not filtered by RLS and carry only the id (fine, the client just reloads); the unique pair index is what stops duplicate requests when two people ask at the same moment.
- `smoke-public.py` covers all of it with two accounts signing in and out on one page.

### 15 Nov 2026 — milestone 2 done

- The failing test step was a test bug, not an app bug: `[data-goal]` also matches hidden buttons in the Fuel tab, so the selectors in that part of `smoke-public.py` are now scoped to `#onb`. **When writing tests, scope setup-screen selectors to `#onb`.**
- `smoke-public.py` now also covers the routine editor: reorder, remove, "Rebuild from my setup answers", all checked in `app_routines`, and the routine staying out of the state blob.
- `gym.pacerVoice` renamed to `gymp.pacerVoice` (last couple-app localStorage key in `public/`).
- PORTING.md section 1 now documents the `PROF = 'me'` / `PROFILES.me` shim as intended.
- Checked the Workout and More screenshots by eye: fine.
- Known leftovers, harmless: dead `#picker` / `#pbar` CSS in `public/index.html`.
- Test note: `smoke.py` sometimes times out waiting for `[data-prof="king"]` when the local server resets a connection. The couple app is unchanged; just run it again.

### 14 Nov 2026 (late) — milestone 2 nearly done; stopped at the usage limit

`public/app.js`, `extras.js`, `coach.js`, `motion.js` are adapted (a `PROF = 'me'` / `PROFILES.me` shim in `app.js` keeps most couple-app code unchanged; partner, live, scoreboard, challenges and chat are removed). `smoke-public.py` passes through sign-up, setup, the workout screen, logging a set, sync to `app_state` / `app_public`, all five tabs, reload, sign-out / sign-in, and the coach empty state.

**Pick up here:** the test fails at the step after `A.click('[data-buildplan]')` (coach builds a plan later): `#onb.show` / `[data-goal]` is not visible. Suspects: the `data-buildplan` listener at the bottom of `public/onboard.js`, or `startOnboarding(1)` being undone (the document click handler in `app.js` also runs). Fix, finish the rest of the test, run `smoke.py` too, then review: PORTING.md section 6 says "no PROF/PROFILES" but the shim was kept on purpose, so update that doc; check the More tab and the routine editor by hand in the screenshots; then mark milestone 2 done.

### 14 Nov 2026 — any number of training days; milestone 2 started

- Owner: don't restrict training days. Setup now allows 1 to 7 days (`SPLITS` has entries for every count).
- Owner: no subagents; the main session does everything.
- Milestone 2 groundwork is in: `PORTING.md` is the contract for the port, `public/index.html` has the full app layout and loads `app.js`, `extras.js`, `coach.js`, `motion.js`; `auth.js` calls `startApp()` / `stopApp()`; `onboard.js` handles `data-buildplan`; `smoke-public.py` already expects the full app. The four ported files are being adapted from fresh copies of the root files.

### 14 Nov 2026 — weekends and six-day weeks (owner request)

Training days can now be any 3 to 6 of the seven days: `wd` runs 1 (Mon) to 7 (Sun), and `SPLITS[6]` is push / pull / legs twice.
**For milestone 2:** the couple app hard-codes a Mon–Fri week in several places (`todayIdx`, the day strip, `isWeekday`, streaks that "count weekdays", `DAYS.length` of 5, "x/5 days"). In `public/` all of these must come from the routine's `wd` values instead: today's day is the one whose `wd` matches today, the strip shows the routine's days, and streaks should count the person's own training days.

### 14 Nov 2026 — setup asks more, plan uses the answers (owner request)

First-time setup is now six steps: name + colour, goal, focus areas (up to two), training days (Mon–Fri toggles, 3 to 5) + session length, equipment + experience + units, plan preview.
`buildRoutine({ goal, focus, wds, mins, equip, level })` in `templates.js` uses all of it: session length sets exercises per day (4 / 5 / 6), equipment filters the library by exercise name (`fitsEquip`), focus areas get an extra set or an extra exercise each day, days land on the chosen weekdays. The answers are saved in `ST.settings.plan` so the plan can be rebuilt later (a "Rebuild my plan" option in settings would be a natural addition in milestone 2).
`smoke-public.py` checks every combination of answers produces a valid plan.

### 14 Nov 2026 — milestone 1 done

Built in `public/`:
- `index.html`: the couple app's full stylesheet (copied, so the look matches) plus styles and markup for `#auth` and `#onb`. The app body is only a placeholder `#home` for now.
- `config.js`: `window.GYM_PUBLIC_CONFIG` (empty until the owner creates the Supabase project; the page shows a "Not connected yet" notice).
- `core.js`: `$`, `esc`, `toast`, `themeFor(color, mode)` / `applyTheme(color)` (accent colour per person), local state helpers (`blankState`, `loadLocal`, `saveLocal`; key `gymp.v1.<uid>`).
- `templates.js`: `buildRoutine({ goal, days, level })` builds a 3, 4 or 5 day routine from `LIB`. Each day has `wd` (weekday 1–5).
- `auth.js`: sign in, create account (live username check, role Train / Coach), forgot password, new password after a reset link, `enter()` loads `app_profiles` + `app_routines` into `ME` / `ROUTINE` / `ST`, then first-time setup or `showHome()`.
- `onboard.js`: name + colour, goal, days / experience / units, plan preview, save to `app_profiles`, `app_routines`, `app_state`. Coaches can skip the plan (routine saved as `[]`).
- Tests: `dev/tests/mock-public.js` (generic table mock, no RLS) and `dev/tests/smoke-public.py`.

Pick up at milestone 2. Notes for it:
- The state variable is `ST` here, not `S`: check how `../figures.js` uses the name `S` before porting `app.js`.
- The couple app assumes five days, `dayIndex` 0–4 = Mon–Fri. Public routines have 3–5 days with `wd`; "today" and the day strip must use `wd`, and `S.logs[week][dayIndex]` should keep using the routine's day index.
- The routine lives in `app_routines` (so a trainer can edit it), not in the state blob. Local cache key: `gymp.routine.<uid>`.
- Port by copying `app.js`, `extras.js`, `coach.js`, `motion.js` into `public/` and replacing the two-profile parts listed in PLAN.md. Leave partner-only features (partner mode, shared timer, couple chat) out until milestone 4 turns them into friends features.
- `showHome()` in `auth.js` is a placeholder to replace.
