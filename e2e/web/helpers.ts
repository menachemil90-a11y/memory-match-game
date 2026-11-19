import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

/** The live site's address and the download link, read from src/lib/links.ts. */
const links = readFileSync(join(__dirname, '../../src/lib/links.ts'), 'utf8');
export const WEB_GAME_URL = /WEB_GAME_URL = '([^']+)'/.exec(links)![1]!;
export const APP_DOWNLOAD_URL = /APP_DOWNLOAD_URL =\s*'([^']+)'/.exec(links)![1]!;

export const ONLINE = process.env.E2E_ONLINE === '1';

export const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
export const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/**
 * Collects console errors and uncaught exceptions. The only accepted message is
 * the HTTP 404 status of a deep link opened fresh: GitHub Pages answers room
 * URLs (…/online/CODE) with its 404.html page, which loads the game.
 */
export function watchConsole(page: Page, deepLinks: string[] = []): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location().url;
    if (/status of 404/.test(msg.text()) && deepLinks.some((d) => url.endsWith(d))) return;
    problems.push(`console error: ${msg.text()} (${url})`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

/** Opens the online lobby and sets the nickname. */
export async function openLobby(page: Page, nickname: string): Promise<void> {
  await page.goto('online');
  await page.getByPlaceholder('Your nickname').fill(nickname);
}

/** Host: creates a room on a built-in board; returns its code (waiting screen). */
export async function createRoom(page: Page, nickname: string): Promise<string> {
  await openLobby(page, nickname);
  await page.getByRole('button', { name: 'Create a game' }).click();
  await page.getByLabel('Animals, 24 pictures').click();
  await page.getByLabel('Tiny, 3 pairs').click();
  await expect(page.getByText('Waiting for a friend…')).toBeVisible();
  const code = (await page
    .getByText(/^[A-HJ-NP-Z2-9]{6}$/)
    .first()
    .textContent())!.trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  return code;
}

/** Guest on a join screen without a stored nickname: types it and joins. */
export async function joinWithNickname(page: Page, nickname: string): Promise<void> {
  await page.getByPlaceholder('Your nickname').fill(nickname);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
}

const card = (page: Page, i: number) => page.locator(`[aria-label^="Card ${i + 1},"]`).first();

/** Waits until the game is on screen on both pages (coin flip and deal done). */
export async function waitForBoard(pages: Page[], cards: number): Promise<void> {
  for (const page of pages) {
    await expect(page.locator('[aria-label^="Card "]')).toHaveCount(cards, { timeout: 30_000 });
  }
}

/** The page whose player is playing now (the player panel says so, like a screen reader). */
async function activePage(pages: Page[]): Promise<Page | null> {
  for (const page of pages) {
    if ((await page.locator('[aria-label^="You,"][aria-label$="playing now"]').count()) > 0) {
      return page;
    }
  }
  return null;
}

async function faceUpLabel(page: Page, i: number): Promise<string | null> {
  const label = await card(page, i)
    .getAttribute('aria-label', { timeout: 1000 })
    .catch(() => null);
  if (!label || label.endsWith('face down')) return null;
  return label.replace(/^Card \d+, /, '');
}

/** Turns card i over on this page (retries while the deal or a pair is still running). */
export async function flip(page: Page, i: number): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await card(page, i).click();
    try {
      await expect(card(page, i)).not.toHaveAttribute('aria-label', /face down$/, {
        timeout: 2500,
      });
      return (await faceUpLabel(page, i))!;
    } catch {
      // Still dealing, or the previous pair is still resolving: try again.
    }
  }
  throw new Error(`Card ${i + 1} did not turn over`);
}

/**
 * Plays an online game to the end from two browsers, like two careful players:
 * remembers every card seen and takes a known pair whenever there is one.
 */
export async function playToEnd(pages: Page[], cards: number): Promise<void> {
  const known = new Map<number, string>();
  const matched = new Set<number>();
  const isOver = async () =>
    (await pages[0]!.getByText(/^(You win!|It's a tie!|.+ wins!)$/).count()) > 0;

  for (let turn = 0; turn < 200 && !(await isOver()); turn++) {
    const page = await activePage(pages);
    if (!page) {
      await pages[0]!.waitForTimeout(300);
      continue;
    }
    for (let i = 0; i < cards; i++) {
      if (!matched.has(i) && (await card(page, i).count()) === 0) {
        matched.add(i);
        known.delete(i);
      }
    }
    const open = [...Array(cards).keys()].filter((i) => !matched.has(i));
    if (open.length === 0) break;
    const unknown = open.filter((i) => !known.has(i));
    const pairOf = (label: string, not: number) =>
      [...known].find(([i, l]) => l === label && i !== not && !matched.has(i))?.[0];

    let first = [...known].find(([i, l]) => pairOf(l, i) !== undefined)?.[0];
    if (first === undefined) first = unknown[0]!;
    const firstLabel = await flip(page, first);
    known.set(first, firstLabel);
    let second = pairOf(firstLabel, first);
    if (second === undefined) second = unknown.find((i) => i !== first)!;
    const secondLabel = await flip(page, second);
    known.set(second, secondLabel);

    // Wait for the server to resolve the pair (match: cards fly away; miss: turn back).
    await expect
      .poll(
        async () =>
          (await card(page, second).count()) === 0 || (await faceUpLabel(page, second)) === null,
        { timeout: 10_000 },
      )
      .toBe(true);
    if (firstLabel === secondLabel) {
      matched.add(first);
      matched.add(second);
    }
  }
  for (const page of pages) {
    await expect(page.getByText(/^(You win!|It's a tie!|.+ wins!)$/)).toBeVisible({
      timeout: 20_000,
    });
  }
}

/** The browser-context options of the running project (viewport, base URL …). */
export function contextOptions(
  use: TestInfo['project']['use'],
): Parameters<Browser['newContext']>[0] {
  return {
    baseURL: use.baseURL,
    viewport: use.viewport,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
    permissions: use.permissions,
    serviceWorkers: use.serviceWorkers,
  };
}

/** Two separate visitors (no shared storage), like two phones. */
export async function twoPlayers(
  browser: Browser,
  testInfo: TestInfo,
): Promise<{ contexts: BrowserContext[]; host: Page; guest: Page }> {
  const options = contextOptions(testInfo.project.use);
  const contexts = [await browser.newContext(options), await browser.newContext(options)];
  const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
  return { contexts, host: host!, guest: guest! };
}
