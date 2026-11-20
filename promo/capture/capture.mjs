#!/usr/bin/env node
/**
 * Captures the promo footage from the REAL game (see promo/BRIEF.md, "Footage"):
 * - the capture-only build of the full app (Solo, 2 Players on one phone, levels),
 *   served by serve.cjs at CAPTURE_URL;
 * - online play against the live game server: a real photo room with the demo
 *   family photos (created through the API like the photo-room E2E test), and the
 *   live web game (WEB_URL) for the friend who joins from a browser.
 *
 * Usage: node capture/capture.mjs [clip ...]   (default: all)
 * Output: promo/out/footage/<clip>/{frames/*.jpg, clip.json} — see recorder.mjs.
 * Online clips need the game server (CI can reach it; the dev sandbox can't).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

import { SCALE, startRecording } from './recorder.mjs';

const PROMO = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(PROMO, '..');
const OUT = join(PROMO, 'out', 'footage');
const CAPTURE_URL = process.env.CAPTURE_URL ?? 'http://localhost:8098';
const WEB_URL = process.env.WEB_URL ?? 'https://memorymatch-online.pages.dev';
const APP_VERSION = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo.version;

const env = readFileSync(join(ROOT, '.env'), 'utf8');
const envValue = (key) => new RegExp(`^${key}=(.+)$`, 'm').exec(env)[1].trim();
const SUPABASE_URL = envValue('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_KEY = envValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const SESSION_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/** The demo family photos (fictional, AI-made — promo/photos/README.md), as p1…p8. */
const PHOTOS = [
  '01-family',
  '02-grandma-baking',
  '03-grandpa-icecream',
  '04-kids-beach',
  '05-birthday',
  '06-boy-dog',
  '07-parents-selfie',
  '08-family-dinner',
];
/** Grandma's photo is p2 → "Photo 2" on the cards. */
const GRANDMA = 'p2';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

// ---------------------------------------------------------------------------
// Phones (browser contexts) and the game's cards
// ---------------------------------------------------------------------------

function playersStorage({ local = ['', ''], online = { name: '', avatar: 'owl' } } = {}) {
  return JSON.stringify({
    state: {
      local: [
        { name: local[0], color: 'coral', avatar: 'fox' },
        { name: local[1], color: 'sky', avatar: 'panda' },
      ],
      tabletop: false,
      online,
    },
    version: 1,
  });
}

/** A phone: 360×640 CSS px at device scale SCALE, with optional localStorage. */
async function phone(browser, baseURL, storage = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    baseURL,
  });
  await ctx.addInitScript((items) => {
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
  }, storage);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('page error:', e.message));
  return { ctx, page };
}

const card = (page, i) => page.locator(`[aria-label^="Card ${i + 1},"]`).first();

async function faceUpLabel(page, i) {
  const label = await card(page, i)
    .getAttribute('aria-label', { timeout: 1000 })
    .catch(() => null);
  if (!label || label.endsWith('face down')) return null;
  return label.replace(/^Card \d+, /, '');
}

/** Taps card i and waits until it shows its face; returns the face's label. */
async function flip(page, i, rec) {
  for (let attempt = 0; attempt < 8; attempt++) {
    rec?.mark('flip');
    await card(page, i).click({ timeout: 5000 });
    for (let w = 0; w < 25; w++) {
      const label = await faceUpLabel(page, i);
      if (label) return label;
      await sleep(100);
    }
  }
  throw new Error(`card ${i + 1} did not turn over`);
}

async function cardCount(page) {
  return page.locator('[aria-label^="Card "]').count();
}

async function waitForCards(page, n, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await cardCount(page)) === n) return;
    await sleep(150);
  }
  throw new Error(`expected ${n} cards`);
}

// ---------------------------------------------------------------------------
// The game server (the same API the app uses)
// ---------------------------------------------------------------------------

async function apiPlayer() {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return { client, session: data.session };
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

async function room(client, id) {
  const { data, error } = await client.from('rooms').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/** Card art for the server: the app uploads 480×480 JPEG copies of the cropped photos. */
function roomCard(name) {
  const out = join(PROMO, 'out', 'room-cards', `${name}.jpg`);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    join(PROMO, 'photos', `${name}.jpg`),
    '-vf',
    'scale=480:480',
    '-q:v',
    '4',
    out,
  ]);
  return readFileSync(out);
}

