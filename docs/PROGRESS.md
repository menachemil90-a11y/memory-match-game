# Project progress — Memory Match (working title)

_Snapshot at the end of the first build session (all six phases of `docs/BRIEF.md` implemented)._

**Checks at this snapshot:** `npm run check` passes — TypeScript strict, ESLint, Prettier,
**136 Jest tests**, **36 server tests** (Supabase migrations on a real Postgres via PGlite).
`npx expo export --platform android` bundles successfully (~6 MB Hermes bytecode).

> ⚠️ The app has **never been run on a real phone or Android emulator.** All verification was
> unit/integration tests plus a headless-browser (web) render. See "Never tested on a device".

---

## 1. What's done, per phase

### Phase 0 — Setup

- Expo **SDK 58** (latest stable at the time), React Native 0.88 (New Architecture), React 19.3, TypeScript 6 strict (`noUncheckedIndexedAccess`).
- Expo Router with routes in **`src/app/`**; folders by feature: `src/game`, `src/features/*`, `src/ui`, `src/lib`.
- Design tokens (`src/ui/theme/tokens.ts`), Fredoka font, i18next with typed keys (English only, ready for Hebrew/RTL).
- ESLint (no `any`, no `Math.random`, engine purity rule) + Prettier + Jest (`jest-expo`).

### Phase 1 — Engine

- `src/game`: pure TypeScript engine (no React/Expo/Node imports — enforced by ESLint + a test).
- Reducer with `flip` / `resolve` / `timeout`; extra turn on match; matched cards leave gaps (no reflow); input lock while resolving; ties; rematch alternates the starter.
- Crypto RNG (injected byte source, rejection sampling — no modulo bias), Fisher–Yates, random image subset.
- `dealUniqueLayout`: SHA-256 layout hashes per (board, level); exact enumeration for small spaces (≤ 5000 layouts, e.g. the 90-layout Tiny case); on exhaustion the history resets but the last 10 stay forbidden.
- Star rating (3★ ≤ ⌈1.75·pairs⌉ moves, 2★ ≤ ⌈2.5·pairs⌉).
- SQLite layer with migrations + layout-history repository (tested on `node:sqlite`).

### Phase 2 — Play

- Game screen: 3D flip on the UI thread (Reanimated), staggered deal-in, match pop + glow + flight into the collector's pile, mismatch shake, tap-to-skip the mismatch delay, empty slots for collected pairs, reduce-motion support, image preloading before the deal.
- Solo HUD (moves, timer that pauses in background, pairs) → results with stars, "New best!" (SQLite), Skia confetti, fanfare.
- 2 players on one phone: remembered names/avatars/colors (colors can't clash), turn banner, active-player highlight, growing piles, **tabletop mode** (player 2's panel and banner rotated 180°).
- Results: winner/tie with both piles, Play again (new deal, other player starts), Change level/board, Home.
- Sound manager (pooled players, music loop, toggles) and haptics on flip/match/miss/win.

### Phase 3 — Boards

- 8 built-in boards × 24 images: Animals, Fruits, Vehicles, Ocean, Space, Dino World, Yummy Food, Sports — Twemoji (CC-BY 4.0) rendered to PNG, each with its own generated card back.
- Asset pipeline: `scripts/boards.mjs` (definitions) → `npm run assets` → `src/features/boards/builtin/generated.ts`. Custom artwork per board can replace emoji later (`art: 'custom'`).
- Board picker (responsive 2–5 columns, "box" tiles with fanned cards, Create tile) and level picker (locked levels with "Add N more photos to unlock X", best stars per level).
- License texts + attribution table in `assets/licenses/`.

### Phase 4 — Custom photo boards

- Create board: name → system photo picker (multi-select, max 30) or camera → import with progress.
- Pipeline: downscaled source copy ≤ 1600 px (decode-limited, memory-safe), auto centered square crop → 700×700 JPEG (80 %) card + 200 px thumbnail; versioned file names so caches never show a stale crop; relative paths in SQLite (document dir can move on iOS).
- Batch crop queue "Photo 3 of 12" with **Done all**; cropper with pinch-zoom around the fingers, pan, double-tap zoom, rotate 90°, window framed exactly like the final card, live in-game preview.
- Board editor: rename, reorder (move earlier/later), re-crop, cover photo, card back, add/delete photos, unlock hints, play Solo / 2 players, delete board with confirmation.
- Missing files: card regenerated from the source copy when possible, otherwise flagged with a one-tap cleanup. Low-storage guard before importing.

### Phase 5 — Online 1v1 (Supabase)

- Migrations in `supabase/migrations/`: `rooms` (public state, RLS: players read only their own room, no write grants), secret decks in a `private` schema, API functions `create_room`, `join_room`, `flip_card`, `resolve_turn`, `claim_timeout`, `heartbeat`, `claim_disconnect_win`, `leave_room`, `request_rematch`, `server_time`.
- Server-side secure unbiased shuffle with its own no-repeat history; random first player; 30 s turn timer judged by the server clock; 60 s disconnect grace; forfeit on leave; rematch = new deal + other player starts; nickname filter (client + server, identical lists, tested); `min_supported_version`; pg_cron cleanup of stale rooms and (Phase 6) inactive anonymous users.
- `supabase/tests/`: 36 tests on PGlite incl. **randomized parity games proving server rules == TypeScript engine**, RLS/grant checks, deck secrecy.
- App: anonymous auth (session in SQLite kv), typed RPCs, realtime room sync (out-of-order protection), presence, heartbeats, server clock sync; lobby (nickname + avatar, create, join by code / pasted invite), level choice, waiting room with share-sheet invite + `memorymatch://online/CODE` link, coin flip, turn-timer ring, connection indicator, opponent-away dialog, leave/forfeit, results with rematch. Shows "Online play is almost here!" when not configured.

### Phase 6 — Polish & release prep

- Settings (sound, music, vibration, flip-back speed Normal/Kids, reset scores, credits & licenses, privacy summary, version), Credits screen, in-app privacy screen.
- Brand assets generated from one vector logo (`npm run brand`): icon, Android adaptive layers incl. monochrome, splash, favicon, Play icon 512, feature graphic 1024×500.
- Release config: `runtimeVersion: { policy: "appVersion" }`, updates on launch, EAS profiles (development / preview / production with channels).
- GitHub workflows: `ci.yml`, `android-apk.yml` (test APK without an Expo account → GitHub pre-release), `eas-release.yml` and `eas-update.yml` (need `EXPO_TOKEN`).
- Accessibility pass (white-text contrast on the gradient tested ≥ 3:1, labels, 48 dp targets, font scaling capped at 1.4×, reduce motion).
- Docs: `RELEASING.md`, `docs/STORE_LISTING.md`, `docs/DATA_SAFETY.md`, `docs/PRIVACY_POLICY.md`, `supabase/README.md`.

