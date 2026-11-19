This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This project

- Product brief: `docs/BRIEF.md`. Build in the phases listed there; stop after each phase with a summary.
- Expo docs (`docs.expo.dev`) and `api.expo.dev` may be unreachable from cloud sessions. Install native modules with `EXPO_OFFLINE=1 npx expo install <pkg>` (uses `bundledNativeModules.json`) and verify APIs against the installed `.d.ts` files.
- Design tokens live in `src/ui/theme/tokens.ts` — never hard-code colors/spacing in components.
- All UI strings go through i18n (`src/lib/i18n/locales/en.ts`).
- The game engine in `src/game` must stay pure TypeScript (no React/Expo imports). Never use `Math.random` (lint enforces it).
- Before finishing: `npm run check` and `EXPO_OFFLINE=1 npx expo export --platform android` must pass.
- **Updates for testers always happen inside the app — never "download the app again" and never uninstall** (owner's rule, 2026-11-19). `.github/workflows/release.yml` delivers every app change on main: same native layer → over-the-air update; native layer or version changed → a new test APK that the app installs itself (`src/features/updates/apkInstaller.ts`). Rules that keep this true:
  - Prefer JavaScript-only changes; anything native (new native module, config plugin, permission, `app.json` android/ios settings) needs a **new app version** in `app.json` + `package.json` (runtime version = app version), or `release.yml` stops.
  - Test APKs are always signed with `credentials/sideload.keystore` and get a higher build number; `android-apk.yml` refuses to publish anything else (`scripts/verify-apk.mjs`). Never change the keystore, the package id, or sign test APKs another way (an EAS-signed APK can't install over them).
  - Never ship an APK through a link to a browser download as the update path; the in-app dialog is the path.
