// Dynamic part of the Expo config; all static values live in app.json.
//
// EAS Update channel: builds made by EAS Build get their channel from eas.json.
// Test APKs built by GitHub Actions (prebuild + Gradle) don't go through EAS
// Build, so the APK workflow sets EXPO_UPDATES_CHANNEL=preview and it is baked
// into the app here — then over-the-air updates published to "preview" reach
// those test phones.
//
// Test-APK updates (in-app "new version available"):
// - APK_BUILD_NUMBER (the APK workflow's run number) becomes the Android
//   versionCode, so the app knows which test build it is. It is native, so an
//   over-the-air update can't change it. EAS builds manage versionCode
//   themselves (appVersionSource: remote) and don't set this variable.
// - APK_RELEASES_REPO ("owner/repo", from GitHub Actions) tells the app where
//   the test APKs are published (GitHub Releases). Not committed: it is only
//   known inside the workflows.
// - Test APKs also get REQUEST_INSTALL_PACKAGES: a new test APK is downloaded
//   and installed from inside the app (src/features/updates/apkInstaller.ts).
//   Google Play forbids this permission for apps like ours — store builds
//   (EAS, no APK_BUILD_NUMBER) never get it and are updated by the store.
//
// Web game (GitHub Pages): scripts/build-web.mjs sets WEB_BASE_PATH (the path of
// WEB_GAME_URL in src/lib/links.ts, e.g. "/memory-match-game") so the export
// loads its files from that sub-path. Web exports only; native builds and
// over-the-air updates never set it.
module.exports = ({ config }) => {
  const channel = process.env.EXPO_UPDATES_CHANNEL;
  const build = Number(process.env.APK_BUILD_NUMBER);
  const repo = process.env.APK_RELEASES_REPO;
  const webBasePath = process.env.WEB_BASE_PATH;

  const next = { ...config, extra: { ...config.extra } };
  if (channel) {
    next.updates = {
      ...config.updates,
      requestHeaders: { ...config.updates?.requestHeaders, 'expo-channel-name': channel },
    };
  }
  if (Number.isInteger(build) && build > 0) {
    next.android = {
      ...config.android,
      versionCode: build,
      permissions: [
        ...(config.android?.permissions ?? []),
        'android.permission.REQUEST_INSTALL_PACKAGES',
      ],
    };
  }
  if (repo) {
    next.extra.apkReleasesRepo = repo;
  }
  if (webBasePath) {
    if (!/^\/[a-z0-9-]+$/.test(webBasePath)) throw new Error(`Bad WEB_BASE_PATH: ${webBasePath}`);
    next.experiments = { ...config.experiments, baseUrl: webBasePath };
  }
  return next;
};