/** A photo room hosted by an API player, with the demo photos uploaded. */
async function photoRoom(host, level, nickname) {
  const created = await rpc(host.client, 'create_photo_room', {
    p_level_id: level,
    p_card_back: 'grape-stars',
    p_name: nickname,
    p_avatar: 'fox',
    p_app_version: APP_VERSION,
  });
  for (const [i, id] of created.photo_ids.entries()) {
    const { error } = await host.client.storage
      .from('room-photos')
      .upload(`${created.id}/${id}.jpg`, roomCard(PHOTOS[i]), { contentType: 'image/jpeg' });
    if (error) throw new Error(`upload ${id}: ${error.message}`);
  }
  return rpc(host.client, 'photo_room_ready', { p_room_id: created.id });
}

async function joinAsApi(player, code, nickname, avatar = 'panda') {
  return rpc(player.client, 'join_room', {
    p_code: code,
    p_name: nickname,
    p_avatar: avatar,
    p_app_version: APP_VERSION,
  });
}

/**
 * What everyone has seen so far: position → image id. Face-up cards carry their
 * image id in the public room state.
 */
function learn(known, r) {
  r.cards.forEach((c, i) => {
    if (c.i) known.set(i, c.i);
  });
}

async function waitFor(client, id, test, ms = 20_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await room(client, id);
    if (test(r)) return r;
    await sleep(150);
  }
  throw new Error('room state timeout');
}

const openCards = (r) => r.cards.map((c, i) => (c.s === 'matched' ? -1 : i)).filter((i) => i >= 0);

/** Two cards that surely don't match (or one unknown): reveals new cards, no pair. */
function missPair(known, r, avoid = new Set()) {
  const open = openCards(r).filter((i) => !avoid.has(i));
  const unknown = open.filter((i) => !known.has(i));
  const first = unknown[0] ?? open[0];
  const firstImage = known.get(first);
  const different = open.find((i) => i !== first && known.has(i) && known.get(i) !== firstImage);
  // Only one pair left: no miss is possible, any second card will do.
  const second =
    different ??
    open.find((i) => i !== first && !known.has(i)) ??
    openCards(r).find((i) => i !== first);
  return [first, second];
}

/** The API player takes a turn: flips two cards, then the pair is resolved. */
async function apiTurn(player, roomId, [a, b], known) {
  await rpc(player.client, 'flip_card', { p_room_id: roomId, p_index: a });
  let r = await room(player.client, roomId);
  learn(known, r);
  // Second card: still sure not to match now that the first face is known.
  const firstImage = r.cards[a].i;
  if (known.has(b) && known.get(b) === firstImage) {
    const alt = openCards(r).find((i) => i !== a && known.has(i) && known.get(i) !== firstImage);
    if (alt !== undefined) b = alt;
  }
  await rpc(player.client, 'flip_card', { p_room_id: roomId, p_index: b });
  r = await room(player.client, roomId);
  learn(known, r);
  await sleep(1700);
  await player.client.rpc('resolve_turn', { p_room_id: roomId, p_skip: false });
  return waitFor(player.client, roomId, (x) => x.phase !== 'resolving');
}

