/**
 * Public links of the game. Change a link here and every button, invite and
 * popup follows (web template URLs are checked against WEB_GAME_URL by a test).
 */

/** The web game (GitHub Pages): invite links open it straight in the room. */
export const WEB_GAME_URL = 'https://menachemil90-a11y.github.io/memory-match-game';

/**
 * Where "Download the app" leads. Today: the newest Android test APK (the APK
 * workflow attaches it as memory-match.apk to the latest release). Switch this
 * to the Play Store listing once the app is published there.
 */
export const APP_DOWNLOAD_URL =
  'https://github.com/menachemil90-a11y/memory-match-game/releases/latest/download/memory-match.apk';

/** Android package id (for "Open in app" from the browser). Must match app.json. */
export const ANDROID_PACKAGE = 'com.placeholder.memorymatch';
