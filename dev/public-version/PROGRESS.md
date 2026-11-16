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
  For now a coach sees **no** client photos at all (the most private choice); adding an opt-in later is a small change.
- The plan said coaches get a **Clients tab and an Inbox tab**. The bar already has six buttons, so coaches get **one extra tab, "Clients"**, with two segments inside it: Clients and Inbox. Say if you want two separate tabs instead.
- A person can have **one coach at a time** in the app (the database would allow several). Say if clients should be able to have more.
- Chats are **text only** so far. Photo messages (as in the couple app) are not built; say if you want them before launch.

## What is left before real people can use it (owner)

The build against the mock backend is finished. Nothing has been pushed or merged: everything is on the local branch `public-version`.

1. Look over the branch (`git log main..public-version`, or open `http://localhost:8765/public/` after `python3 -m http.server 8765`; it shows "Not connected yet" until step 3).
2. Create a **new** Supabase project for the public app (not the couple app's project).
3. Run `dev/public-version/supabase-public-schema.sql` in that project's SQL editor, then put the project URL and publishable key in `public/config.js`. **The SQL has never been run anywhere**, so expect to fix a typo or two the first time; try sign-up, friends, a chat, a coach link and a plan edit with two or three test accounts before inviting anyone.
4. In Supabase: Authentication → URL Configuration, add the app's address (for password-reset links).
5. Merge `public-version` into `main` and push when happy. The couple app's files at the repo root are unchanged.
6. Answer the open questions above when convenient; each has a working default.

Known rough edges:
- (Fixed in `gym-v21`.) The couple app's service worker used to delete Spott's cache whenever its own version changed; it now only deletes caches starting `gym-v`.
- Remember to bump `VERSION` in `public/sw.js` whenever a file in `public/` changes (same rule as the couple app), and add any new file to `SHELL` there (the smoke test fails if a script is missing from it).
- Realtime (live updates without reopening the app) is written but has never run against a real project; the mock has no realtime.

## Milestones

Status values: `todo`, `in progress`, `done`.

| # | Milestone | Status |
|---|---|---|
| 1 | Sign-in / sign-up screen, first-time setup (role, goal, days), routine built from templates, mock backend + smoke test | done |
| 2 | Single-user core in `public/`: port workout, history, body, fuel, more tabs to one signed-in user on `app_state` / `app_routines` | done |
| 3 | Friends: add by username, accept / decline, friends list | done |
| 4 | Friends features: leaderboard, 1-on-1 chats, group chats, nudges, challenges | done |
| 5 | Trainer portal: add trainer, Clients tab, Inbox tab, routine edits with client notification, remove trainer | done |
| 6 | Multi-user tests on the mock, service worker + manifest for `public/`, final review of the schema | done |

## Session log

(newest first)

### 16 Nov 2026 (later) — meal planner added; UI refresh, start-from-scratch and meal planner merged into `main` and pushed (gymp-v4)

- **Fuel tab is now a meal planner** (`public/meals.js`, loaded after `trainer.js`): four macro rings (calories, protein, carbs, fat), a Log food sheet, the meal plan with a tick per food, and an "Also eaten" list. Water, steps and cardio cards are unchanged; the calories and protein quick-add cards are gone. Carbs and fat goals were added to the Goals card.
- **Where the meal plan lives:** in the person's `app_routines` row, as a trailing `{ meals: {...} }` element of the `routine` array (`mealsOf` / `packRoutine` / `cleanMeals` in `core.js`). `cleanRoutine` drops it from the workout days, so it is never mistaken for a day. **No SQL was needed**: the coach's existing right to edit that row covers it. Every write of the routine goes through `packRoutine` (own saves in `app.js` and `onboard.js`, coach saves in `trainer.js` and `meals.js`); a new write path must do the same or it will erase the meal plan.
- **What was eaten** is in `S.fuel[date]`: totals `cal`, `protein`, `carbs`, `fat` plus `log` (up to 40 entries; a ticked plan food carries a key `k`).
- **Coach:** the client view has a Meal plan card (today's macros, targets, the plan) and an editor with daily targets. Targets a coach set apply only while that coach is still linked (`tb` in the plan). The client gets the usual "updated your plan" note.
- **Bug review fixes:** the Coach tab is cleared on sign-out; a coach can start a plan for a client who has none; removing a day also clears that day's exercise-count settings; a coach's meal-plan saves are queued so two quick saves cannot trip the "changed while you were editing" check.
- Both smoke tests pass; `smoke-public.py` covers the meal planner (coach writes a plan, client ticks and logs, own plan and targets, plan survives a workout-plan save).
- **Known:** a phone still on the old cached version (`gymp-v3`) that saves a workout-plan edit will drop the meal plan from the row, until that phone has reopened the app twice. Emoji remain outside the Workout and Fuel screens. Nothing tried on a real phone or with two real accounts yet.
- **Still open (owner):** Gmail SMTP sender and Spott wording in the email templates.

### 16 Nov 2026 — UI refresh and start-from-scratch on branch `spott-ui` (gymp-v4) (merged later the same day, see above)

Owner picked a look from mockups (`dev/public-version/mockups/`, `refined-v4.html` is the last one). Built on branch `spott-ui`:

- **Tabs:** Workout, History, Friends, and Coach (Clients for coaches). Body, Fuel, Session timer, Edit plan and Settings are in a header menu (`#menuBtn` / `#hmenu` in `index.html`, opened by a small listener above `showTab` in `app.js`). The week range moved into that menu.
- **Coach tab** (`renderCoachTab` in `trainer.js`): the "Your coach" card moved here from Friends → People for everyone who is not a coach; coaches keep it in People.
- **Workout:** exercise options (Pace, Swap, Progress, Warm-up sets, Plates) sit behind a ··· button on each card. The Exercises-today counter and the warm-up row fold into one slim row once the first set of the day is logged (`excountHtml` wrapper in `coach.js`, `EXC_OPEN`); tapping it opens it again.
- **Start from scratch:** setup has a new step ("Build me a plan" / "Start from scratch"). Scratch asks only for training days and units, then saves days with no exercises and `settings.plan = null`. An empty day shows "Nothing planned yet" with Add exercise.
- **Plan editor:** add a day (＋ in the day row), move a day to another weekday, remove a day, empty days allowed, and it works when there is no plan at all. Day indexes never shift (logs are keyed by them): a new day is appended and days are *shown* in weekday order (`dayOrder` in `app.js`); a day can only be removed while nothing is logged on it or on a later day.
- `exCountFor` no longer pads a short day up to four exercises unless the person set a count themselves.
- Leaderboard filter is a dropdown (`#lbSel`). Background is a vertical wash of the person's colour. Workout-screen emoji removed.
- Tests: `smoke-public.py` updated for the new navigation and extended (start from scratch, day editing, folding card, menu). Both smoke tests pass.
- **Not done:** emoji remain in Friends, Coach, notes, History and Settings; Friends and History keep their old layouts (only the tab bar, menu and background changed there); a coach cannot yet remove a client's day unless it is the last one and empty; nothing tried on a real phone or the real database.
- **Pick up here:** owner to look at the screenshots, then merge `spott-ui` into `main` and push (their OK needed).

### 15 Nov 2026 (later) — couple app no longer wipes Spott's offline cache (gym-v21)

- Root `sw.js`: on activate it only deletes caches starting `gym-v` (it used to delete every cache but its own, including `gymp-*`). Owner approved touching the root file for this. `VERSION` is `gym-v21`.
- Both smoke tests pass. Checked in a real browser with service workers on: after the new worker activates, `gym-v20` is gone and `gymp-v3` is kept.
- Playwright's Python package was not installed on this Mac any more (the browser was); tests ran from a throwaway venv.
- **Still open:** Gmail SMTP sender and Spott wording in the email templates (owner); first try with two real accounts.

### 15 Nov 2026 (late) — the public app is now "Spott"; merged into `main` and pushed

- Owner chose the name **Spott** and logo **A** (bar with a spot above it; drafts and `make.py` in `dev/public-version/logo/`).
- User-facing name changed in `public/` (title, home-screen name, sign-in wordmark, More footer, export file names, share-card watermark). Internal names are unchanged on purpose (`gymp-*` keys and caches, `app_*` tables, the `/Gym/public/` address).
- The public app has its own icons now (`public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `maskable-512.png`, `icon.svg`); the couple app keeps the ones in the repo root. `public/sw.js` is `gymp-v3`.
- Both smoke tests pass.
- **Pick up here:** owner still to do: Gmail SMTP sender (sender name "Spott"), and reword the Supabase email templates to say Spott.

### 15 Nov 2026 (night) — `public-next` merged into `main` (gymp-v2)

- Owner ran `supabase-public-update-1.sql` in Gym Public and deployed edge function `login` (Verify JWT off). Checked from outside: `app_photos_ask` / `app_photos_answer` exist and refuse signed-out callers; `login` answers "Invalid login credentials" for an unknown user and passes the CORS preflight. (A first deploy under Supabase's auto-generated name was replaced by one named `login`; the stray one can be deleted.)
- Merged `public-next` into `main`.
- **Still open:** Gmail SMTP sender (owner). Username sign-in and a photo request have not been tried with two real accounts yet.

### 15 Nov 2026 (evening) — `public-next` verified against the mock; still NOT live, waiting on the owner

Automated session. Steps 1 to 3 of the afternoon entry's list are done; step 4 (owner only) is still open.

- **Step 1:** `dev/tests/smoke-public.py` (the `until(...)` rewrite) was already complete. It passed as found; the three-account failure noted below did not come back.
- **Step 2, new test steps:**
  - Username sign-in: bad input ("a b"), `test_user` + wrong password, an unknown username (same "Wrong email or password" answer), the friendly "Use your email instead" message while the `login` function is missing (`window.__mockNoLogin` in the mock), then `Test_User` + the right password signs in and survives a reload.
  - Coach photo requests: photos card is "Private" with an Ask button → coach asks (row `photos = asked`, one `photos` note, no second Ask) → client sees the note and the Allow / Not now buttons → Not now → coach can ask again → client allows (survives a reload, "Stop sharing" offered) → coach's client view shows the Progress photos card with no Ask button → with photo entries put into the client's state, only the file in the client's own folder is listed (another folder and a deleted slot are not) → client stops sharing → coach is back to "Private" + Ask.
  - Mock: the `login` function lowercases and trims the login like `edge-login/index.ts` does, and can be switched off with `window.__mockNoLogin`.
- **No app code had to change.** Only `dev/tests/smoke-public.py` and `dev/tests/mock-public.js` were edited.
- **Results:** `smoke-public.py` passed 6 times in a row with the new steps (about 115 s each); `smoke.py` passed; `syntax.py` OK for every `public/*.js` and the mock.
- **Not covered by any test** (the mock cannot): the real `login` edge function, the SQL in `supabase-public-update-1.sql` (rpcs, storage policy letting a coach download a client's photos), and real photo downloads in the coach view (the mock's storage returns nothing, so the test checks which photos are listed, not that they load).

**Pick up here:** nothing left for a coding session until the owner has done step 4 of the entry below (run `supabase-public-update-1.sql` in the Gym Public SQL editor; create edge function `login` from `edge-login/index.ts` with "Verify JWT" off; set up Gmail SMTP). After that: try username sign-in and a photo request with two real accounts, then merge `public-next` into `main` and push (owner's OK needed).

### 15 Nov 2026 (afternoon) — review fixes + two features coded on branch `public-next`; NOT verified, NOT live

The public app is live from `main` (merged 15 Nov). Work since then is on **`public-next`** and must not be pushed or merged without the owner's OK.

Done on `public-next` (all parse; see `git diff main`):
- Review fixes: `safeN` / `cleanRoutine` in `core.js` applied where other people's data enters (auth.js, app.js sync, trainer.js, friends.js `lbStats`, challenges.js `clWeeks` / `clType`); esc() on day names and reps; sync early-returns; session timer cleared on sign-out; `public/sw.js` is `gymp-v2`.
- Coach plan save checks `updated_at` first (trainer.js `trSaveRoutine`).
- Sign in with username or email: `auth.js` `signInByUsername` calls edge function `login` (`dev/public-version/edge-login/index.ts`, **not deployed yet**); the mock has `functions.invoke('login')` and `auth.setSession`.
- Coach photo requests: `trainer.js` (`trPhotosAsk`, `trPhotosAnswer`, `clientPhotosHtml`, `trHydratePhotos`), note kind `photos` in friends.js, mock rpcs.
- `dev/public-version/supabase-public-update-1.sql` (**not run yet**): helper functions only answer about the caller, length limits, chat lock, `app_trainers.photos` + rpcs + storage policy.

**Pick up here:**
1. `dev/tests/smoke-public.py` was being rewritten by another session to use `until(...)` waits instead of sleeps. Check it is complete and passes 5 times in a row; if it is half-done, finish it. My last run failed at the three-account section (`openF(); add('coach.kay'); until(lambda: len(fr()) == 2)`), probably mid-edit.
2. Add test steps: sign in by username (`test_user` + password, and a wrong password); coach asks for photos → client sees the note and the Allow button → allows → coach's client view shows the Progress photos card without the Ask button → client stops sharing.
3. Run `smoke.py` too. Commit on `public-next`. Do not push.
4. Then the owner has to: paste `supabase-public-update-1.sql` in the Gym Public SQL editor; create edge function `login` from `edge-login/index.ts` with "Verify JWT" off; set up Gmail SMTP (Authentication → Emails → SMTP Settings) with their own app password. Only after the SQL update is run should `public-next` be merged and pushed (the photo code calls rpcs that do not exist until then; username sign-in shows a friendly "use your email" message until the function exists).

### 15 Nov 2026 — real Supabase project set up

- New project **Gym Public** (ref `uxxdikfpazjgdipadblt`, org "Gym App", free plan). The couple app's project was not touched.
- `supabase-public-schema.sql` ran there for the first time: "Success. No rows returned", no edits needed.
- Auth → URL Configuration → Site URL set to `https://danta3030tops.github.io/Gym/public/`.
- `public/config.js` now holds the project URL and publishable key.
- Checked from a local copy of the app, without the mock: the sign-in screen loads connected, the live username check answers, and a signed-out visitor reads no profiles.
- **Not done yet:** no real account has been created, so sign-up, the profile trigger, friends, chats, coach links and realtime are still untested against the real database. "Confirm email" is at Supabase's default (on), and the free plan's built-in mailer only sends a few emails an hour.

### 15 Nov 2026 — milestone 6 done; the build is finished

- **Offline:** `public/sw.js` (cache `gymp-v1`, same stale-while-revalidate approach as the couple app, only ever deletes caches starting `gymp-`) and `public/manifest.webmanifest`; registered at the end of `public/index.html`. The smoke test checks that every script the page loads is in `SHELL`, that the files exist, and that the app opens with the network off.
- **Schema review** of `supabase-public-schema.sql` (file edited, **not run**):
  - New "which columns may be updated" section. Without it, row level security alone let the person accepting a request rewrite who it was from: a coach could have made anyone their "client" and read their data, a friend request could be re-pointed at a stranger, a chat member could move their membership into any conversation, and anyone could change their own role or username. Updates are now limited to `status` (friends, trainers), `last_read` (members), `read` (notes), `display_name` / `color` / `bio` (profiles).
  - `app_can_post`: 1-on-1 and coach chats can only be written to while the two people are still linked.
  - `nt_send`: notes only between linked people (it used to let strangers send request-type notes with any text).
  - `rt_upd`: a routine row can no longer be re-assigned to another person.
  - `app_members` added to the realtime publication.
  - The "coach can read client progress photos" storage policy is commented out until the owner decides (open question).
- **Three-account tests:** a third person signs up; three-person leaderboard; group "add a friend"; a group member who is not friends with everyone still sees names; "isn't signed up as a coach".
- PORTING.md and CLAUDE.md updated with the public app's file list.

### 15 Nov 2026 — milestone 5 done (trainer portal)

- New `public/trainer.js` (loaded last of the feature files, before `auth.js`).
- **Client side:** a "Your coach" card in Friends → People. Add a coach by username (must have signed up as a coach), cancel the request, message them, remove them (confirm sheet). Removing deletes the `app_trainers` row, so access ends at once.
- **Coach side** (`ME.role === 'trainer'`): a seventh nav button, **Clients** (hidden for everyone else), with segments **Clients** and **Inbox**. Requests with Accept / Decline (badge on the tab), client list with "trained today / last trained", and a client page: this week / streak / PRs, their plan, their last six sessions (read from their `app_state`), Message, Edit their plan, Remove client.
- **Editing a client's plan** reuses the routine editor in `extras.js`: `ED_FOR = { id, name, routine, noted }` points it at the client (`edBase()` instead of `baseRoutine()`, `mutRoutine` calls `trSaveRoutine()`). Each change upserts the client's `app_routines` row with `updated_by = coach`; the first change of an editing session inserts one `app_notes` row (`kind: 'routine'`). `ED_FOR` is reset to `null` when the coach opens their own editor and on sign-out.
- **On the client:** a fresh `routine` note triggers `sync()`, which already pulls a changed `app_routines` row. When the row was written by someone else, `sync()` clears `settings.swaps`, `exSkip`, `exSkipDef`, because those are keyed by slot position and a coach may have moved slots. The coach accepting sends a `trainer_ok` note.
- **Chats:** a coach / client pair gets a `coach` conversation from `app_open_chat` (mock updated). For the coach these are the Inbox (`chInbox()`); for the client they sit in Friends → Chats marked "· Coach" (`chFriendsSide()`). A thread opened from the Clients tab returns there on Back (`CH.back`). Coach chats disappear when the link is removed.
- `smoke-public.py` covers the whole flow (request, cancel, accept, client page, plan edit landing in the client row with one notification, coach chat and Inbox, the client receiving the plan, removing the coach).

**Next: milestone 6.** To do:
1. Multi-user tests on the mock: at least a third account, to cover "add a friend to a group" and the leaderboard with three people; a non-coach username in "Add your coach" ("isn't signed up as a coach").
2. Service worker + manifest for `public/` (copy the approach in root `sw.js`; cache the `../` files it loads too; own `VERSION`; register it at the end of `public/index.html`; keep `service_workers='block'` in the tests).
3. Final review of `dev/public-version/supabase-public-schema.sql` against what the app now does. Collected notes: add `app_members` to the realtime publication; `ms_send` should also require the pair to still be linked for `dm` / `coach` chats; `nt_send` allows any `kind` between linked people (fine, the app uses `nudge`, `hype`, `challenge`, `routine`, `trainer_ok`); check `rt_ins` / `rt_upd` let a coach upsert a client's row; check a coach can read `app_public` for clients (`pb_read` uses `app_linked`); `app_friends` / `app_trainers` realtime DELETE events are not filtered by RLS (ids only). **Edit the file, never run it.**

### 15 Nov 2026 — milestone 4 done (challenges were the last part)

- New `public/challenges.js` (loaded after `chat.js`): one weekly challenge per friend, shown as cards under the leaderboard. Types: Most days, Most sets, PR race, Team goal (both train N days), plus optional stakes. Either person can edit or end it. Last week's result and an all-time tally show on the card; a win pops the celebration once.
- **No new table.** The challenge lives in my own settings (`S.settings.challenges[friendId]`, tally in `S.settings.clTally`), so it syncs with `app_state`. The friend is told with an `app_notes` row (`kind: 'challenge'`, the challenge object in `data`); `clAdopt` (called from `loadNotes`) keeps whichever copy has the newer `u`. Incoming objects are rebuilt field by field (`clClean`). Scores come from the `app_public` summaries the leaderboard already loads (`clWeeks` handles a summary that is up to a week old).
- Setting, changing or ending a challenge needs a connection (the friend has to be told).
- Screenshots `dev/tests/last-run-public-8…16-*.png` show the friends screens (ignored by git; run the test to regenerate).

**Next: milestone 5 (trainer portal).** Notes for it:
- Table `app_trainers` `{ client, trainer, status }`; the insert policy needs the trainer's profile to have `role = 'trainer'`. Mirror `friends.js`: "Add trainer" by username on the client side (More tab or the People segment), request accepted by the trainer.
- Trainers get two more tabs (Clients, Inbox). The nav already has six buttons, so consider putting Clients and Inbox as segments inside one "Coach" tab, shown only when `ME.role === 'trainer'`.
- A trainer can read a client's `app_state` and read / write their `app_routines` (see the `st_read`, `rt_*` policies). The routine editor in `extras.js` (`editRoutine`, `mutRoutine`, `saveRoutine`) works on the signed-in person's `ROUTINE`; the trainer version must write the client's row with `updated_by = trainer` and a `note`, then insert an `app_notes` row for the client (add the kind to `NOTE_TEXT` in `friends.js`). The client app should reload `ROUTINE` when that note or a realtime `app_routines` change arrives (watch `routineDirty`: local unsynced edits currently win).
- Chats: `app_open_chat` returns a `coach` conversation for a trainer / client pair; `chVisible` in `chat.js` hides `coach` chats today, and the mock's `app_open_chat` only knows friends. The Inbox is the trainer's list of `coach` chats.
- Removing a trainer deletes the `app_trainers` row (either side can).

### 15 Nov 2026 — milestone 4, part 2: chats (WIP)

Done, in the new `public/chat.js` (loaded after `friends.js`):
- Friends tab segments are now **Leaderboard · Chats · People**. Unread chats count towards the tab badge.
- Conversation list (`loadChats`, `chatsHtml`): my `app_members` rows, their `app_convs`, all members, and profiles of group members who are not my friends (`CH.profs`). Unread = `app_convs.last_at` is later than my `app_members.last_read`.
- A conversation takes over the Friends tab while open (`CH.open`, `renderThread`, back button). Send (button or Enter), failed sends can be retried by tapping, delete my own message, day separators, sender names in groups.
- 1-on-1: "New chat", or "💬 Message" in a friend's sheet, both through rpc `app_open_chat` (reuses the existing conversation). Groups: "New group" through `app_new_group`; group details sheet with rename (`app_group_rename`), add a friend (`app_group_add`), leave (deletes my `app_members` row).
- Realtime: `app_messages` INSERT and `app_convs` UPDATE. The mock has no realtime, so the tests see new messages by signing in again.
- `mock-public.js` has the four chat rpcs (same rules as the SQL functions) and does what the `app_msg_bump` trigger does.
- Test default `GYM_TEST_SLOW` is now 3 (about 160 s): this Mac is often busy and shorter pauses failed at random. **If `smoke-public.py` fails on an odd step, run it again before debugging.**

Not built (decide later): photo messages (bucket `app-chat`); "add a friend to a group" is not covered by the test (needs a third account, do it in milestone 6).

Schema notes for the milestone 6 review:
- `app_members` is not in the realtime publication, so being added to a group only shows up on the next refresh or when the first message arrives. Add it.
- A 1-on-1 chat stays writable after the friendship ends (`ms_send` only checks membership). The app hides such chats (`chVisible`), but the policy should also require `app_linked`, or `app_friends` deletion should remove the membership.
- 'coach' conversations are hidden by `chVisible` until milestone 5 shows them.

**Still to do for milestone 4:** challenges. The couple app's version is in root `coach.js` (search "challenge"); `summaryOf` already publishes `ch: settings.challenge`. Make it "challenge a friend".

### 15 Nov 2026 — milestone 4, part 1: leaderboard, nudges, notifications (WIP)

Done, in `public/friends.js`:
- The Friends tab has two segments, **Leaderboard** and **People** (`FR.seg`; opens on the leaderboard when you have friends).
- **Leaderboard** (`boardHtml`, `loadBoard`, `LB`): me (from `summaryOf(S, PROF)`) against friends' `app_public` rows, ranked by This week / This month / Streak / PRs. `lbStats(summary)` reads a stored summary against today's week and month, because a friend's summary is only as fresh as their last sync.
- **Nudges**: the 👊 / 🔥 button on a leaderboard row inserts an `app_notes` row (`kind` `nudge`, or `hype` if they trained today). One per friend per 30 minutes (kept on the phone in `gymp.nudged.<uid>`).
- **Notifications** (`NT`, `loadNotes`, `clearNotes`, `noteText`): unread `app_notes` rows show in a "New for you" card at the top of the Friends tab, count towards the tab badge, and toast once when they first arrive (`gymp.noteMax.<uid>` remembers the newest id already announced). "Clear" marks them read. **Milestone 5 should add its kinds (trainer request, routine edited) to `NOTE_TEXT`**; a note with an unknown kind shows its `body`.
- Realtime subscriptions for `app_notes` and `app_public` are on the same channel as `app_friends`.
- Tests: `smoke-public.py` covers the board order, the metric chips, hype vs nudge, the rate limit, the badge, clearing. The test's pauses are now multiplied by `GYM_TEST_SLOW` (default 2, about 110 s a run) and reloads wait for the app to settle, because the fixed pauses failed at random when the Mac was busy.

**Still to do for milestone 4, in this order:**
1. Chats: new `public/chat.js`, a third segment "Chats" in the Friends tab. Conversation list from `app_members` + `app_convs`, thread view from `app_messages`, 1-on-1 via rpc `app_open_chat(other)`, groups via `app_new_group(title, people)`, `app_group_add`, `app_group_rename`, leave a group (delete own `app_members` row), unread counts from `app_members.last_read`. The mock needs those rpcs and the `app_bump_conv` trigger behaviour (update `last_at` / `last_text`, and the sender's `last_read`). Photo messages can wait (bucket `app-chat`).
2. Challenges: the couple app's version is in root `coach.js` (search "challenge"); `summaryOf` already publishes `ch: settings.challenge`. Make it "challenge a friend".

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