/** A page player's turn: taps two cards and waits for the server to resolve them. */
async function pageTurn(page, viewer, roomId, [a, b], known, rec) {
  await flip(page, a, rec);
  let r = await room(viewer.client, roomId);
  learn(known, r);
  const firstImage = r.cards[a].i;
  await flip(page, b, rec);
  r = await room(viewer.client, roomId);
  learn(known, r);
  const matched = r.cards[b].i === firstImage;
  rec?.mark(matched ? 'match' : 'miss');
  return { matched, room: await waitFor(viewer.client, roomId, (x) => x.phase !== 'resolving') };
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

const clips = {
  /** Video 4: the level picker, then every level's board dealing (Solo, the app). */
  async levels(browser) {
    const { ctx, page } = await phone(browser, CAPTURE_URL, { players: playersStorage() });
    // Load the level screen once first, so its board picture is cached when filmed.
    await page.goto('/levels?mode=solo&boardId=animals', { waitUntil: 'networkidle' });
    await sleep(1000);
    await page.goto('/boards?mode=solo', { waitUntil: 'networkidle' });
    await sleep(800);
    let rec = await startRecording(page, join(OUT, 'levels-picker'));
    await sleep(700);
    rec.mark('tap');
    await page.getByLabel('Animals, 24 pictures').click();
    await sleep(2600);
    log('levels-picker', await rec.stop());

    const levels = [
      ['tiny', 'Tiny, 3 pairs', 6],
      ['easy', 'Easy, 6 pairs', 12],
      ['medium', 'Medium, 8 pairs', 16],
      ['tricky', 'Tricky, 10 pairs', 20],
      ['hard', 'Hard, 12 pairs', 24],
      ['expert', 'Expert, 18 pairs', 36],
    ];
    for (const [id, label, cards] of levels) {
      await page.goto('/levels?mode=solo&boardId=animals', { waitUntil: 'networkidle' });
      await sleep(600);
      rec = await startRecording(page, join(OUT, `level-${id}`));
      await sleep(300);
      rec.mark('tap');
      await page.getByLabel(label).click();
      await waitForCards(page, cards);
      rec.mark('deal');
      await sleep(cards * 35 + 1300);
      log(`level-${id}`, await rec.stop());
    }

    // The tiny board played to the end: little ones' first game.
    await page.goto('/levels?mode=solo&boardId=animals', { waitUntil: 'networkidle' });
    await sleep(500);
    await page.getByLabel('Tiny, 3 pairs').click();
    await waitForCards(page, 6);
    await sleep(6 * 35 + 900);
    rec = await startRecording(page, join(OUT, 'tiny-play'));
    await playSolo(page, 6, rec);
    await sleep(2500);
    log('tiny-play', await rec.stop());
    await ctx.close();
  },

  /** Video 3: 2 players on one phone (the app) — the child wins. HE and EN names. */
  async 'two-players'(browser) {
    for (const [lang, names] of [
      ['en', ['Noa', 'Dad']],
      ['he', ['נועה', 'אבא']],
    ]) {
      for (let attempt = 1; attempt <= 6; attempt++) {
        const { ctx, page } = await phone(browser, CAPTURE_URL, { players: playersStorage() });
        await page.goto('/setup?boardId=animals&levelId=easy', { waitUntil: 'networkidle' });
        await sleep(700);
        const rec = await startRecording(page, join(OUT, `two-players.${lang}`));
        await sleep(400);
        await page.getByLabel('Player 1 Name').pressSequentially(names[0], { delay: 90 });
        await sleep(300);
        await page.getByLabel('Player 2 Name').pressSequentially(names[1], { delay: 90 });
        await sleep(500);
        rec.mark('start');
        await page.getByRole('button', { name: "Let's play!" }).click();
        await waitForCards(page, 12);
        rec.mark('dealt');
        await sleep(12 * 35 + 1200);
        const winner = await playTwoPlayers(page, 12, names, rec);
        await sleep(3000);
        const stats = await rec.stop();
        await ctx.close();
        log(`two-players.${lang} attempt ${attempt}: ${winner} won`, stats);
        if (winner === names[0]) break;
        if (attempt === 6) throw new Error('the child never won');
      }
    }
  },

  /** Video 1: the family-photo board (medium, 8 photos) — deal, a miss, Grandma found. */
  async 'family-photos'(browser) {
    const host = await apiPlayer();
    const friend = await apiPlayer();
    const r0 = await photoRoom(host, 'medium', 'Mom');
    const { ctx, page } = await phone(browser, CAPTURE_URL, {
      players: playersStorage({ online: { name: 'Mom', avatar: 'fox' } }),
      [SESSION_KEY]: JSON.stringify(host.session),
    });
    await page.goto(`/online/${r0.code}`, { waitUntil: 'networkidle' });
    await page.getByText('Waiting for a friend…').waitFor({ timeout: 20_000 });
    await sleep(800);
    const rec = await startRecording(page, join(OUT, 'family-photos'));
    await sleep(500);
    rec.mark('join');
    await joinAsApi(friend, r0.code, 'Dana');
    await waitForCards(page, 16);
    rec.mark('dealt');
    await sleep(16 * 35 + 1500);

    const known = new Map();
    let r = await room(host.client, r0.id);
    let missDone = false;
    for (let turn = 0; turn < 60; turn++) {
      const grandma = [...known].filter(([, img]) => img === GRANDMA).map(([i]) => i);
      if (r.current_player === 0) {
        if (grandma.length === 2 && missDone) {
          rec.mark('found:start');
          const res = await pageTurn(page, host, r.id, grandma, known, rec);
          rec.mark('found:end');
          await sleep(2600);
          if (!res.matched) throw new Error('Grandma pair did not match');
          break;
        }
        if (grandma.length === 2 && !missDone) {
          const other = openCards(r).find((i) => known.has(i) && known.get(i) !== GRANDMA);
          rec.mark('miss:start');
          const res = await pageTurn(page, host, r.id, [grandma[0], other], known, rec);
          rec.mark('miss:end');
          missDone = true;
          r = res.room;
          continue;
        }
        const res = await pageTurn(
          page,
          host,
          r.id,
          missPair(known, r, new Set(grandma)),
          known,
          rec,
        );
        r = res.room;
      } else {
        const grandmaSeen = new Set(grandma);
        r = await apiTurn(friend, r.id, missPair(known, r, grandmaSeen), known);
      }
    }
    log('family-photos', await rec.stop());
    await ctx.close();
    await rpc(host.client, 'leave_room', { p_room_id: r0.id }).catch(() => undefined);
  },

  /** Video 2: two phones — the host (app) invites Grandma, who plays in her browser and wins. */
  async 'play-with-grandma'(browser) {
    for (const [lang, grandmaName] of [
      ['en', 'Grandma'],
      ['he', 'סבתא'],
    ]) {
      for (let attempt = 1; attempt <= 6; attempt++) {
        const won = await grandmaGame(browser, lang, grandmaName).catch((error) => {
          if (attempt === 6) throw error;
          log(`grandma ${lang} attempt ${attempt} failed: ${error.message}`);
          return false;
        });
        if (won) break;
        if (attempt === 6) throw new Error('Grandma never won');
      }
    }
  },

  /** Video 5: a perfect run on Easy (6 pairs) — the finder of a pair keeps playing. */
  async speedrun(browser) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const host = await apiPlayer();
      const friend = await apiPlayer();
      const r0 = await rpc(host.client, 'create_room', {
        p_board_id: 'animals',
        p_level_id: 'easy',
        p_name: 'Mom',
        p_avatar: 'fox',
        p_app_version: APP_VERSION,
      });
      const { ctx, page } = await phone(browser, CAPTURE_URL, {
        players: playersStorage({ online: { name: 'Mom', avatar: 'fox' } }),
        [SESSION_KEY]: JSON.stringify(host.session),
      });
      await page.goto(`/online/${r0.code}`, { waitUntil: 'networkidle' });
      await page.getByText('Waiting for a friend…').waitFor({ timeout: 20_000 });
      await joinAsApi(friend, r0.code, 'Dana');
      await waitForCards(page, 12);
      await sleep(12 * 35 + 1500);
      // Everyone looks at cards (misses only) until all 12 are known; then the run.
      const known = new Map();
      let r = await room(host.client, r0.id);
      let spoiled = false;
      for (let turn = 0; turn < 30 && known.size < 12; turn++) {
        if (r.pairs_found > 0) {
          spoiled = true;
          break;
        }
        if (r.current_player === 0)
          r = (await pageTurn(page, host, r.id, missPair(known, r), known)).room;
        else r = await apiTurn(friend, r.id, missPair(known, r), known);
      }
      if (!spoiled && r.pairs_found === 0 && known.size === 12) {
        if (r.current_player !== 0) r = await apiTurn(friend, r.id, missPair(known, r), known);
        await sleep(1500);
        const rec = await startRecording(page, join(OUT, 'speedrun'));
        await sleep(600);
        rec.mark('run:start');
        const byImage = new Map();
        for (const [i, img] of known) byImage.set(img, [...(byImage.get(img) ?? []), i]);
        for (const pair of byImage.values()) {
          const res = await pageTurn(page, host, r.id, pair, known, rec);
          if (!res.matched) throw new Error('speed run missed');
          r = res.room;
        }
        rec.mark('run:end');
        await sleep(3500);
        log('speedrun', await rec.stop());
        await ctx.close();
        return;
      }
      log(`speedrun attempt ${attempt}: a pair was found while looking — again`);
      await ctx.close();
      await rpc(host.client, 'leave_room', { p_room_id: r0.id }).catch(() => undefined);
    }
    throw new Error('no clean speed run');
  },
};

