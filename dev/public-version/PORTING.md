# Porting the couple app into `public/` (milestone 2 contract)

Everyone porting a file follows this, so the pieces fit together. The couple app's files at the repo root are the source; **never edit them**. Write the ported copy into `public/`.

Script order in `public/index.html`:
`config.js` → supabase-js → `../data.js` → `../data-qxeen.js` → `../figures.js` → `../library.js` → `core.js` → `templates.js` → `app.js` → `extras.js` → `coach.js` → `motion.js` → `friends.js` → `chat.js` → `challenges.js` → `trainer.js` → `auth.js` → `onboard.js`

(`friends.js`, `chat.js`, `challenges.js`, `trainer.js` are new code for milestones 3 to 5, not ports. Section 5 below describes what was left out of the port; those features now exist in these files in their many-people form.)

Later files may wrap functions from earlier ones, exactly as in the couple app (`coach.js` wraps `afterLog`, `renderPRs`, `excountHtml`, `renderWorkout`).

## 1. One signed-in person, no profiles

There is no profile picker, `selectProfile`, `other()`, or second person on the phone.

**As built:** `public/app.js` keeps a small shim, `const PROF = 'me'` and `PROFILES.me` (getters that read `ME`, `ROUTINE` and `TH`), so most couple-app code that reads `PROFILES[PROF]` runs unchanged. It is always the signed-in person; never add a second key to it. Friends' data (milestones 3 to 5) must not go through this shim.

Identity comes from globals owned by `core.js` / `auth.js`. **Do not redeclare them** (a second `const`/`let` of the same name is a page-breaking error):

| Global | What it is |
|---|---|
| `sb` | the one Supabase client (`null` if not configured) |
| `session` | current auth session or `null`; user id is `session.user.id` |
| `ME` | profile row `{ id, username, display_name, role ('user' or 'trainer'), color }` |
| `ROUTINE` | the person's routine (array of days), or `[]` / `null` |
| `S` | the state blob (declared with `let` in `auth.js`; assign to it freely) |
| `CFG`, `USER_RE`, `EMAIL_RE`, `AU`, `OB` | used by auth and setup; avoid these names |
| `$`, `esc`, `toast`, `toastT` | helpers from `core.js`: delete the copies in `app.js` |
| `TH`, `applyTheme(color?)`, `resolveMode()`, `lightMQ`, `themeFor`, `themeColor`, `appearance`, `ACCENTS`, `mix`, `luma`, `hexRgb`, `rgbHex` | theme, from `core.js`: delete the copies in `app.js` |
| `blankState()`, `loadLocal(uid)`, `saveLocal(uid, st)`, `stateKey(uid)`, `cacheGet`, `cacheSet`, `initials(name)` | state and cache helpers |
| `GOALS`, `LEVELS`, `WD_NAMES`, `SPLITS`, `DOSE`, `FOCUS`, `EQUIP`, `MINS`, `buildRoutine`, `fitsEquip` | from `templates.js` |

`auth.js` and `onboard.js` load **after** the ported files, so their globals (`sb`, `session`, `ME`, `ROUTINE`, `S`) are in the temporal dead zone while `app.js` / `extras.js` / `coach.js` run their top-level code. Only touch them inside functions that run later (`startApp`, renders, event handlers), never at the top level of a ported file.

Replacements:
- `PROFILES[PROF].name` → `ME.display_name || ME.username`; `.label` → that name + `’s`; `.mono` → `initials(...)`; `.tagline` → drop; `.days` → `ROUTINE`; `.th` / `.thL` → `TH` (already the right one for the mode).
- `KEY` / `'gym.v2.' + prof` → `stateKey(session.user.id)`. `persist()` → `saveLocal(session.user.id, S)`.
- Per-profile localStorage keys (`gym.lastWeekSeen.<prof>`, `gym.pacerVoice`, and so on) → prefix `gymp.` and, where per-person, suffix the user id.
- Appearance (light / dark / auto): `core.js` reads `localStorage['gymp.appearance']` into the global `appearance`. The setting in the More tab sets `appearance`, stores it in that localStorage key and in `S.settings.appearance`, then calls `applyTheme()`. After a sync, if `S.settings.appearance` differs from `appearance`, adopt it the same way.
- Any HTML that shows "Dantá" / "Desrica", king / qxeen colours or `.kq` classes: remove or make single-person.

## 2. State and routine

- `S` has the same shape as the couple app (`settings, logs, body, photos, fuel, updated`) **minus `routine` / `routineU`**.
- The routine lives in `ROUTINE` (table `app_routines`) so a trainer can edit it later. `baseRoutine()` returns `ROUTINE || []`.
- `app.js` provides `async function saveRoutine(routine)`: sets `ROUTINE`, `cacheSet('gymp.routine.' + uid, { routine })`, upserts `app_routines` `{ user_id, routine, updated_by: uid, updated_at, note: '' }` when online and signed in, then `applyRoutine(); renderAll()`. The routine editor and "reset routine" in `extras.js` call it instead of writing `S.routine`. "Reset to original" has no meaning here: offer "Rebuild from my setup answers" using `buildRoutine(S.settings.plan)` when `S.settings.plan` exists, otherwise leave it out.
- Drop `ROUTINE_V` / `ROUTINE_CHG` / `migrateRoutine` (couple-app history).
- Per-day plan settings (`exCount`, `exSkip`, swaps, deloads, targets) stay in `S.settings` unchanged.

