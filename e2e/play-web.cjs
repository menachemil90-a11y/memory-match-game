const { chromium } = require('playwright');
const OUT = process.argv[2];
async function playGame(p, cardCount, shotPrefix) {
  const known = new Map(); // index -> label
  const matched = new Set();
  const labelOf = async (i) => {
    const el = p.locator(`[aria-label^="Card ${i + 1},"]`).first();
    if ((await el.count()) === 0) return null;
    return (await el.getAttribute('aria-label')).replace(/^Card \d+, /, '');
  };
  const flip = async (i) => {
    await p
      .locator(`[aria-label^="Card ${i + 1},"]`)
      .first()
      .click();
    await p.waitForTimeout(380);
    const l = await labelOf(i);
    known.set(i, l);
    return l;
  };
  let turns = 0,
    shots = 0;
  while (matched.size < cardCount && turns < 200) {
    turns++;
    const down = [];
    for (let i = 0; i < cardCount; i++) if (!matched.has(i)) down.push(i);
    // known pair?
    const byLabel = new Map();
    let pair = null;
    for (const i of down) {
      const l = known.get(i);
      if (l && l !== 'face down') {
        if (byLabel.has(l)) {
          pair = [byLabel.get(l), i];
          break;
        }
        byLabel.set(l, i);
      }
    }
    let a, b;
    if (pair) {
      [a, b] = pair;
      await flip(a);
      await flip(b);
    } else {
      a = down.find((i) => !known.has(i)) ?? down[0];
      const la = await flip(a);
      const partner = down.find((i) => i !== a && known.get(i) === la);
      b = partner ?? down.find((i) => i !== a && !known.has(i)) ?? down.find((i) => i !== a);
      await flip(b);
    }
    if (shots < 2 && turns === 2) {
      await p.screenshot({ path: `${OUT}/${shotPrefix}-mid.png` });
      shots++;
    }
    if (known.get(a) === known.get(b)) {
      matched.add(a);
      matched.add(b);
      if (shots < 2 && matched.size === 2) {
        await p.waitForTimeout(500);
        await p.screenshot({ path: `${OUT}/${shotPrefix}-match.png` });
        shots++;
      }
      await p.waitForTimeout(1100);
    } else {
      known.set(a, known.get(a)); // keep memory
      await p.waitForTimeout(450);
      await p.mouse.click(200, 400); // tap board to skip delay
      await p.waitForTimeout(500);
    }
  }
  return turns;
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await p.goto('http://localhost:8099/');
  await p.waitForTimeout(2000);
  await p.getByRole('button', { name: 'Solo' }).click();
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: /^Animals,/ }).click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/levels.png` });
  await p.getByRole('button', { name: /^Easy, 6 pairs/ }).click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/solo-start.png` });
  const turns = await playGame(p, 12, 'solo');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/solo-results.png` });
  console.log('solo turns', turns);
  // play again -> new layout
  await p.getByRole('button', { name: 'Play again' }).click();
  await p.waitForTimeout(2500);
  console.log('replay cards', await p.locator('[aria-label^="Card "]').count());
  // 2 players
  await p.goto('http://localhost:8099/');
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: '2 Players' }).click();
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: /^Animals,/ }).click();
  await p.waitForTimeout(1000);
  await p.getByRole('button', { name: /^Tiny, 3 pairs/ }).click();
  await p.waitForTimeout(1000);
  await p.locator('input').nth(0).fill('Noa');
  await p.locator('input').nth(1).fill('Avi');
  await p.getByRole('switch', { name: 'Tabletop mode' }).click();
  await p.screenshot({ path: `${OUT}/setup.png`, fullPage: true });
  await p.getByRole('button', { name: "Let's play!" }).click();
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${OUT}/2p-start.png` });
  const t2 = await playGame(p, 6, '2p');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/2p-results.png` });
  console.log('2p turns', t2);
  console.log(errors.slice(0, 15).join('\n') || 'no errors');
  await b.close();
})();