/** Solo play with a perfect memory (tiny board): flips unknowns, takes known pairs. */
async function playSolo(page, cards, rec) {
  const known = new Map();
  const matched = new Set();
  while (matched.size < cards) {
    const open = [...Array(cards).keys()].filter((i) => !matched.has(i));
    const pairOf = (label, not) =>
      [...known].find(([i, l]) => l === label && i !== not && !matched.has(i))?.[0];
    let first = [...known].find(([i, l]) => !matched.has(i) && pairOf(l, i) !== undefined)?.[0];
    first ??= open.find((i) => !known.has(i));
    const a = await flip(page, first, rec);
    known.set(first, a);
    const second = pairOf(a, first) ?? open.find((i) => i !== first && !known.has(i));
    const b = await flip(page, second, rec);
    known.set(second, b);
    rec?.mark(a === b ? 'match' : 'miss');
    if (a === b) {
      matched.add(first);
      matched.add(second);
    }
    await sleep(a === b ? 1300 : 1200);
  }
}

/** 2 players on one phone: the child plays well; the parent finds one pair, then keeps missing. */
async function playTwoPlayers(page, cards, names, rec) {
  const known = new Map();
  const matched = new Set();
  let parentPairs = 0;
  for (let turn = 0; turn < 80 && matched.size < cards; turn++) {
    const active = await page
      .locator('[aria-label$="playing now"]')
      .first()
      .getAttribute('aria-label', { timeout: 5000 })
      .catch(() => null);
    if (!active) {
      await sleep(200);
      continue;
    }
    const childTurn = active.startsWith(`${names[0]},`);
    const open = [...Array(cards).keys()].filter((i) => !matched.has(i));
    const pairOf = (label, not) =>
      [...known].find(([i, l]) => l === label && i !== not && !matched.has(i))?.[0];
    let first;
    const takesPairs = childTurn || parentPairs === 0;
    if (takesPairs)
      first = [...known].find(([i, l]) => !matched.has(i) && pairOf(l, i) !== undefined)?.[0];
    first ??= open.find((i) => !known.has(i)) ?? open[0];
    const a = await flip(page, first, rec);
    known.set(first, a);
    let second;
    if (takesPairs) second = pairOf(a, first) ?? open.find((i) => i !== first && !known.has(i));
    else
      second =
        open.find((i) => i !== first && known.has(i) && known.get(i) !== a) ??
        open.find((i) => i !== first && !known.has(i));
    const b = await flip(page, second, rec);
    known.set(second, b);
    rec.mark(a === b ? `match:${childTurn ? 'child' : 'parent'}` : 'miss');
    if (a === b) {
      matched.add(first);
      matched.add(second);
      if (!childTurn) parentPairs++;
    }
    await sleep(a === b ? 1500 : 1300);
  }
  const result = await page
    .getByText(/ wins!$/)
    .first()
    .textContent({ timeout: 10_000 });
  return result.replace(/ wins!$/, '').replace(/[\u200E⁨⁩]/g, '');
}

