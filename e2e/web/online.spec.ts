import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

import {
  ONLINE,
  WEB_GAME_URL,
  contextOptions,
  createRoom,
  flip,
  joinWithNickname,
  playToEnd,
  twoPlayers,
  waitForBoard,
  watchConsole,
} from './helpers';

/**
 * Online play in the browser against the real game server (Supabase), two
 * separate browsers: a host and a friend. Runs with E2E_ONLINE=1 (in CI; the
 * development sandbox can't reach the server).
 */
test.skip(!ONLINE, 'needs the game server (E2E_ONLINE=1)');

const TINY_CARDS = 6;

/** Path of an invite link on the site under test (the link itself names the live site). */
function invitePath(link: string): string {
  expect(link.startsWith(`${WEB_GAME_URL}/join/?c=`)).toBe(true);
  return link.slice(WEB_GAME_URL.length + 1);
}

async function leaveToMenu(page: Page) {
  await page.getByRole('button', { name: 'Back to menu' }).click();
  await expect(page.getByRole('button', { name: 'Play Online' })).toBeVisible();
}

test('a full game from an invite link, then a rematch', async ({ browser }, testInfo) => {
  const { contexts, host, guest } = await twoPlayers(browser, testInfo);
  const hostProblems = watchConsole(host);
  const guestProblems = watchConsole(guest);
  const mobile = testInfo.project.name === 'mobile';
  if (mobile) {
    // A phone's share sheet (the browser's Web Share API).
    await host.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        value: async (data: ShareData) => {
          (window as unknown as { shared: ShareData }).shared = data;
        },
      });
    });
  }

  await host.goto('');
  await host.getByRole('button', { name: 'Play Online' }).click();
  const code = await createRoom(host, 'Hosty');
  await expect(host.getByText(/visible only to the friend/)).toHaveCount(0); // built-in board

  // Invite: share sheet on a phone, copied to the clipboard on a desktop.
  await host.getByTestId('invite').click();
  let message: string;
  if (mobile) {
    message = await host.evaluate(
      () => (window as unknown as { shared: ShareData }).shared.text ?? '',
    );
  } else {
    await expect(host.getByRole('button', { name: 'Copied!' })).toBeVisible();
    message = await host.evaluate(() => navigator.clipboard.readText());
  }
  const link = `${WEB_GAME_URL}/join/?c=${code}`;
  expect(message).toBe(
    `Let's play Memory Match! 🃏 Tap to play with me right in your browser — no download needed: ${link} (Room code: ${code})`,
  );

  // The friend taps the link: a fresh browser, straight into the room.
  await guest.goto(invitePath(link));
  await expect(guest).toHaveURL(new RegExp(`/online/${code}$`));
  await joinWithNickname(guest, 'Guesty');

  await waitForBoard([host, guest], TINY_CARDS);
  await playToEnd([host, guest], TINY_CARDS);
  // The web results invite to the app.
  await expect(guest.getByRole('link', { name: 'Play more in the app' })).toBeVisible();

  // Rematch: both ask, a new game starts.
  await host.getByRole('button', { name: 'Rematch' }).click();
  await guest.getByRole('button', { name: /Rematch/ }).click();
  await waitForBoard([host, guest], TINY_CARDS);
  for (const page of [host, guest]) {
    await expect(page.getByText(/^(You win!|It's a tie!|.+ wins!)$/)).toHaveCount(0);
  }
  await playToEnd([host, guest], TINY_CARDS);

  await leaveToMenu(guest);
  await leaveToMenu(host);
  expect(hostProblems).toEqual([]);
  expect(guestProblems).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});

test('joining by typing the code', async ({ browser }, testInfo) => {
  const { contexts, host, guest } = await twoPlayers(browser, testInfo);
  const problems = [...watchConsole(host), ...watchConsole(guest)];
  const code = await createRoom(host, 'Hosty');

  await guest.goto('');
  await guest.getByRole('button', { name: 'Play Online' }).click();
  await guest.getByPlaceholder('Your nickname').fill('Guesty');
  await guest.getByLabel('Game code').fill(code.toLowerCase());
  await guest.getByRole('button', { name: 'Join', exact: true }).click();

  await waitForBoard([host, guest], TINY_CARDS);
  await playToEnd([host, guest], TINY_CARDS);
  await leaveToMenu(guest);
  await leaveToMenu(host);
  expect(problems).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});

test('a room link opened fresh, and a reload during the game', async ({ browser }, testInfo) => {
  const { contexts, host, guest } = await twoPlayers(browser, testInfo);
  const code = await createRoom(host, 'Hosty');
  const problems = [...watchConsole(host), ...watchConsole(guest, [`/online/${code}`])];

  // GitHub Pages serves …/online/CODE with 404.html, which is the game.
  await guest.goto(`online/${code}`);
  await joinWithNickname(guest, 'Guesty');
  await waitForBoard([host, guest], TINY_CARDS);

  // A reload keeps the player in the game (same anonymous session, rejoins the room).
  await guest.reload();
  await waitForBoard([host, guest], TINY_CARDS);
  await playToEnd([host, guest], TINY_CARDS);
  await leaveToMenu(guest);
  await leaveToMenu(host);
  expect(problems).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});

/** The public Supabase settings the app is built with (.env — public by design). */
function supabaseEnv() {
  const env = readFileSync(join(__dirname, '../../.env'), 'utf8');
  const get = (key: string) => new RegExp(`^${key}=(.+)$`, 'm').exec(env)![1]!.trim();
  return { url: get('EXPO_PUBLIC_SUPABASE_URL'), key: get('EXPO_PUBLIC_SUPABASE_ANON_KEY') };
}

/** Stand-ins for a host's photo cards (small real JPEGs). */
const fixture = (n: number) => readFileSync(join(__dirname, 'fixtures', `card${n}.jpg`));

test("a web guest sees the host's photo cards (signed URLs)", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'once is enough');
  // The host is an app user: here a script plays the app's part of the protocol.
  const { url, key } = supabaseEnv();
  const app = createClient(url, key, { auth: { persistSession: false } });
  const { error: authError } = await app.auth.signInAnonymously();
  expect(authError).toBeNull();
  const created = await app.rpc('create_photo_room', {
    p_level_id: 'tiny',
    p_card_back: 'coral-dots',
    p_name: 'Photohost',
    p_avatar: 'owl',
    p_app_version: '0.3.0',
  });
  test.skip(
    created.error?.code === 'PGRST202',
    'migration 20261119000006_photo_rooms.sql is not applied on the server yet',
  );
  expect(created.error).toBeNull();
  const room = created.data as { id: string; code: string; photo_ids: string[] };
  for (const [i, id] of room.photo_ids.entries()) {
    const { error } = await app.storage
      .from('room-photos')
      .upload(`${room.id}/${id}.jpg`, fixture(i + 1), { contentType: 'image/jpeg' });
    expect(error).toBeNull();
  }
  expect((await app.rpc('photo_room_ready', { p_room_id: room.id })).error).toBeNull();

  const context = await browser.newContext(contextOptions(testInfo.project.use));
  const guest = await context.newPage();
  const problems = watchConsole(guest);
  await guest.goto(`join/?c=${room.code}`);
  await joinWithNickname(guest, 'Guesty');
  await waitForBoard([guest], TINY_CARDS);

  // Turn a card over (the host's script plays the host's turn), then check the photo.
  const { data: state } = await app
    .from('rooms')
    .select('current_player')
    .eq('id', room.id)
    .single();
  if (state!.current_player === 0) {
    expect((await app.rpc('flip_card', { p_room_id: room.id, p_index: 0 })).error).toBeNull();
    await expect(guest.locator('[aria-label^="Card 1, Photo "]')).toHaveCount(1);
  } else {
    expect(await flip(guest, 0)).toMatch(/^Photo [1-3]$/);
  }
  const photo = guest.locator('img[src*="/storage/v1/object/sign/room-photos/"]').first();
  await expect(photo).toBeAttached();
  await expect
    .poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  expect(problems).toEqual([]);

  // The host leaves (forfeit), then closes the room and deletes the cards, like the app does.
  await context.close();
  expect((await app.rpc('leave_room', { p_room_id: room.id })).data.status).toBe('finished');
  expect((await app.rpc('leave_room', { p_room_id: room.id })).data.status).toBe('closed');
  const removed = await app.storage
    .from('room-photos')
    .remove(room.photo_ids.map((id) => `${room.id}/${id}.jpg`));
  expect(removed.error).toBeNull();
});
