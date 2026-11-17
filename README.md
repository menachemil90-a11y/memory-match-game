# Memory Match (working title)

A family-friendly memory (pairs) game for iOS and Android where anyone can build
boards from their own photos. Play solo, 2 players on one phone, or 1v1 online.

The full product brief is in [`docs/BRIEF.md`](docs/BRIEF.md).

> **Placeholders:** the app name ("Memory Match"), the package/bundle ID
> (`com.placeholder.memorymatch`) and the URL scheme (`memorymatch://`) are
> temporary and will be replaced before the first store release.

## Status

| Phase                                          | State   |
| ---------------------------------------------- | ------- |
| 0 — Setup, tokens, fonts, navigation skeleton  | ✅ done |
| 1 — Pure engine + no-repeat shuffle + tests    | ✅ done |
| 2 — Play screen, Solo & 2-player, sound/haptic | ✅ done |
| 3 — Built-in boards, board & level pickers     | ✅ done |
| 4 — Custom photo boards, crop flow, editor     | ✅ done |
| 5 — Online 1v1 (Supabase)                      | ✅ built, deploy pending |
| 6 — Polish & release prep                      | –       |

## Tech stack (Expo SDK 58)

| Area           | Library                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Runtime        | `expo` 58, `react-native` 0.88 (New Architecture), `react` 19.3, TypeScript 6                         |
| Navigation     | `expo-router` 58 (file-based routes in `src/app`)                                                     |
| Animation      | `react-native-reanimated` 4.7 + `react-native-worklets`, `react-native-gesture-handler` 3.3           |
| Particles      | `@shopify/react-native-skia` 2.14 (confetti, Phase 2)                                                 |
| Images         | `expo-image`, `expo-image-picker` (system photo picker), `expo-image-manipulator`, `expo-file-system` |
| Local data     | `expo-sqlite` (boards DB + `kv-store` for small persisted state), `zustand` 5                         |
| Randomness     | `expo-crypto` (secure RNG + SHA-256 for layout hashes)                                                |
| Sound / haptic | `expo-audio`, `expo-haptics`                                                                          |
| UI             | `expo-linear-gradient`, `react-native-svg`, `@expo/vector-icons`, `@expo-google-fonts/fredoka` (OFL)  |
| i18n           | `i18next` + `react-i18next`, `expo-localization` (English only for now)                               |
| Online         | `@supabase/supabase-js` (anonymous auth, Postgres + RLS, Realtime)                                    |
| Sharing        | `expo-sharing`, `expo-clipboard`, `expo-linking`                                                      |
| Builds/updates | EAS Build / Submit / Update, `expo-dev-client`, `expo-updates`                                        |
| Quality        | Jest (`jest-expo`), ESLint 9 (`eslint-config-expo`) + Prettier                                        |

Versions of native modules are pinned to what Expo SDK 58 bundles
(`node_modules/expo/bundledNativeModules.json`). Always add native libraries
with `npx expo install <pkg>`.

## Folder structure

```
src/
  app/                  Expo Router routes (thin screens only)
    _layout.tsx         Root: fonts, splash, gesture root, i18n, Stack
    index.tsx           Home
    boards/             Board picker
    levels.tsx          Level picker
    setup.tsx           2-player setup
    game.tsx            Game screen
    results.tsx         Results
    my-boards/          My Boards, board editor ([boardId]), cropper
    online/             Lobby, room ([code] — also the invite deep link target)
    settings/           Settings, credits & licenses
  game/                 Pure TypeScript engine (no React) — Phase 1
  features/
    boards/             Built-in + custom boards, photo pipeline, storage
    online/             Supabase client, realtime room sync
    settings/           Persisted settings store
  ui/
    theme/              Design tokens (colors, spacing, radii, shadows, type, motion)
    components/         AppText, GameButton (3D pill), IconButton, Screen, …
  lib/                  i18n, feedback (haptics/sound), kv storage
assets/                 Icons, splash; later board art, sounds, licenses
supabase/               migrations/ and functions/ (Phase 5)
docs/                   Product brief and design notes
```

## Scripts

```bash
npm start            # dev server for a development build
npm run start:go     # dev server for Expo Go
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # ESLint (no `any`, no Math.random)
npm test             # Jest
npm run check        # all of the above + Prettier check
```

## Running on an Android phone

You need Node.js 22.13+ (or 24 LTS) and git on your computer.

```bash
git clone https://github.com/menachemil90-a11y/memory-match-game.git
cd memory-match-game
git checkout ccr-72648070-fgc68d     # until this branch is merged
npm install
```

**Option A — Expo Go (quickest, works for the current phases)**

1. Install **Expo Go** from Google Play on the phone.
2. Run `npm run start:go` on the computer.
3. Phone and computer on the same Wi-Fi: open Expo Go and scan the QR code.
   Different networks / QR won't connect: run `npx expo start --go --tunnel` instead.

**Option B — Development build (needed once we add custom native config)**

1. Create a free account at expo.dev, then `npx eas-cli@latest login`.
2. `npx eas-cli@latest init` (links the project to your Expo account).
3. `npx eas-cli@latest build --profile development --platform android`
   (builds in the cloud, ~10–20 min on the free tier).
4. Open the link EAS prints on your phone, install the APK
   (allow "install unknown apps" for your browser if asked).
5. Run `npm start` on the computer and open the project from the dev build.
