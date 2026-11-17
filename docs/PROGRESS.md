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

1. ~~GitHub Actions blocked~~ — **resolved (session 2):** the owner made the repository **public** (Actions is free for public repos). Consequence: **never commit secrets** (see session log below). The APK workflow is run after the Supabase deployment.
2. **Supabase project for online play** — **created (session 2):** free project `memory-match`, ref `idarczmhhhkazbuewwao`, region `eu-central-1` (Frankfurt, closest to Israel for future Hebrew users). URL + anon key committed in `.env`. Migrations **not applied yet** (see session log). Still to do by the owner afterwards: enable **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
3. **Final app name and package/bundle ID** — placeholders `Memory Match` / `com.placeholder.memorymatch` / scheme `memorymatch`. Must be set before the first store upload (can't change after).
4. **Privacy policy hosting** — fill in publisher name, contact email and date in `docs/PRIVACY_POLICY.md`, host it publicly, set `PRIVACY_POLICY_URL` in `src/lib/appInfo.ts`.
5. **Accounts the owner creates** — Google Play developer account ($25 one-time); free Expo account → access token saved as GitHub secret `EXPO_TOKEN`; then `eas init` + `eas update:configure` (adds `extra.eas.projectId` and `updates.url` to `app.json`).
6. **Store screenshots** — plan in `docs/STORE_LISTING.md`; need the app on a real phone.
7. **Optional:** a domain for https App Links / Universal Links (brief: ask before implementing).
8. **iOS** — not started (needs an Apple Developer account, $99/year — ask first).
9. **Hebrew / RTL** — not started (i18n is ready).

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

- **No APK produced yet** (GitHub Actions blocked — see open item 1).
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
- Next: apply the 4 migrations → verify (tables, grants, RLS, advisors, pg_cron jobs, smoke-test RPCs)
  → owner enables anonymous sign-ins → configure URL + publishable key for the APK build → run the
  "Android test APK" workflow on `main` → share the Releases link.
