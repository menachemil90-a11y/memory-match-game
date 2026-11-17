// Captures raw Google Play screenshots (1080×1920, portrait 9:16) from the web
// build. Usage (see e2e/README.md):
//   node e2e/store-screenshots.cjs <out-dir>
// Native-only effects (Skia confetti, haptics) don't render on web; the photo
// board shots must come from a real phone (web can't import photos).
const { chromium } = require('playwright');

const OUT = process.argv[2];
const BASE = 'http://localhost:8099/';
const wait = (p, ms) => p.waitForTimeout(ms);

async function labelOf(p, i) {
  const el = p.locator(`[aria-label^="Card ${i + 1},"]`).first();
  if ((await el.count()) === 0) return null;
  return (await el.getAttribute('aria-label')).replace(/^Card \d+, /, '');
}

async function flip(p, i) {
  await p
    .locator(`[aria-label^="Card ${i + 1},"]`)
    .first()
    .click();
  await wait(p, 420);
  return labelOf(p, i);
}

/**
 * Plays with perfect memory. `onTurn(turn, matchedCount, isMatch)` runs after
 * each pair is revealed (before it resolves) so callers can take a screenshot;
 * returning 'stop' ends the game loop.
 */
async function play(p, cardCount, onTurn, { pauseBeforeTurn = Infinity, maxTurns = 200 } = {}) {
  const known = new Map();
  const matched = new Set();
  let turn = 0;
  while (matched.size < cardCount && turn < maxTurns) {
    turn++;
    // Lets the "X's turn!" banner fade out before a screenshot turn.
    if (turn >= pauseBeforeTurn) await wait(p, 1800);
    const down = [];
    for (let i = 0; i < cardCount; i++) if (!matched.has(i)) down.push(i);
    const seen = new Map();
    let pair = null;
    for (const i of down) {
      const l = known.get(i);
      if (!l) continue;
      if (seen.has(l)) {
        pair = [seen.get(l), i];
        break;
      }
      seen.set(l, i);
    }
    let a, b;
    if (pair) {
      [a, b] = pair;
      known.set(a, await flip(p, a));
      known.set(b, await flip(p, b));
    } else {
      a = down.find((i) => !known.has(i)) ?? down[0];
      const la = await flip(p, a);
      known.set(a, la);
      b =
        down.find((i) => i !== a && known.get(i) === la) ??
        down.find((i) => i !== a && !known.has(i)) ??
        down.find((i) => i !== a);
      known.set(b, await flip(p, b));
    }
    const isMatch = known.get(a) === known.get(b);
    if (onTurn && (await onTurn(turn, matched.size, isMatch)) === 'stop') return turn;
    if (isMatch) {
      matched.add(a);
      matched.add(b);
      await wait(p, 1200);
    } else {
      await wait(p, 300);
      await p.mouse.click(180, 330); // tap the board to skip the mismatch delay
      await wait(p, 550);
    }
  }
  return turn;
}

async function goHome(p) {
  await p.goto(BASE);
  await wait(p, 2200);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3, // → 1080 × 1920
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  const shot = (name) => p.screenshot({ path: `${OUT}/${name}.png` });

  // 1. Home
  await goHome(p);
  await shot('01-home');

  // 2. Board picker
  await p.getByRole('button', { name: 'Solo' }).click();
  await wait(p, 1500);
  await shot('02-boards');

  // 3. Levels (Ocean)
  await p.getByRole('button', { name: /^Ocean,/ }).click();
  await wait(p, 1200);
  await shot('03-levels');

  // 4. Game in progress (Ocean, Medium 4×4): a pair found, two different cards open.
  await p.getByRole('button', { name: /^Medium, 8 pairs/ }).click();
  await wait(p, 3000);
  await play(p, 16, async (turn, matchedCount, isMatch) => {
    if (matchedCount >= 2 && !isMatch) {
      await wait(p, 150);
      await shot('04-game');
      return 'stop';
    }
    return undefined;
  });

  // 5. Results (Animals, Easy — perfect memory gives 3 stars)
  await goHome(p);
  await p.getByRole('button', { name: 'Solo' }).click();
  await wait(p, 1200);
  await p.getByRole('button', { name: /^Animals,/ }).click();
  await wait(p, 1000);
  await p.getByRole('button', { name: /^Easy, 6 pairs/ }).click();
  await wait(p, 3000);
  await play(p, 12);
  await wait(p, 2800);
  await shot('05-results');

  // 6. Two players on one phone (Space, Easy)
  await goHome(p);
  await p.getByRole('button', { name: '2 Players' }).click();
  await wait(p, 1200);
  await p.getByRole('button', { name: /^Space,/ }).click();
  await wait(p, 1000);
  await p.getByRole('button', { name: /^Easy, 6 pairs/ }).click();
  await wait(p, 1000);
  await p.locator('input').nth(0).fill('Noa');
  await p.locator('input').nth(1).fill('Avi');
  await shot('06-setup');
  await p.getByRole('button', { name: "Let's play!" }).click();
  await wait(p, 3000);
  await play(
    p,
    12,
    async (turn, matchedCount, isMatch) => {
      if (turn >= 4 && matchedCount >= 2 && !isMatch) {
        await wait(p, 150);
        await shot('07-two-players');
        return 'stop';
      }
      return undefined;
    },
    { pauseBeforeTurn: 4 },
  );

  console.log(errors.slice(0, 15).join('\n') || 'no page errors');
  await browser.close();
  const fs = require('node:fs');
  const expected = [
    '01-home',
    '02-boards',
    '03-levels',
    '04-game',
    '05-results',
    '06-setup',
    '07-two-players',
  ];
  const missing = expected.filter((n) => !fs.existsSync(`${OUT}/${n}.png`));
  if (missing.length) {
    console.error(
      'Missing screenshots (a game ended before the capture moment):',
      missing.join(', '),
    );
    process.exit(1);
  }
})();
