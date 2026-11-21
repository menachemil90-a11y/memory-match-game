import { expect, test } from '@playwright/test';

import {
  ANDROID_UA,
  APP_DOWNLOAD_URL,
  IPHONE_UA,
  WEB_GAME_URL,
  contextOptions,
  watchConsole,
} from './helpers';

/** The web game's shell, routes, app-only popups and links — no game server needed. */

/** The home screen: the site root (the web game lives at the root of its address). */
const home = /^https?:\/\/[^/]+\/$/;

test.describe('home and the download button', () => {
  test('looks like the app, with a big download button and the top bar', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto('');
    for (const name of ['Solo', '2–8 Players', 'Play Online', 'My Boards']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    const big = page.getByRole('link', { name: 'Download the app' });
    await expect(big).toHaveCount(2); // top bar + home button
    for (const link of await big.all()) {
      await expect(link).toHaveAttribute('href', APP_DOWNLOAD_URL);
      await expect(link).toBeInViewport();
    }
    expect(problems).toEqual([]);
  });

  test('every app-only button opens "Available in the app" with a download link', async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.goto('');
    for (const feature of ['Solo', '2–8 Players', 'My Boards']) {
      await page.getByRole('button', { name: feature, exact: true }).click();
      await expect(page.getByText('Available in the app')).toBeVisible();
      await expect(page.getByText(`${feature} is part of the free Android app.`)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Download for Android' })).toHaveAttribute(
        'href',
        APP_DOWNLOAD_URL,
      );
      await page.getByRole('button', { name: 'Not now' }).click();
      await expect(page.getByText('Available in the app')).toBeHidden();
      await expect(page).toHaveURL(home);
    }
    // "Play online here" goes to the part that works in the browser.
    await page.getByRole('button', { name: 'Solo', exact: true }).click();
    await page.getByRole('button', { name: 'Play online here' }).click();
    await expect(page).toHaveURL(/\/online$/);
    await expect(page.getByRole('button', { name: 'Create a game' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the download link points at the newest APK of the releases', async ({ page }) => {
    await page.goto('');
    expect(APP_DOWNLOAD_URL).toBe(`${WEB_GAME_URL}/download`);
    // A real link: the browser downloads it like any other link (no script involved).
    const tag = await page
      .getByRole('link', { name: 'Download the app' })
      .first()
      .evaluate((el) => el.tagName);
    expect(tag).toBe('A');
  });

  test('app-only screens cannot be opened on the web, not even by URL', async ({ page }) => {
    for (const path of ['game', 'levels', 'my-boards', 'my-boards/new', 'results', 'setup']) {
      await page.goto(path);
      await expect(page).toHaveURL(home);
      await expect(page.getByRole('button', { name: 'Play Online' })).toBeVisible();
    }
  });

  test('settings show only what the web game has', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Sound effects')).toBeVisible();
    await expect(page.getByText('Music')).toBeVisible();
    for (const appOnly of ['Vibration', 'Flip-back speed', 'Reset scores', 'Check for updates']) {
      await expect(page.getByText(appOnly)).toHaveCount(0);
    }
    await expect(page.getByText('Privacy policy')).toBeVisible();
  });

  test('the online board picker has the game boards only (no photo boards on the web)', async ({
    page,
  }) => {
    await page.goto('boards?mode=solo');
    await expect(page.getByLabel('Animals, 24 pictures')).toBeVisible();
    await expect(page.getByText('My photo boards')).toHaveCount(0);
    await expect(page.getByText('Create board')).toHaveCount(0);
  });
});

test.describe('invite links', () => {
  // What chat apps' link-preview crawlers get (WhatsApp, Facebook/Messenger, Telegram):
  // a real page (200), the preview tags early in <head>, and a reachable PNG under
  // ~300 KB (WhatsApp drops larger images).
  const CRAWLERS = {
    WhatsApp: 'WhatsApp/2.24.21.84 A',
    Facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    Telegram: 'TelegramBot (like TwitterBot)',
  };
  const meta = (html: string, key: string) =>
    new RegExp(`(?:property|name)="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

  for (const [crawler, userAgent] of Object.entries(CRAWLERS)) {
    test(`link previews for ${crawler}: the game, and an invitation with its own card`, async ({
      request,
    }) => {
      const pages = [
        { path: '', title: 'Play Memory Match with me! 🃏', image: 'og-image.png' },
        { path: 'online/', title: 'Play Memory Match with me! 🃏', image: 'og-image.png' },
        {
          path: 'join/?c=ABC234',
          title: "You're invited to play Memory Match! 🃏",
          image: 'og-invite.png',
        },
      ];
      for (const { path, title, image } of pages) {
        const response = await request.get(path, { headers: { 'User-Agent': userAgent } });
        expect(response.status(), path).toBe(200);
        expect(response.headers()['content-type'], path).toContain('text/html');
        const html = await response.text();
        // Early in the page: crawlers read only the beginning.
        expect(html.indexOf('property="og:image"'), path).toBeLessThan(2500);
        expect(meta(html, 'og:title'), path).toBe(title);
        expect(meta(html, 'og:description'), path).toMatch(/no download/);
        expect(meta(html, 'og:image'), path).toBe(`${WEB_GAME_URL}/${image}`);
        expect(meta(html, 'og:image:secure_url'), path).toBe(`${WEB_GAME_URL}/${image}`);
        expect(meta(html, 'og:image:width'), path).toBe('1200');
        expect(meta(html, 'og:image:height'), path).toBe('630');
        expect(meta(html, 'twitter:card'), path).toBe('summary_large_image');

        const picture = await request.get(image, { headers: { 'User-Agent': userAgent } });
        expect(picture.status(), image).toBe(200);
        expect(picture.headers()['content-type'], image).toContain('image/png');
        const bytes = await picture.body();
        expect(bytes.length, image).toBeLessThan(300_000);
        // A real 1200×630 PNG (width/height from the IHDR chunk).
        expect(bytes.readUInt32BE(16), image).toBe(1200);
        expect(bytes.readUInt32BE(20), image).toBe(630);
      }
    });
  }

  test('an old or new invite link opens the join flow for that room', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto('join/?c=abc234');
    await expect(page).toHaveURL(/\/online\/ABC234$/);
    await expect(page.getByText('Room ABC234')).toBeVisible();
    // The invitation: pick an avatar and a name, then Join — no error before trying.
    await expect(page.getByText("You're invited to a game!")).toBeVisible();
    await expect(page.getByPlaceholder('Your nickname')).toBeVisible();
    await expect(page.getByText('Please choose a nickname.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Join the game', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Join the game', exact: true }).click();
    await expect(page.getByText('Please choose a nickname.')).toBeVisible();
    // A link without a valid code lands in the lobby, where a code can be typed.
    await page.goto('join/?c=nope');
    await expect(page).toHaveURL(/\/online$/);
    expect(problems).toEqual([]);
  });

  test('a room link opened fresh (GitHub Pages 404 fallback) still opens the room', async ({
    page,
  }) => {
    const problems = watchConsole(page, ['/online/ABC234']);
    const response = await page.goto('online/ABC234');
    expect(response?.status()).toBe(404); // how GitHub Pages serves 404.html …
    await expect(page.getByText('Room ABC234')).toBeVisible(); // … which is the game
    expect(problems).toEqual([]);
  });
});

test.describe('phones', () => {
  test('Android: "Have the app? Open in app" is offered before joining', async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      ...contextOptions(testInfo.project.use),
      userAgent: ANDROID_UA,
    });
    const page = await context.newPage();
    await page.goto('join/?c=ABC234');
    const open = page.getByRole('link', { name: 'Have the app? Open in app' });
    await expect(open).toBeVisible();
    const href = await open.getAttribute('href');
    expect(href).toMatch(/^intent:\/\/online\/ABC234#Intent;scheme=memorymatch;package=/);
    expect(decodeURIComponent(href!)).toContain(
      `S.browser_fallback_url=${WEB_GAME_URL}/join/?c=ABC234`,
    );
    await context.close();
  });

  test('iPhone: online play works here; the app is Android-only for now', async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      ...contextOptions(testInfo.project.use),
      userAgent: IPHONE_UA,
    });
    const page = await context.newPage();
    await page.goto('');
    // No APK link for an iPhone: the button explains instead.
    await expect(page.getByRole('link', { name: 'Download the app' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Download the app' }).first().click();
    await expect(page.getByText('Available in the app')).toBeVisible();
    await expect(page.getByText(/The app is for Android phones only for now/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download for Android' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Play online here' }).click();
    await expect(page).toHaveURL(/\/online$/);
    await page.goto('join/?c=ABC234');
    await expect(page.getByRole('link', { name: 'Have the app? Open in app' })).toHaveCount(0);
    await context.close();
  });
});

test.describe('desktop', () => {
  test('the game sits in a phone-width column', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop layout');
    await page.goto('');
    const bar = await page.getByTestId('download-bar').boundingBox();
    const solo = await page.getByRole('button', { name: 'Solo', exact: true }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(solo!.width).toBeLessThanOrEqual(480);
    // Centered: the same space on both sides of the column.
    const column = { left: solo!.x - 16, right: solo!.x + solo!.width + 16 };
    expect(Math.abs(column.left - (viewport.width - column.right))).toBeLessThanOrEqual(2);
    expect(bar!.x + bar!.width).toBeLessThanOrEqual(column.right + 1);
  });
});
