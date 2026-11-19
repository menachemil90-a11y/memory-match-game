/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  APK_RELEASE_URL,
  APP_DOWNLOAD_URL,
  ANDROID_PACKAGE,
  LEGACY_WEB_GAME_URL,
  WEB_GAME_URL,
} from '@/lib/links';

const ROOT = join(__dirname, '../../../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('web game configuration', () => {
  it('the HTML template (link previews, icons) points at WEB_GAME_URL', () => {
    const html = read('public/index.html');
    const site = new URL(WEB_GAME_URL);
    expect(html).toContain(`<meta property="og:url" content="${WEB_GAME_URL}/" />`);
    expect(html).toContain(`content="${WEB_GAME_URL}/og-image.png"`);
    expect(html).toContain(`href="${site.pathname.replace(/\/$/, '')}/apple-touch-icon.png"`);
    for (const tag of [
      'og:title',
      'og:description',
      'og:image',
      'og:image:width',
      'twitter:card',
    ]) {
      expect(html).toContain(`"${tag}"`);
    }
    // No tracking or third-party requests.
    expect(html).not.toMatch(/googletagmanager|google-analytics|gtag\(|<script/);
  });

  it('the files the template names exist', () => {
    const files = readdirSync(join(ROOT, 'public'));
    expect(files).toEqual(
      expect.arrayContaining(['index.html', 'og-image.png', 'apple-touch-icon.png']),
    );
  });

  it("the download link is on the game's own site and leads to the newest APK", () => {
    // Friends see the game's address; the site redirects it (_redirects, build-web.mjs).
    expect(APP_DOWNLOAD_URL).toBe(`${WEB_GAME_URL}/download`);
    // The old address is this repository's GitHub Pages site; the APK is in its releases.
    const legacy = new URL(LEGACY_WEB_GAME_URL);
    const owner = legacy.hostname.split('.')[0];
    const repo = legacy.pathname.slice(1);
    expect(APK_RELEASE_URL).toBe(
      `https://github.com/${owner}/${repo}/releases/latest/download/memory-match.apk`,
    );
    // The game's address doesn't show the owner or GitHub.
    expect(new URL(WEB_GAME_URL).hostname).not.toMatch(/github|menachem/);
    // The APK workflow attaches exactly this file name to the latest release.
    expect(read('.github/workflows/android-apk.yml')).toMatch(/memory-match\.apk[\s\S]*--latest/);
  });

  it('"Open in app" names the app’s real package', () => {
    const app = JSON.parse(read('app.json')) as { expo: { android: { package: string } } };
    expect(ANDROID_PACKAGE).toBe(app.expo.android.package);
  });
});