---

## 2. Key decisions and deviations from the brief

| Topic                     | Decision                                                                                 | Why                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Routes folder             | `src/app/` instead of root `app/`                                                        | Current Expo Router default; all code under `src/`                                                             |
| Expo SDK                  | 58                                                                                       | Latest stable at the time                                                                                      |
| Sounds/music              | **Synthesized by our own script** (`scripts/synth-audio.mjs`, CC0) instead of Kenney     | Kenney's site was not reachable; fully owned audio, no license risk                                            |
| Board art                 | Twemoji rendered to PNG at build time (not SVG at runtime)                               | Fast on low-end Android; consistent style                                                                      |
| "Dinosaurs" board         | Named **Dino World**: 2 dinosaurs + reptiles/prehistoric items                           | Twemoji has only 2 dinosaur emoji; brief needs ≥ 18 images                                                     |
| Food board                | Named "Yummy Food"                                                                       | Friendlier                                                                                                     |
| Photo reorder             | "Move earlier / Move later" in the photo menu, not drag-and-drop                         | Reliable and accessible; drag reorder could be added later                                                     |
| Cropper gestures          | Gesture Handler `Gesture.Pan/Pinch` builder API (not the new v3 hooks)                   | v3 hooks did not fire in the web test; builder API is the battle-tested path                                   |
| Online rules              | Mirrored in PL/pgSQL (not shared TS on Edge Functions) + randomized parity tests         | Transactional, low-latency RPCs; parity proven by tests (brief allowed this)                                   |
| Online mismatch delay     | Fixed 1.5 s on the server; the "Kids" speed applies only offline                         | Both phones must agree                                                                                         |
| Online skip               | Only the player who missed can skip the mismatch delay                                   | Fairness                                                                                                       |
| Server no-repeat history  | Global per (board, level), not per player                                                | Brief: "server keeps its own hash history"                                                                     |
| Data minimisation (extra) | Daily deletion of anonymous users inactive for 30 days                                   | Families policy / privacy                                                                                      |
| Test-APK signing          | Fixed **test-only** keystore committed in `credentials/` (debug credentials, not secret) | Each test APK installs over the previous one. Play releases use EAS-managed keys                               |
| APK builds                | GitHub Actions (prebuild + Gradle) instead of EAS                                        | This cloud session can't reach Expo's servers or Google's Android SDK host; user declined widening the network |
| APK trigger               | Commit message containing `[apk]` (or manual run)                                        | The session's git proxy blocks pushing tags                                                                    |
| Server tests              | Node's built-in test runner (`npm run test:server`)                                      | PGlite can't load inside Jest's module sandbox                                                                 |
| Versions/permissions      | Mic + broad media permissions explicitly blocked in `app.json`                           | Families policy                                                                                                |

---

## 3. Still open (needs the owner)

The step-by-step plan to launch is **`docs/RELEASE_PLAN.md`** (dates, who does what).

1. ~~GitHub Actions blocked~~ — resolved: repo is **public** for now (never commit secrets or personal data). The owner wants it **private again before launch** → builds move to EAS first (RELEASE_PLAN §10).
2. ~~Supabase project~~ — **live**: `memory-match` (`idarczmhhhkazbuewwao`, eu-central-1, free plan), migrations 1–4 applied by the owner, anonymous sign-ins **on** — all verified read-only (2026-11-18). Migrations **05** (grant hardening, applied 2026-11-18) and **06** (photo boards online, §12, applied 2026-11-19) are **applied** — verified read-only with the Supabase connector's migration list on 2026-11-19. The web game (§13) is live and needs no migration.
3. **Final app name and package ID** — still placeholders (`Memory Match`, `com.placeholder.memorymatch`, scheme `memorymatch`). Owner gives them before the first upload (target Dec 1); the package can never change.
4. **Privacy policy hosting** — text ready (`docs/PRIVACY_POLICY.md`, placeholders only — the repo is public). Owner hosts it on Google Sites with name/email/date filled in there; then set `PRIVACY_POLICY_URL` in `src/lib/appInfo.ts`.
5. ~~Expo account + token~~ — **done**: owner's free Expo account, token in the GitHub secret `EXPO_TOKEN`; EAS project linked (`extra.eas.projectId` 5b0d0ba0-eb49-40c4-8881-b13daffe2533), over-the-air updates on (channel `preview` for test phones, `production` for Play).
6. **Google Play developer account** — owner registering (personal, ~3 weeks, ≈ Dec 8). Then 14-day closed test with ≥ 12 testers (owner collects 15–20 Gmail addresses).
7. **Photo-board screenshots** — 2 shots from the owner's phone (web can't import photos).
8. **Optional:** tablet screenshots; a domain for https App Links; Hebrew/RTL; iOS ($99/year — ask first).

---

## 4. Never tested on a real device

Verified only by unit tests, mocks and the web preview — **must be checked on an Android phone**:

- Real 3D flip/fly/shake performance at 60 fps on a low-end phone (36 cards)
- Sound playback (expo-audio), music loop, haptics
- Skia confetti (no-op on web)
- System photo picker, camera permission + capture
- Image import, downscaling and crop rendering by `expo-image-manipulator` (tested only with in-memory fakes) and file storage in the document directory
- Pinch-to-zoom in the cropper (only pan + rotate were exercised in the browser)
- SQLite (`expo-sqlite`) and kv-store persistence on device (repositories tested on `node:sqlite`)
- Android back button handling, app backgrounding (timer pause), splash screen, adaptive icon
- **Everything online against a real Supabase project**: anonymous sign-in, RPCs, realtime updates, presence, heartbeats, clock sync, timeouts, rematch, invite share sheet and `memorymatch://` deep link
- The GitHub Actions APK build itself (never ran because Actions is blocked)
- Tablet layouts (only simulated viewport sizes in the browser)

---

## 5. Known issues and limitations

