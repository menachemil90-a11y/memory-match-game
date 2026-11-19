/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { APP_DOWNLOAD_URL, ANDROID_PACKAGE, WEB_GAME_URL } from '@/lib/links';

const ROOT = join(__dirname, '../../../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('web game configuration', () => {
  it('the HTML template (link previews, icons) points at WEB_GAME_URL', () => {
    const html = read('public/index.html');
    const site = new URL(WEB_GAME_URL);
    expect(html).toContain(`<meta property="og:url" content="${WEB_GAME_URL}/" />`);
    expect(html).toContain(`content="${WEB_GAME_URL}/og-image.png"`);
    expect(html).toContain(`href="${site.pathname}/apple-touch-icon.png"`);
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

  it('the download link is the newest APK of this repository', () => {
    const site = new URL(WEB_GAME_URL);
    const owner = site.hostname.split('.')[0];
    const repo = site.pathname.slice(1);
    expect(APP_DOWNLOAD_URL).toBe(
      `https://github.com/${owner}/${repo}/releases/latest/download/memory-match.apk`,
    );
    // The APK workflow attaches exactly this file name to the latest release.
    expect(read('.github/workflows/android-apk.yml')).toMatch(/memory-match\.apk[\s\S]*--latest/);
  });

  it('"Open in app" names the app’s real package', () => {
    const app = JSON.parse(read('app.json')) as { expo: { android: { package: string } } };
    expect(ANDROID_PACKAGE).toBe(app.expo.android.package);
  });
});
