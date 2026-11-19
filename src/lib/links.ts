/**
 * Public links of the game. Change a link here and every button, invite and
 * popup follows (web template URLs are checked against WEB_GAME_URL by a test).
 */

/** The web game (Cloudflare Pages): invite links open it straight in the room. */
export const WEB_GAME_URL = 'https://memorymatch-online.pages.dev';

/**
 * Where "Download the app" leads: the game's own address. The web game answers
 * it with a redirect to APK_RELEASE_URL (dist/web/_redirects, written by
 * scripts/build-web.mjs), so friends see the game's address, not the repository's.
 * Once the app is on the Play Store, point APK_RELEASE_URL at the listing.
 */
export const APP_DOWNLOAD_URL = 'https://memorymatch-online.pages.dev/download';

/**
 * The newest Android test APK (the APK workflow attaches it as memory-match.apk
 * to the latest release). The target of APP_DOWNLOAD_URL.
 */
export const APK_RELEASE_URL =
  'https://github.com/menachemil90-a11y/memory-match-game/releases/latest/download/memory-match.apk';

/**
 * The web game's first address (GitHub Pages). Invite links sent before the move
 * point here; that site now only forwards them to WEB_GAME_URL
 * (scripts/build-legacy-redirect.mjs).
 */
export const LEGACY_WEB_GAME_URL = 'https://menachemil90-a11y.github.io/memory-match-game';

/** Android package id (for "Open in app" from the browser). Must match app.json. */
export const ANDROID_PACKAGE = 'com.placeholder.memorymatch';