- `updates.url` / `projectId` not in `app.json` yet → over-the-air updates are inactive until `eas init` + `eas update:configure`.
- Online play needs the migrations applied and anonymous sign-ins enabled on the `memory-match` project (the app is configured via `.env`).
- Server nickname test skips non-ASCII names (PGlite uses an ASCII locale); Hebrew nicknames are accepted by the client filter but not verified against a real UTF-8 database.
- Nickname word lists are English-only.
- The opponent-away dialog relies on heartbeats every 10 s; behaviour on flaky mobile networks is untested.
- The low-storage guard uses a heuristic (40 MB margin + 1 MB per photo).
- When a built-in board changes, re-run `node scripts/gen-board-seed.mjs` and ship it as a **new** migration (don't edit applied migrations).
- Web is only a development preview (confetti off, photo import needs native file storage).
- The test-APK keystore is public by design — never use it for Play.
- Expo docs (`docs.expo.dev`) and `api.expo.dev` were unreachable from the cloud session; native APIs were verified against the installed `.d.ts` files.

---

## 6. How to resume

```bash
npm install
npm run check                 # all checks
EXPO_OFFLINE=1 npx expo export --platform android   # bundle sanity check
```

Web smoke test: see `e2e/README.md`. Releasing: `RELEASING.md`. Backend: `supabase/README.md`.
Project rules for agents: `AGENTS.md`. Original brief: `docs/BRIEF.md`.

---

## 7. Session log — device testing & release prep (session 2, 2026-11-17)

- Re-ran all checks on `main` (`eea70c5`): `npm run check` passes — 136 Jest tests, 36 server tests.
- Owner approved creating the free Supabase project and all deploy steps to it. Created **`memory-match`**
  (`idarczmhhhkazbuewwao`, `eu-central-1`, free plan, $0).
- Applying `20261117000001_online_core.sql` through the Supabase connector **timed out twice**: the
  connector shows the owner a confirmation question (the migration contains `revoke`/`delete`
  statements) and nobody answered it within 60 s. Verified afterwards that **nothing was applied**
  (no tables, no migration rows) — the project is clean, so a retry is safe.
- Owner made the repo public. Scanned all tracked files for secrets (service-role keys, JWTs, tokens,
  private keys, passwords): none. Only `credentials/sideload.keystore` is tracked — a deliberately
  public **test-only** key (see `credentials/README.md`); it must never sign a Play release.
- Owner approved again and set the rule: **only the public Supabase URL + anon key may be in the
  repo; check every diff for personal data/secrets before pushing.** Third `apply_migration` attempt
  timed out the same way (connector confirmation never reached the owner). Project still empty.
- Online config is now committed in **`.env`** (public URL + legacy **anon** key; JWT payload verified
  `role: anon`). Removed the `vars.EXPO_PUBLIC_SUPABASE_*` lines from the three workflows: an empty
  Actions variable would have overridden `.env`. Verified that both `expo export` and
  `expo export:embed` (the step Gradle runs for the APK) load `.env` and embed the URL.
- Removed the owner's GitHub username and a stale branch name from the README clone instructions.
  Note: the owner's own "Initial commit" (made on github.com) carries their account e-mail in git
  metadata — rewriting `main`'s history would be needed to remove it; left to the owner.
- `npm run check` passes (136 + 36).
- **First APK run (#9) failed** after 20 s in `npm run check`: `TS2688 Cannot find type definition
file for 'jest'`. Cause: the workflow set `NODE_ENV=production` for the whole job, so `npm ci`
  skipped devDependencies (never seen before because Actions had never run). Fix: `NODE_ENV=production`
  only on the prebuild and Gradle steps. Verified locally that `expo prebuild` succeeds and that the
  release build type signs with the test keystore (`androiddebugkey`). Gradle itself can't run in
  this sandbox (Google's Maven host is blocked), so the CI run is the first real Gradle build.
- **APK run #10 succeeded** (Gradle ~20 min). Pre-release **`apk-0.1.0-build10`** (repo → Releases), file `memory-match-0.1.0-a173f90.apk` (~84 MB, arm64-v8a + armeabi-v7a). Verified by downloading
  it: valid APK with a v2+ signing block containing the test keystore certificate, and the JS bundle
  contains the Supabase project URL. Online play needs no rebuild once the backend is deployed.
- Owner reported migrations 1–4 applied by hand (SQL Editor) — so the connector problem above is moot.

## 8. Session log — store prep (session 3, 2026-11-17)

Owner update: Supabase migrations applied by hand; anonymous sign-ins being enabled; test APK
being installed; Google Play personal account registering (~3 weeks); store upload goal in
about a month. Asked for: bug fixes + new APKs, all store material, `docs/RELEASE_PLAN.md`.

**Supabase — verified read-only** (no writes, nothing re-applied):

- 6 tables with the expected RLS; 8 boards × 24 images (checksum identical to the repo seed);
  6 levels; config values; both pg_cron jobs active; `rooms` in `supabase_realtime`;
  `pgcrypto` + `pg_cron` installed; 0 rooms, 0 anonymous users so far.
- All 27 functions compared by MD5 of their source against the repo migrations loaded into
  PGlite: 23 identical; the other 4 (`start_game`, `create_room`, `join_room`,
  `resolve_turn`) differ **only** because the SQL editor stripped `--` comments inside the
  bodies — identical after stripping comments (verified by checksum).
- Function grants correct: anon can execute nothing; authenticated only the 10 API
  functions; no access to the `private` schema.
- **Finding:** Supabase's default privileges gave `anon`/`authenticated` ALL table privileges
  (INSERT/UPDATE/DELETE/TRUNCATE…) on `public.rooms` and `public.app_config`. RLS (select-only
  policies) still blocked API writes, and PostgREST can't TRUNCATE, so nothing was exposed —
  but it contradicts the design. The PGlite harness now mimics Supabase's default
  privileges; a new test failed until the new migration
  **`20261117000005_harden_table_grants.sql`** (revoke all, re-grant SELECT only; plus an
  index on `rooms.level_id` from the performance advisor). **Not applied — owner pastes it.**
- Advisors: 9× "SECURITY DEFINER executable by authenticated" and 2× "RLS enabled, no policy"
  (private tables) are intended.
- Supabase Free pauses projects with too little weekly DB activity → added
  `.github/workflows/supabase-keepalive.yml` (read-only `app_config` query every 3 days;
  the sandbox can't reach supabase.co, so it was tested on GitHub — see below).

**Bugs found and fixed (via the store-screenshot runs at phone sizes):**

- Home: on short screens (360×640 dp) the "Find the pairs!" tagline hid behind the Solo
  button. Now: compact hero below 720 dp height (smaller logo/title, tighter buttons) and the
  screen scrolls as a fallback. Checked at 360×640, 360×800, 412×915, 800×1280: no overlap.
- Level picker: "Medium" was truncated to "Medi…" on 360 dp phones (the most common Android
  width). The level name now has its own full-width row (+ auto-shrink). Checked: no truncation at 320 and 360 dp.
- Board picker: "Dino World"/"Yummy Food" truncated at 320 dp → auto-shrink
  (`adjustsFontSizeToFit`; native only — **verify on a device**).

**Store material:**

- 6 captioned phone screenshots (1080×1920, 24-bit PNG) in `docs/store/screenshots/`, made
  from real app screens: `e2e/store-screenshots.cjs` (raw capture, fails if a shot is
  missing) + `npm run store:screenshots` (captions in brand style via resvg).
- Feature graphic re-encoded as 24-bit RGB (Play rejects alpha); pixels identical.
  Shared encoder `scripts/lib/png.mjs` (Node zlib, no new dependency).
- `docs/DATA_SAFETY.md`: full IARC questionnaire answers (corrected: online play **does** let
  users interact → "Users Interact"; still PEGI 3/Everyone), permission list as verified
  in the APK. `docs/PRIVACY_POLICY.md`: server location (EU), template note (no personal
  data in the repo). `docs/STORE_LISTING.md`: graphics table, upload order, photo-board shots.
- `eas.json`: production = AAB; submit profiles `production` (internal) and `closed-test`
  (alpha), both as drafts.
- Verified on the build-10 APK: targetSdk **36** (Play requirement for new apps since
  Aug 31, 2026), minSdk 24, all 30 arm64 native libraries **16 KB page-aligned**.
- **`docs/RELEASE_PLAN.md`** written (first-timer guide, timeline, 12-tester rule, tester
  messages in English + Hebrew, personal vs organization, repo-private/EAS plan).

## 9. Session log — device-test bug fixes (session 4, 2026-11-18)

The owner tested build 12 on a phone and reported three bugs plus editing/deleting needs.
Rule for this round: fix root causes, no error boundaries / try-catch / fallbacks that hide bugs.

**Bug 1 — board editor froze (blank purple screen).** Root cause: the selector
`useCustomBoards((s) => s.missing[boardId] ?? [])`. zustand v5 re-renders whenever a selector's
result isn't `Object.is`-equal to the last one; `?? []` created a new array on every call for
any board without missing photos, so every render scheduled another → "Maximum update depth
exceeded". Reproduced first by a new render test of the real editor screen. Fixed at the source:

- Store shape: missing-file state is now a `fileMissing` flag on each photo inside `boards`
  (`CustomBoard`/`CustomPhoto`); the separate `missing` map (which needed defaults) is gone.
  Every selector returns objects stored in the state. `load()` no longer mutates stored objects.
- Audited all selectors (5 stores): the only other risky one was the editor's whole-store
  subscription (replaced by action selectors).
- Guard: ESLint rule (`eslint/store-selectors.js`) fails the build when a selector passed to a
  store hook creates arrays/objects (literals, `?? []`, `map/filter/slice/…`, `new`, `Object.*`);
  tests prove it rejects the original line and allows normal selectors; a registry test fails
  if a new zustand store isn't covered. Plus the editor render test.
- Removed error swallowing on the way: `load().catch(() => undefined)` (now `status: 'failed'` +
  "Try again"), editor `act(…).catch(() => undefined)` (now an error dialog + log),
  `deleteQuietly`/`boardFileExists` try/catch (real I/O errors now surface), level-screen catch
  without the cause (now logged).

**Bug 2 — photo board with < 3 photos was a dead end.**

- New board screen: name + chosen photos (thumbnails, remove ✕); "Create board" only enabled with
  ≥ 3; the store creates board + photos in one step and removes everything if fewer than 3 could
  be imported (`NotEnoughPhotosError`) — a board can't be saved below the minimum.
- Level picker for photo boards: "Edit board" button; a "needs more photos" card with "Add
  photos"; tapping a locked level explains how many photos are missing and offers "Add photos"
  (opens the editor straight in the add dialog).
- Board picker: visible ✏️ edit button on every photo-board tile (long-press kept).

**Bug 3 — Hebrew name shown wrong.** Findings: Fredoka _does_ contain Hebrew (47 glyphs, all
weights); RN 0.88's Android layout sends Hebrew through full bidi (`BoringLayout` treats U+0590+
as non-boring). Two real defects fixed: (1) `expo-localization` defaults to `supportsRTL: true`,
so on a Hebrew-language phone the whole English, LTR-designed UI was mirrored → now
`supportsRTL: false` (generated manifest verified: `android:supportsRtl="false"`); user text still
gets its natural direction. (2) Names inserted into English sentences had no bidi isolation →
custom i18next formatter `{{name, isolate}}` (U+2068/U+2069) on all 14 name placeholders, with a
test that fails on any un-isolated `{{name}}`. The exact reversed-letters frame couldn't be
reproduced off-device — **owner to re-check on build 13** (the RTL setting applies after the app
is closed and reopened once).

**Editing & deleting.** Editor: rename (empty names refused with a message), cover, re-crop, add
photos (crop queue returns to the editor instead of stacking a second editor), delete photo with
confirmation that warns when the board drops below 3, a "needs more photos" card, delete board
(→ My Boards, no screen of the deleted board left). My Boards: ✏️ edit and 🗑 delete on every tile
(shared confirmation dialog). Files: deletes remove source/card/thumbnail/folder; a sweep on every
load removes anything on disk no board/photo refers to (interrupted deletes, half imports, old
crop versions); all store changes wait for loading so the sweep can't race an import.

**Tests.** Screen tests now possible: `@testing-library/react-native` 14 (+ `test-renderer`),
`jest.setup.js` (expo-audio and Skia mocks), Reanimated's Jest resolver, `src/test-utils/renderScreen`.
Shared native fakes (`nativeFakes.ts`: file system with `list()`, image manipulator with
undecodable photos, crypto). New: editor render test; store tests (min photos, half-made board
removal, file deletion, sweep, stable selectors, failed load); **11-step flow test through the
real screens**: create (blocked below 3) → rename/empty name → cover → re-crop → add → delete
below 3 with guidance → locked level → add=1 → edit from picker → delete from My Boards (rows +
files gone) → delete from editor → play a full Tiny game on a photo board. No screen may log an
error. `npm run check`: **176 Jest tests + 37 server tests** pass; Android export passes.

## 10. Session log — EAS, over-the-air updates, turn banner, tap sound (session 4, cont.)

**EAS / Expo.** `.github/workflows/eas-setup.yml` ran `eas init` with the `EXPO_TOKEN` secret
(token never printed) → project `memory-match-game` created and linked; `app.json` now has
`extra.eas.projectId` and `updates.url` (public values; no `owner` field committed).
`app.config.js` bakes `expo-channel-name: preview` into the GitHub-built test APKs
(`EXPO_UPDATES_CHANNEL` env in the APK workflow); EAS builds take the channel from `eas.json`.
`runtimeVersion` = app version (0.1.0), so updates only reach builds with the same native code.
First updates published to `preview` (runtime 0.1.0) via the EAS Update workflow. An EAS cloud
build (android, `preview`, wait) was started to verify the build path (see below for result).
EAS Submit can only be tested once the Play account and app exist.

- **Incident:** the first setup run called `eas whoami`, which printed the account e-mail into
  the (public) Actions log. The run's logs were deleted within minutes (verified: 404). All EAS
  workflows now capture the e-mail without printing it and register it with `::add-mask::`
  before any EAS command; `whoami` is no longer echoed.
- **APK workflow fix:** concurrency moved from workflow level to the build job. A push without
  `[apk]` starts a run whose job is skipped, but at workflow level that run cancelled the build
  in progress (that is what cancelled build 13). Build 12 had failed in Gradle after 53 min
  (logs expired); builds 15+ include all fixes.

**Turn banner stuck in the middle (owner's recording).** Root cause: the fade-out was queued
after `withSpring(1, { damping: 12, stiffness: 200 })` in a `withSequence`. Reanimated 4 marks a
spring finished only when its energy ≤ 6e-9 of the start — for this spring ~1.6 s after it looks
settled — so every banner covered the board for ~2.8 s, i.e. most of each 2-player turn. Fixed
at the source: every step is timed — `popTo()` (Easing.back overshoot, fixed duration) → hold →
450 ms ease-in fade with a slight upward drift, ~1.4 s total (`motion.turnBanner` tokens), still
pointer-transparent. The same bug class made the match "pop" and the pile-counter bump stay
enlarged; both now use `popTo()`. New lint rule (`eslint/animation-rules.js`, tested): a
`withSpring` may only be the last step of a `withSequence`. Tests: banner timing bounds and
that it never intercepts card presses. Applies to local 2-player and online games.

**Menu tap sound removed.** `feedback.tap()` now only does the light selection vibration
(respects the Vibration setting). The `'tap'` sound id, `assets/sounds/tap.wav` and its
generator in `scripts/synth-audio.mjs` are deleted, so it can't be used by mistake (a
`@ts-expect-error` test proves `'tap'` is no longer a valid sound). In-game sounds (deal, flip,
match, miss, turn, win) and the music are unchanged — tested.

**Android builds ran out of memory (builds 12 and 15, and the first EAS cloud build).**
Root cause, confirmed from the EAS log (new `EAS build logs` workflow prints a failed build's
Gradle phase, e-mail masked): "Gradle build daemon disappeared unexpectedly (it may have been
killed)" — on GitHub the same moment shows as "The runner has received a shutdown signal" (build
15 died 6 min into Gradle; GitHub only marked it failed at the 60-min timeout). In both, Metro
bundling, the Kotlin compiler daemon (a second multi-GB JVM) and parallel C++ builds ran at
once on a 4-core / 16 GB machine; EAS also built the emulator-only x86/x86_64 code. Fixed at
the source with one config plugin, `plugins/withAndroidBuildResources.js`, used by every build
(EAS and GitHub): Kotlin compiles inside the Gradle process (no second JVM), Gradle heap 4 GB,
at most 3 parallel workers, phone ABIs only (arm64-v8a + armeabi-v7a). The workflow-only
`GRADLE_OPTS`/`-PreactNativeArchitectures` overrides are gone; the APK workflow logs free memory
every minute. Unit test checks the generated `gradle.properties` values.

**Results after the memory fix (commit 7e561f2):**

- **Test APK build 24 — success, 15 min of Gradle** (was killed before):
  release `apk-0.1.0-build24` (memory-match-0.1.0-7e561f2.apk, 84 MB). Verified: targetSdk 36,
  minSdk 24; 16 KB alignment OK (30 arm64 libraries); only `arm64-v8a` + `armeabi-v7a`; signed
  with the **same test certificate as build 10** (installs over it, boards and photos kept);
  `EXPO_UPDATE_URL` = the project's u.expo.dev URL and request header
  `expo-channel-name: preview`; Supabase URL in the bundle; 6 sound effects + music, no
  `tap.wav`. Contains all photo-board fixes, the turn-banner fade and the vibration-only taps.
- **EAS cloud build (android, `preview`) — success, ~21 min** (`EAS release` workflow with
  `wait=true`; the e-mail mask step ran before any EAS command). EAS created and keeps its own
  Android keystore for this project, so an EAS-built APK is signed differently from the GitHub
  test APKs and **cannot be installed over them** (Android would require uninstalling, which
  deletes local boards). Test phones keep using the GitHub test APKs; store builds will use
  EAS (Play App Signing re-signs them anyway). EAS Submit is still untested (needs the Play
  account). 2 of the 15 free monthly EAS Android builds used.

`npm run check`: **192 Jest tests + 37 server tests** pass; Android export passes.

## 11. Session log — in-app updates (session 4, cont.)

Owner's request: an option to update from inside the app, and a notice for every new update
"like any good app". Agreed choices (asked before starting): an **in-app dialog** (no push
notifications — those would need a Firebase account and a sender), for **both**
over-the-air updates and new test APKs, and **ask first** (no silent updates).

- `app.json`: `updates.checkAutomatically: NEVER` (nothing downloads without consent) and
  **version 0.2.0**. The bump is required: the feature adds a native module
  (`expo-application`, to read the APK's build number), and with
  `runtimeVersion: appVersion` old 0.1.0 builds must not receive JavaScript that needs it.
  Consequence: build 24 (0.1.0) gets no more over-the-air updates — install the next APK.
- `src/features/updates/`:
  - `updatesStore.ts` (zustand): `check({manual})`, hourly `autoCheck()`, `install()`,
    `dismiss()`. Over-the-air first (`Updates.checkForUpdateAsync`); otherwise, in test
    builds only (channel `preview` + build number + releases repo), the newest GitHub
    Release `apk-<version>-build<N>` vs the APK's `versionCode`. "Later" is remembered per
    update until restart (a newer update asks again; a manual check always shows it).
    Failures are logged and shown in Settings, never silently dropped.
  - `apkReleases.ts`: parses the GitHub releases list (drafts / other tags / no `.apk`
    ignored; a non-list response is an error) and validates the repo name.
  - `UpdatePrompt.tsx`: mounted in the root layout; checks at start and when the app comes
    back; the dialog waits during a game (`/game`, online room) and appears afterwards.
  - `UpdatesSection.tsx`: Settings → Updates: "Version 0.2.0 (build N)", the date of the
    running over-the-air update, status line, **Check for updates** / **Show update**.
- `app.config.js` + workflows: the APK workflow sets `APK_BUILD_NUMBER` (run number →
  Android `versionCode`) and `APK_RELEASES_REPO` (`github.repository`, so the repo name is
  not committed); the EAS Update workflow passes the repo too, so the check keeps working
  after an over-the-air update. EAS builds don't get the repo, so they never offer APKs.
- Google Play builds: no self-update (Play policy); Play updates them. Optional later:
  Play "in-app updates" (needs a native library) — to decide before the store launch.
- Tests: release parsing, the store (OTA / APK / up to date / store builds never look for
  APKs / failures / hourly throttle / "Later" / install paths), and the real dialog and
  Settings section (waits during a game, buttons). `npm run check`: **215 Jest + 37 server
  tests** pass; Android export passes; a prebuild with the workflow's variables gives
  `versionCode N`, `versionName 0.2.0`, `CHECK_ON_LAUNCH=NEVER`, channel `preview`.
- **Build 27 failed** in `npm run test:server` (flaky test, unrelated to updates — see below).
- **Build 28 — success** (release `apk-0.2.0-build28`). Verified: `versionCode 28`,
  `versionName 0.2.0`, same test certificate as builds 10/24 (installs over them, boards
  kept), `EXPO_UPDATES_CHECK_ON_LAUNCH=NEVER`, channel `preview`, `apkReleasesRepo` in the
  embedded app config, 16 KB OK, arm64-v8a + armeabi-v7a, no tap sound. It showed one new
  permission from `expo-application` (Play install-referrer service, unused) — now in
  `blockedPermissions` (verified in a prebuild; ships with the next APK).
- Build 24 (0.1.0) can't get 0.2.0 over the air: install build 28 once by hand; from then on
  new APKs and over-the-air updates are offered inside the app.

### Done in a parallel session (included in build 28)

- **Wobbling popups fixed at the root (`4d051b1`).** Reanimated 4 changed the default spring
  to `{ damping: 120, stiffness: 900, mass: 4 }`. Partial spring configs written for the
  Reanimated 3 defaults (`ZoomIn.springify().damping(14)`,
  `withSpring(1, { damping: 7, stiffness: 180 })`, …) kept `mass: 4`, giving a damping ratio
  of ~0.12: on the owner's recording the delete dialog swung between ~120 % and ~55 % of its
  size (period ~0.43 s) for ~1.5 s. New `src/ui/animation/motion.ts` holds complete,
  tested springs (damping ratio ≥ 0.7) and calm timed pop-ins; Dialog, results, online
  results, stars, toggle, coin flip and card deal use them. Lint now rejects layout
  `.springify()` and inline `withSpring` configs (tested), and a test checks the damping
  ratio of every spring.
- **Flaky server parity test fixed (`8c867c3`).** The randomized server-vs-engine game
  sometimes ran past its 600-step limit on the medium board and ended in `resolving`, which
  failed APK build 27. After 400 random steps the game is now played out with valid matching
  moves, still checking server = engine after every step, so it always finishes.

### Board tiles: buttons no longer cover the pictures (owner's screenshot, build 28)

The edit button (and the delete button on My Boards) sat in the tile's top-right corner, on
top of the fanned photos; the "Create board" tile next to it was also ~10 dp shorter (it
guessed the label height). Now the buttons are in a bar under the name (`BoardTile`
`actions`), and `boardTileContentHeight(width, withActions)` gives the Create tile the exact
height of its neighbours. Checked on a web render with a Hebrew-named board (name shown in
full) and one with two buttons. Regression tests: buttons are outside the picture area,
built-in tiles have no bar, Create tile height matches. JavaScript-only → shipped over the
air to `preview` (build 28 gets the "Update available" dialog).

- **Follow-up (owner, after the update reached build 28):** no edit button on the board
  picker at all — photo boards look like every other board there; editing is inside the
  board (level screen → "Edit board"; long-press still opens the editor). The button bar
  stays only on the My Boards management screen (edit + delete). Flow test step 8 now
  checks the picker tile has no buttons and opens the board's levels. Shipped over the air.

## 12. Session log — photo boards in online games (session 5, 2026-11-19)

Owner approved the design exactly as proposed: only the **host** (who has the app) can choose
a photo board; the joining player never uploads; only the small cropped cards go to a
**private** Supabase Storage bucket readable only by the two players of that room; deleted
when the room closes and at the latest after 24 hours; a confirmation window first;
privacy policy + Data Safety updated; Families-friendly (no public links, no sharing outside
the room). Planned next: a **website** (same codebase, Expo web on GitHub Pages at the invite
link) where an invited friend plays in the browser without installing — so the guest side
of photo rooms was built to work there too (signed URLs, no native modules on that path).
The website itself is **not** built yet.

**Server — `supabase/migrations/20261119000006_photo_rooms.sql`:**

- Rooms get status `preparing` (host still uploading; nobody can join), `photo_ids`
  (`p1…pN`, N = pairs of the level) and `card_back`.
- `create_photo_room(level, card_back, name, avatar, version)` → room in `preparing`;
  `photo_room_ready(room)` → checks every card is in Storage, then `waiting`. Soft cap of 20
  photo rooms per player per hour (`too_many_rooms`). Photo rooms need app ≥ **0.3.0**
  (`app_config.photo_rooms_min_version`), so a guest on an old app gets "Please update"
  instead of an empty board.
- Dealing refactored into `private.deal_images(key, images, level)` (same algorithm);
  photo rooms keep their no-repeat history under `room:<id>`, removed with the room.
- Private bucket `room-photos` (JPEG only, ≤ 256 KB). Storage RLS: **insert** only by the
  host, only while `preparing`, only the expected names `<room>/pK.jpg`; **select** (signed
  URLs) only the two players, never for cards older than 24 h, the guest loses access when
  the room closes; **delete** only the host.
- Deletion: `expired_room_photos()` (service role only) lists cards whose room is closed or
  gone, or older than 24 h; pg_cron every 5 minutes calls the Edge Function
  **`room-photos-cleanup`**, which deletes them through the Storage API (SQL deletes would
  leave the files behind). The host's app also deletes them right away when it closes the
  room. `create_room`, `join_room`, `leave_room`, `cleanup_stale_rooms` updated for
  `preparing`.
- Tests: new `supabase/tests/photo-rooms.test.mjs` (20 tests) on PGlite with Storage
  stand-ins in the harness (buckets/objects + RLS, `service_role`): upload rules, who sees
  the cards, 24 h cap, guest losing access on close, old-app guests, deal + rematch history,
  every deletion case, function grants.

**App (version bumped to 0.3.0 — runtime changes, needs the new APK):**

- Board picker in Play Online lists **My photo boards** (no Create tile; hidden on web).
- Level screen: a photo board shows the **consent window** ("Play with your photos?": how
  many cards, who can see them, deleted on close / within 24 h) → upload with progress
  "Sending photo cards… 2 of 6" → waiting room with a 🔒 note. Exactly one card per pair is
  sent, picked at random (crypto RNG), re-encoded at 480 px / JPEG 75 % (no metadata).
  Any failure closes the room and deletes what was uploaded.
- Both players load the cards through **signed URLs** (2 h, re-signed after 45 min on a
  rematch) — the same code a web player will use. Images are prefetched before the deal and
  shown with `cachePolicy: 'memory'` (`BoardImage.ephemeral`), so the friend's photos are
  never written to the device's image cache. Loading screen + "Try again" if they can't load.
- `OnlineRoomGame` picks the board (built-in or photo room) for `OnlineGameView`/results.
- Errors: `photos_missing`, `too_many_rooms`, and `not_available` (server without the
  migration: "Online games with photos aren't available yet").
- In-app privacy text, `docs/PRIVACY_POLICY.md` (new section) and `docs/DATA_SAFETY.md`
  (Photos → Collected **yes**, ephemeral, optional, not shared; IARC note) updated.
- Tests: store (upload order/paths/progress, failure cleanup, signed-URL board, re-sign
  throttle, failed → retry, host-only deletion, forfeit keeps cards), consent screen (Cancel
  sends nothing; confirm creates; built-in boards skip it), room-game loading/retry.

**Deployment status:**

- ✅ Edge Function `room-photos-cleanup` **deployed** to `memory-match` (v1, JWT verification
  off — it only deletes what is already due).
- ✅ **Migration 06 applied** (by the owner, 2026-11-19 12:22 UTC; verified read-only from
  the project's migration list, together with migration 05 from 2026-11-18). Photo games
  online are live on the server. _(Earlier this section said "not applied": the connector's
  database connection was refused that session, so the owner pasted it in the SQL Editor.)_

`npm run check`: **241 Jest + 57 server tests** pass; Android export passes.

- **Test APK build 34 — success** (Gradle 21 min): release `apk-0.3.0-build34`. Version
  0.3.0 → it needs this APK (build 28 gets no over-the-air update for it; its in-app
  "New version available" dialog offers build 34).

## 13. Session log — the web game (session 5, 2026-11-19) — live

Owner's goal: an invited friend taps the link and plays against the host **in the browser** —
no download, no account. Same codebase (Expo web export), same look; only online play works
there, everything else points to the Android app. Live at
**https://menachemil90-a11y.github.io/memory-match-game/**.

**Platform separation (at the source, no try/catch layers):**

- `src/lib/platform/capabilities(.web).ts`: `appFeatures`, `haptics`, `appUpdates`, `webShell`.
- Storage: SQLite on the web needs COOP/COEP headers that GitHub Pages can't send →
  `kvStorage.web.ts` (localStorage; memory for the visit if the browser blocks storage) also
  holds the anonymous Supabase session; `db/index.web.ts` has no database. `build:web` fails if
  SQLite ever reaches the web bundle (verified: no SQLite, expo-updates, expo-application or
  haptics modules in it).
- Web files: custom-board hooks (`useCustomGameBoards.web.ts`, no photo boards), host photo
  upload (`hostPhotoRoom.web.ts`, never uploads), `UpdatePrompt.web.tsx` /
  `UpdatesSection.web.tsx` (the site is always the newest version), `shareInvite.web.ts` (Web
  Share sheet, else copy).
- App-only screens (game, levels, results, setup, my-boards/*) are inside
  `Stack.Protected guard={capabilities.appFeatures}`: not reachable on the web, even by URL.
- Version gate: the web bundle reports the app version (0.3.0), so it passes
  `photo_rooms_min_version`.

**Web shell & UX:** phone-width column centered on desktops (`WebShell.web.tsx`; screens size
from it via `useScreenSize`); "Download the app" bar on every screen (in the layout, never over
the board); big download button on home; "Play more in the app" on online results;
"Available in the app" popup for Solo / 2 Players / My Boards with a real `<a href>` download
link (iPhone: "Android only for now — online play works here", no APK link). Settings on the
web: sound, music, about only. One link config: `src/lib/links.ts` (`WEB_GAME_URL`,
`APP_DOWNLOAD_URL`, `ANDROID_PACKAGE`).

**Invites:** the link is `WEB_GAME_URL/join/?c=CODE` (the same address as the old invite
page, so links already sent keep working) and goes straight into that room's join flow
(`src/app/join.tsx`). New invite text ("…play with me right in your browser — no download
needed: LINK (Room code: CODE)"). On Android browsers a small "Have the app? Open in app"
(intent link, falls back to the web game). Open Graph tags + 1200×630 preview image +
touch icon (`public/`, brand script).

**Build & hosting:** `npm run build:web` (`scripts/build-web.mjs`): export under
`/memory-match-game` (web exports only — native builds and OTA never get a base path), an
`index.html` per fixed route (HTTP 200, so link previews work; `join/` included), `404.html`
for room links opened fresh (GitHub Pages' SPA fallback), and checks. The old `site/` page,
`pages.yml` and `ci.yml` are replaced by **`web.yml`**: check → build → Playwright E2E
(local build + live game server) → deploy Pages (main only) → the same E2E against the live
site.

**Bugs found and fixed on the way:**

- Online results vanished for the player still there when the opponent went back to the
  menu (room closed → "This game has ended"): the results now stay, with "<name> has left the
  game." instead of Rematch (app and web). Found by the two-browser E2E test.
- The host's room screen joined the room again right after the host left it (the auto-join
  for invite links re-ran when the room was cleared → a `join_room` 400 on every "Back to
  menu"/"Cancel"). Auto-join is now decided once, when the screen opens (regression test).
- Clients sometimes asked the server to complete a pair (or claim a turn timeout) a few ms
  before its deadline: the clock-offset estimate can be off by half the sync round trip, so
  the server answered "too_early" (HTTP 400, then a retry). The clock sync now records that
  uncertainty and every deadline call waits until the server's clock has surely passed
  (`msUntilServerPassed`). Found by the E2E console check.
- Nickname field overflowed its card in browsers (CSS `min-width: auto` on a text input in a
  flex row) → `minWidth: 0`.
- Accessibility: the active player was shown by color only → player panels now say
  "playing now" (also what the E2E test reads).

**Tests:** Jest +27 (capabilities, web storage fallback, template/links consistency, popups,
home on web/app/iPhone, join route, share on web, user-agent detection, link buttons, player
panel label, results after the opponent left). Playwright (`e2e/web`, 360×800 and 1280×800):
site tests (download links, every app-only popup, protected URLs, settings, invite links old
and new, link previews, 404 fallback, Android intent, iPhone, desktop column) and, with
`E2E_ONLINE=1`, two-browser online games against the live server: full game from an invite
link + rematch, join by typed code, room link opened fresh + reload mid-game, and a web guest
seeing a host's photo cards (skipped until migration 06 is applied). Every test fails on
console errors.

**APK releases:** now published as the repository's **latest** release with a stable
`memory-match.apk` asset next to the versioned file, so
`https://github.com/menachemil90-a11y/memory-match-game/releases/latest/download/memory-match.apk`
is always the newest test APK (the workflow checks it after publishing).

**Shipped and verified (2026-11-19, `ed26ae8` on main):**

- `web.yml` on main: check → build → E2E (local build, live server) **29 passed, 3 skipped**
  → deployed to GitHub Pages → the same suite **against the live site: 29 passed, 3 skipped**
  (skipped: the photo-room guest test ×2 until migration 06 is applied, and the desktop-only
  layout test in the phone project). Two-browser online games — invite link + rematch, typed
  code, room link opened fresh + reload — passed on 360×800 and desktop, with no console errors.
- **Test APK build 45** (`apk-0.3.0-build45`) is the repository's **latest** release with
  `memory-match.apk` attached (same digest as the versioned file). Verified from the sandbox:
  `…/releases/latest/download/memory-match.apk` downloads the 84 MB APK (arm64 libraries; its
  bundle contains the new invite URL).
- **Over-the-air update** published to `preview` (runtime 0.3.0): build 34 phones get the new
  invite link/text, the results fix and the timing fix after the in-app "Update available".
- Supabase was down 05:45–09:03 UTC on the platform side (the owner restarted the project);
  every online test above ran after the restart.

**Still open (needs the owner):** apply migration
`20261119000006_photo_rooms.sql` (photo boards online). The photo-room web test then runs
automatically on the next push to main (it skips with a note while the function is missing).
No migration change was needed for the web game.

## 14. In-app APK updates (session 5, 2026-11-19)

Owner's report (screenshot): "Download" in the "New version available" dialog opened the
browser and downloaded the APK there — but the update was meant to happen **inside the app**.
Root cause: the APK path of `updatesStore.install()` called `Linking.openURL(downloadUrl)`,
i.e. it handed the file to the browser.

Fix (test APKs only):

- `src/features/updates/apkInstaller.ts`: the app downloads the APK into its own cache
  (`expo-file-system` download task, progress in the dialog: "Downloading… 42%", size checked
  against the release; a complete earlier download is reused), then opens **Android's
  installer** directly (`expo-intent-launcher`, `ACTION_VIEW` on the file's `content://` URI with
  read permission). Downloaded APKs are removed once no newer build is offered.
- `REQUEST_INSTALL_PACKAGES` is added **only to test APKs** (`app.config.js`, keyed on
  `APK_BUILD_NUMBER`); verified by prebuild: the store manifest is unchanged, the test
  manifest differs only by this permission. Google Play builds keep updating through the store.
- The first time, Android itself asks to allow installs from Memory Match (a system security
  screen no app can skip); after that it's Install → done.
- New native module → app version **0.4.0** (runtime 0.4.0), so this code never reaches 0.3.0
  apps over the air. Consequence: phones on 0.3.0 install build 50 (`apk-0.4.0-build50`, verified: permission, installer module, 0.4.0) once more the old way
  (their dialog still opens the browser — that code is in the installed app); every update
  after that happens inside the app.
- Tests: installer (download into cache with progress, reuse, incomplete download rejected,
  installer intent), store (download → installer, failure + retry, cleanup), dialog (label,
  progress).

## 15. Updates always inside the app, never an uninstall (session 5, 2026-11-19)

Owner's rule: from build 50 on, every update happens inside the app — no downloading the
app again, no deleting the old one. (Also in `AGENTS.md`, so every session follows it.)

- **Why an uninstall was ever needed:** builds 34, 45 and 50 are all signed with the same test
  certificate (checked: SHA-256 `14509a67…2bba5`) with growing build numbers, so each installs
  over the previous one. Only the one EAS-cloud-built test APK (different key, §10) can't be
  updated in place — a phone that had it needs one reinstall.
- **Guard:** `android-apk.yml` now refuses to publish an APK that isn't signed with the test
  certificate (`scripts/verify-apk.mjs`, against `credentials/test-signing-cert.sha256`;
  tested on builds 34/45/50 and on a tampered copy) or whose build number isn't higher than
  every published build.
- **Automatic delivery — `.github/workflows/release.yml`** on every app change pushed to main
  (docs/tests/server/web-only changes don't trigger it):
  - compares the native fingerprint (`scripts/native-fingerprint.mjs`, `fingerprint.config.js`;
    stable with or without per-build settings, unchanged by JS edits, changed by native config)
    and the app version with those recorded in the newest APK release
    (`native-fingerprint.json`, attached by `android-apk.yml`);
  - same → over-the-air update on `preview` (`eas-update.yml`, now also callable);
  - new version (or a release without a fingerprint, like build 50) → starts `android-apk.yml`
    → the app offers it and installs it itself;
  - native change without a new version → stops with instructions (over-the-air JavaScript must
    never reach builds without its native code).

## 16. Sound was silent on phones set to silent/vibrate (session 5, 2026-11-19)

Owner: "no sound during the game". Root cause (from `expo-audio`'s own types): `sound.ts`
set `playsInSilentMode: false`, and on Android that **suppresses playback whenever the ringer
is on silent or vibrate** — the owner's phone was on silent (visible in their screenshot).
Fix: `AUDIO_MODE.playsInSilentMode` is `true` on Android (game sounds follow the media volume,
like every Android game) and `false` on iPhone (the mute switch is respected there). In-game
sounds (deal, flip, match, miss, turn, win) are as before; menu buttons stay silent. JavaScript
only → delivered over the air. Test: `src/lib/__tests__/sound.test.ts`.

## 17. Link previews that make people tap, and the invitation screen (session 5, 2026-11-19)

Owner's screenshot: sharing the game's link in WhatsApp showed a bare URL — no picture.

- **New preview images** (`npm run brand` → `public/og-image.png`, `public/og-invite.png`,
  1200×630, ~220 KB each): real game cards (a glowing pair of foxes, card backs, cat and panda),
  the name and a yellow "▶ Play free, no download" / "▶ Tap to play with me" button — all in
  the middle 630×630, so WhatsApp's square thumbnail shows the same thing as the wide card.
- **Preview tags first in `<head>`** (crawlers read only the beginning): `og:*` incl.
  `og:image:secure_url`, `og:locale`, sizes and alt text, plus `twitter:*`.
- **The invite page has its own card**: `scripts/build-web.mjs` writes `join/index.html` with
  "You're invited to play Memory Match! 🃏", "Tap to join my game…" and `og-invite.png`
  (every replacement checked; the build fails if one is missing). The app's invite link is
  `WEB_GAME_URL/join/?c=CODE`, so every invite from the app gets this card.
- **Tested like the crawlers**: `site.spec.ts` fetches the home, online and invite pages as
  WhatsApp, Facebook and Telegram — 200, tags early in the page, the right title/image,
  image reachable, PNG, < 300 KB, really 1200×630 — locally and against the live site after
  every deploy.
- Note: WhatsApp shows the card only if it finished loading before Send, and caches a URL's
  preview — the bare link in the screenshot was sent instantly; every new invite link is a
  new URL.
- **Invitation screen** (owner's choice: the friend picks an avatar and a name, then taps Join):
  "You're invited to a game!", the profile card (saved name/avatar prefilled for returning
  friends), a big "Join the game" button; no red error before trying. Joining happens only on
  that tap; the lobby's Join (name chosen there) still enters directly (`?join=1`). A reload
  mid-game returns the player to their room (`resume`: looks up the player's own room by
  code; never signs a visitor in). Tests: room screen (4), resume (2), E2E updated.
