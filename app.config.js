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
module.exports = ({ config }) => {
  const channel = process.env.EXPO_UPDATES_CHANNEL;
  const build = Number(process.env.APK_BUILD_NUMBER);
  const repo = process.env.APK_RELEASES_REPO;

  const next = { ...config, extra: { ...config.extra } };
  if (channel) {
    next.updates = {
      ...config.updates,
      requestHeaders: { ...config.updates?.requestHeaders, 'expo-channel-name': channel },
    };
  }
  if (Number.isInteger(build) && build > 0) {
    next.android = { ...config.android, versionCode: build };
  }
  if (repo) {
    next.extra.apkReleasesRepo = repo;
  }
  return next;
};