/** One two-phone game; true if Grandma (the browser guest) won. */
async function grandmaGame(browser, lang, grandmaName) {
  const host = await apiPlayer();
  const r0 = await photoRoom(host, 'tiny', 'Mom');
  const mom = await phone(browser, CAPTURE_URL, {
    players: playersStorage({ online: { name: 'Mom', avatar: 'fox' } }),
    [SESSION_KEY]: JSON.stringify(host.session),
  });
  await mom.page.goto(`/online/${r0.code}`, { waitUntil: 'networkidle' });
  await mom.page.getByText('Waiting for a friend…').waitFor({ timeout: 20_000 });
  // Grandma: the live web game in a browser, no account, nothing installed.
  const grandma = await phone(browser, WEB_URL);
  const momRec = await startRecording(mom.page, join(OUT, `grandma-mom.${lang}`));
  const grandmaRec = await startRecording(grandma.page, join(OUT, `grandma-browser.${lang}`));
  momRec.meta.code = r0.code;
  grandmaRec.meta.code = r0.code;
  await sleep(1200);
  grandmaRec.mark('open-link');
  log(`grandma ${lang}: opening the invite, room ${r0.code}`);
  await grandma.page.goto(`/join/?c=${r0.code}`, { waitUntil: 'networkidle' });
  await grandma.page.getByPlaceholder('Your nickname').waitFor({ timeout: 20_000 });
  await sleep(900);
  await grandma.page
    .getByPlaceholder('Your nickname')
    .pressSequentially(grandmaName, { delay: 110 });
  await sleep(300);
  await grandma.page
    .getByLabel(/owl/i)
    .first()
    .click()
    .catch(() => undefined);
  await sleep(500);
  grandmaRec.mark('join');
  momRec.mark('join');
  await grandma.page.getByRole('button', { name: 'Join the game' }).click();
  log(`grandma ${lang}: joined`);
  await waitForCards(mom.page, 6);
  await waitForCards(grandma.page, 6);
  momRec.mark('dealt');
  await sleep(6 * 35 + 1600);

  // Mom keeps missing; Grandma takes every pair she knows.
  const known = new Map();
  let r = await room(host.client, r0.id);
  for (let turn = 0; turn < 30 && r.status === 'playing'; turn++) {
    log(`grandma ${lang} turn ${turn}: seat ${r.current_player}, pairs ${r.pairs_found}`);
    if (r.current_player === 0) {
      momRec.mark('turn:mom');
      r = (await pageTurn(mom.page, host, r.id, missPair(known, r), known, momRec)).room;
    } else {
      grandmaRec.mark('turn:grandma');
      const open = openCards(r);
      const byImage = new Map();
      for (const i of open)
        if (known.has(i)) byImage.set(known.get(i), [...(byImage.get(known.get(i)) ?? []), i]);
      const pair = [...byImage.values()].find((p) => p.length === 2);
      const move = pair ?? missPair(known, r);
      const res = await pageTurn(grandma.page, host, r.id, move, known, grandmaRec);
      r = res.room;
    }
    await sleep(400);
  }
  await sleep(3500);
  const finished = await room(host.client, r0.id);
  log(
    `grandma ${lang}`,
    await momRec.stop(),
    await grandmaRec.stop(),
    'winner seat',
    finished.winner,
  );
  await mom.ctx.close();
  await grandma.ctx.close();
  await rpc(host.client, 'leave_room', { p_room_id: r0.id }).catch(() => undefined);
  return finished.winner === 1;
}

/** On a failure or a hang: a screenshot of every open phone, for the CI artifact. */
async function debugShots(browser, name) {
  const dir = join(OUT, '..', 'debug');
  mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) {
      await page
        .screenshot({ path: join(dir, `${name}-${n++}.png`), timeout: 5000 })
        .catch(() => undefined);
    }
  }
  log(`debug: ${n} screenshots in out/debug`);
}

const CLIP_LIMIT_MS = 15 * 60_000;
const wanted = process.argv.slice(2);
const browser = await chromium.launch();
try {
  for (const name of wanted.length ? wanted : Object.keys(clips)) {
    if (!clips[name]) throw new Error(`unknown clip ${name}`);
    log(`== ${name}`);
    let timer;
    const watchdog = new Promise((_, fail) => {
      timer = setTimeout(
        () => fail(new Error(`${name}: still running after 15 min`)),
        CLIP_LIMIT_MS,
      );
    });
    try {
      await Promise.race([clips[name](browser), watchdog]);
    } catch (error) {
      log(`!! ${name} failed: ${error.stack ?? error}`);
      await debugShots(browser, name);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
} finally {
  await browser.close();
}