## 3. The week is the person's own training days, not Mon–Fri

- A routine has 1 to 7 days. Each day has `wd`: 1 = Monday … 7 = Sunday. `di` (day index, used in `S.logs[week][di]` and swap keys) is the index into the routine, as before.
- `weekKey` is still the Monday date. The date of day `di` in week `wk` is `addDays(parseDk(wk), DAYS[di].wd - 1)`, not `+ di`.
- `app.js` provides:
  - `const wdOf = d => (d.getDay() + 6) % 7 + 1;`
  - `todayIdx()`: index of the day whose `wd` is today, else the next training day later this week, else 0 (the default selected day).
  - `todayExact()`: that index only when today is a training day, else -1 (the "today" highlight and "Today is …" nudges).
  - `isTrainingDay(d)`: some day in `DAYS` has `wd === wdOf(d)`.
- Replace every Mon–Fri assumption: `isWeekday`, `getDay() >= 1 && <= 5`, `getDay() - 1`, "`/5 days`", `'Day ' + (di + 1)` labels, five fixed dots. Use `DAYS.length`, `DAYS[di].wd`, `isTrainingDay`.
- Streaks: the day streak counts consecutive **scheduled training days** that were trained; days that are not training days never break it (but still count if trained). Code that takes a routine as an argument must use that routine's `wd` values.
- Copy that says "weekdays", "Mon–Fri" or "Streaks count weekdays" must be reworded to fit.
- If `DAYS` is empty (a coach with no plan), the Workout tab shows a single card: "No workout plan yet" with a button carrying `data-buildplan` (its click is handled in `onboard.js`), and nothing may throw. `renderWorkout` and anything it calls must handle `DAYS.length === 0`.

## 4. Cloud

- One client: use `sb` and `session`. Delete `clients`, `ensureClient`, `getCfg`, `cleanUrl`, the "Connect / paste URL and key" UI and the sign-in / sign-up form in the More tab (`cfgSave`, `cfgClear`, `auIn`, `auUp`, `auOut`).
- Tables: `gym_state` → `app_state` (`{ user_id, data, updated_at }`); `gym_public` → `app_public` (`{ user_id, data, updated_at }`; there is **no** `profile` column); storage bucket `progress-photos` → `app-photos` (path still `{uid}/...`).
- `sync()` syncs the one signed-in user. `readState` / `writeState(prof, …)` collapse to `S`. `merge(a, b)` stays as is, minus the routine lines.
- IndexedDB photo keys: prefix with the user id instead of the profile key; database name `gymp-photos`. Drop the legacy un-prefixed fallbacks.
- The More tab gets an **Account** card instead: avatar initials, name, `@username`, role, and a "Sign out" button with `id="signOut"` (its click is handled in `auth.js`).
- "Clear data on this phone" clears this user's local state and photos, then signs out.

## 5. Left out until the friends milestone

Remove these cleanly, leaving a one-line `/* friends: milestone 4 */` comment where each was: partner mode and `#pbar`; the second rest timer and the `#rother` chip (keep `RT` as a single timer); `quickSwitch`; `partnerSummary`; `liveCard`; live activity, realtime, `pulse`, `onLive`, `ensureRealtime`; hype and nudge-the-partner; the Scoreboard segment in History; couple challenges; the shared (synced) part of the session timer (keep the local session timer); all of `chat.js`; anything that reads the other person's data. `publishSummary` stays (it writes this person's summary to `app_public`) but must not read other rows yet.

Keep everything that works for one person: logging, rest timer, rep pacer and voice, swaps, per-day exercise count / remove / add, auto progression, PRs, warm-ups, plates, deload, notes, routine editor, streaks, body stats, photos, compare, ghost camera, fuel, exports and import, caffeine (wake lock), muscle map, effort rating, workout summary, strength trends, warm-up player, session timer, reminders, monthly recap (single-person version).

## 6. Entry points (in `app.js`)

- Nothing runs at load except definitions and listeners. No auto profile selection, no initial render.
- `function startApp()`: called by `auth.js` after `ME`, `ROUTINE`, `S` are loaded. Sets `curWeek`, calls `applyTheme(ME.color)`, `applyRoutine()` (when defined), sets `cur = todayIdx()`, shows the app (`document.body.classList.remove('out')`), `showTab('workout')`, then starts a sync.
- `function stopApp()`: called on sign-out. Stops timers (rest, pacer, session), closes sheets, hides the app (`document.body.classList.add('out')`).
- Tabs: `workout`, `history`, `body`, `fuel`, `more`. Header title: the person's first name + `’s` + Split / Log / Body / Fuel / App.
- The header keeps `#htitle`, `#sync`, `#wkpill`. There is no `#switchBtn` and no `#picker`.
- Guard every document-level listener and timer so nothing throws while signed out (`if (!session) return;`).
- The service worker is not registered yet (milestone 6): leave that line out.

## 7. Conventions

Same as `CLAUDE.md`: no frameworks, compact style, 2-space indent, template strings, event delegation on `document` via `data-*`, `esc()` for user text. Keep function names and signatures from the couple app unless this document says otherwise, because the other ported files call them.

## 8. Checking your work

No Node on this machine. Parse-check with:
`<python> dev/tests/syntax.py public/<file>.js`
Do not start a web server and do not run the smoke tests: the lead session runs those after all the ports are in.
