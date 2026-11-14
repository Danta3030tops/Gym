# Public version: plan and decisions

A second app built from the couple app, for anyone to sign up. The couple app (repo root) must keep working unchanged.

## Decisions made by the owner

- **One app, two roles.** People sign up as a regular user or a trainer. Trainers see extra tabs.
- **Sign-up:** users choose their own username and password. No profile picker.
- **Friends** (added by username, request must be accepted):
  - leaderboard
  - 1-on-1 chats
  - group chats
  - nudges and challenges, like the current Dantá/Desrica features
- **Trainer is a separate link from friends.** "Add trainer" by username; the trainer accepts.
  - Client can message their trainer (its own chat thread).
  - Trainer gets a Clients tab and an Inbox tab.
  - Trainer can edit a client's routine. **Edits apply right away and the client gets a notification.**
  - Client can remove their trainer at any time; access ends immediately.
- **Build first, monetise later.** No payments yet. (Later idea: trainers pay per client; Stripe isn't directly available in Jamaica, so use a merchant of record such as Lemon Squeezy or Paddle.)

## Proposed, not yet confirmed by the owner

- Trainer can see client progress photos only if the client allows it.
- Username + password with no email: the schema assumes a generated email per username (`username@<some-domain>`), which means no password reset by email. Ask the owner whether to collect a real email for resets.

## Backend

`supabase-public-schema.sql` is a first draft. **It has never been run.** Review and test it in a fresh Supabase project before building on it. It covers:

- `app_profiles` (username, display name, role, colour), created by a trigger on sign-up
- `app_friends`, `app_trainers` (pending/accepted)
- `app_state` (private; trainer can read), `app_routines` (owner and trainer can edit), `app_public` (summary for friends and trainer)
- `app_convs`, `app_members`, `app_messages` (kinds: `dm`, `group`, `coach`) with RPCs `app_open_chat`, `app_new_group`, `app_group_add`, `app_group_rename`
- `app_notes` (notifications: nudges, trainer edits, requests)
- RLS on everything, realtime publication, buckets `app-photos` and `app-chat`

## What has to change in the app code

Roughly 50 places reference the fixed profiles. The main ones:

- `app.js`: `PROFILES`, `PROF`, `selectProfile`, `showPicker`, `clients[prof]`, `KEY = 'gym.v2.' + prof`. Replace with one signed-in user; theme colour comes from the profile row.
- `extras.js`: `other()`, `partnerSummary`, `renderScore`, `renderNudges`, `liveCard`, `sendHype`, partner mode, shared session timer, `GOAL_DEFAULTS`, `ROUTINE_CHG`. Generalise from "the other person" to a friends list.
- `chat.js`: single shared room → conversation list plus threads.
- `coach.js`: challenges and the share card assume two named people.
- Routines: `data.js` / `data-qxeen.js` are hardcoded. New users need onboarding (goal, days per week) that builds a routine from templates or the library. The routine moves out of the state blob into `app_routines` so a trainer can edit it.

## Suggested build order

1. Login / sign-up screen and first-time setup
2. Single-user core working against the new tables
3. Friends: requests, leaderboard, DMs, group chats, nudges
4. Trainer mode: Clients, Inbox, routine edits with client notification
5. Multi-user tests with a mock backend, then a real test project
