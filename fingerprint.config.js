// What counts as a change of the app's NATIVE layer (Expo fingerprint), used by
// scripts/native-fingerprint.mjs to decide how an update reaches testers
// (.github/workflows/release.yml): same native layer → over-the-air update;
// different → a new test APK, installed from inside the app.
//
// Skipped: things that never change the installed app's native code — build
// numbers (set per build), `extra` (set per build by app.config.js), package.json
// scripts, .gitignore, eas.json/.easignore. The app version is checked
// separately (it is the update runtime version).
const { SourceSkips } = require('@expo/fingerprint');

/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips:
    SourceSkips.ExpoConfigVersions |
    SourceSkips.ExpoConfigExtraSection |
    SourceSkips.PackageJsonScriptsAll |
    SourceSkips.GitIgnore |
    SourceSkips.EasJson |
    SourceSkips.Easignore,
};
