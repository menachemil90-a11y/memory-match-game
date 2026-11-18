# Releasing Memory Match

There are two ways to ship a change:

| Change                                                                                            | Path                          | Store review? | Reaches players             |
| ------------------------------------------------------------------------------------------------- | ----------------------------- | ------------- | --------------------------- |
| JavaScript / images / sounds / text (most changes)                                                | **EAS Update** (over-the-air) | No            | Next app launch             |
| Native changes: new native library, `app.json` permissions/plugins, Expo SDK upgrade, icon/splash | **EAS Build → store release** | Yes           | After review + store update |

Rule of thumb: if `package.json` gained or upgraded a library with native code,
or you touched `app.json`, it is a native change.

The app uses `runtimeVersion: { policy: "appVersion" }`: an over-the-air update
only reaches builds with the **same `version`** in `app.json`. Bump `version`
for every native release (e.g. `0.1.0` → `0.2.0`) so old builds never receive
JavaScript they can't run.

### In plain words: what reaches phones over the air?

**Over the air (no new APK, no store review — arrives the next time the app is opened):**
anything written in JavaScript/TypeScript and the files it bundles — game rules and
screens, layouts, animations (e.g. how the turn banner fades), texts and translations,
colors and fonts, board pictures, sounds, bug fixes in all of these, and the Supabase
URL/key in `.env`.

**Needs a new APK / store version:** anything native — adding or upgrading a library
with native code, changing `app.json`/`app.config.js` settings that end up in the native
project (permissions, RTL support, icon, splash screen, app name, package id, plugins),
and Expo SDK upgrades. Every such release bumps `version` in `app.json`, so phones with
the old native code never receive JavaScript that needs the new one.

Channels: **`preview`** = test phones (GitHub test APKs and EAS `preview` builds),
**`production`** = Google Play users. An update published to one channel never reaches
the other.

---

## One-time setup

1. **Expo account** (free): sign up at expo.dev.
2. Link the project (once, from any computer **or** let Claude do it with a token):
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init            # writes extra.eas.projectId to app.json
   npx eas-cli@latest update:configure # writes updates.url to app.json
   ```
3. **Access token for GitHub Actions**: expo.dev → Account settings → Access tokens →
   create → copy. In GitHub: repository → Settings → Secrets and variables → Actions →
   **New repository secret** `EXPO_TOKEN`.
4. **Online play**: already configured — the public Supabase URL and anon key are in the
   committed `.env` (see `supabase/README.md`). Never add secret keys there.
5. **Final name & package**: replace the placeholders in `app.json`
   (`name`, `android.package`, `ios.bundleIdentifier`, `scheme`) **before the first store upload** —
   they can't be changed afterwards.

---

## Path A — Over-the-air update (no review)

From the phone: GitHub → Actions → **EAS Update (over-the-air)** → Run workflow →
channel `preview` (testers) or `production` (everyone) → describe the change → Run.

From a computer:

```bash
npx eas-cli@latest update --channel production --message "Fix board picker on tablets"
```

Roll back: expo.dev → project → Updates → pick the previous update → "Republish".

## Path B — Native release (store)

1. Bump `version` in `app.json` (Android `versionCode` / iOS `buildNumber` are
   incremented automatically by EAS: `appVersionSource: remote`, `autoIncrement`).
2. Run GitHub → Actions → **EAS release (store builds)** →
   platform `android`, profile `production`, submit `false` (or `true` once step 4 is set up).
   Or: `npx eas-cli@latest build --platform android --profile production`.
3. The build appears on expo.dev (Android App Bundle `.aab`).
4. **First Google Play upload must be manual**: Play Console → your app → Testing →
   Internal testing → Create release → upload the `.aab`. After that, EAS Submit can
   upload automatically (needs a Google service-account key: Play Console → Setup →
   API access; save the JSON in EAS: `eas credentials`). Submit profiles in `eas.json`
   upload as a **draft** you then review and roll out in the Play Console:
   `--profile production` → Internal testing, `--profile closed-test` → Closed testing (alpha).
5. Promote internal → closed → production in the Play Console.

iOS (later): same workflow with platform `ios`. EAS builds in the cloud (no Mac
needed) but you need an Apple Developer account ($99/year) — ask before enrolling.

## Test builds you can sideload (no Expo account)

Commit with `[apk]` in the message, or run GitHub → Actions → **Android test APK**.
The APK appears under GitHub → Releases (pre-release). It is signed with the
test key in `credentials/` — uninstall it before installing the Play Store version.

## Checklist before every release

- [ ] `npm run check` passes (types, lint, format, unit + server tests)
- [ ] Played Solo, 2 players and (if enabled) Online on a real phone
- [ ] `version` bumped for native releases
- [ ] Supabase migrations applied **before** shipping an app that needs them
- [ ] If the server changed incompatibly: raise `min_supported_version`
      (`update public.app_config set value = '"x.y.z"' where key = 'min_supported_version';`)
