/** @jest-environment node */
import {
  RECENT_LAYOUTS_TO_AVOID,
  countPossibleLayouts,
  dealUniqueLayout,
  enumerateLayouts,
  hashLayout,
  randomLayout,
  type Hasher,
} from '..';

import { imageIds, secureRng, seededRng, sha256 } from './helpers';

function expectValidLayout(layout: readonly string[], pairs: number, pool: readonly string[]) {
  expect(layout).toHaveLength(pairs * 2);
  const counts = new Map<string, number>();
  for (const id of layout) counts.set(id, (counts.get(id) ?? 0) + 1);
  expect(counts.size).toBe(pairs);
  for (const [id, count] of counts) {
    expect(count).toBe(2);
    expect(pool).toContain(id);
  }
}

describe('countPossibleLayouts', () => {
  it('matches the brief: 3 images at 3 pairs → 90 layouts', () => {
    expect(countPossibleLayouts(3, 3)).toBe(90n);
  });

  it('counts image subsets too', () => {
    expect(countPossibleLayouts(4, 3)).toBe(360n); // C(4,3) · 90
    expect(countPossibleLayouts(2, 3)).toBe(0n);
  });

  it('is astronomically large for big levels', () => {
    expect(countPossibleLayouts(18, 18)).toBeGreaterThan(10n ** 35n);
    expect(countPossibleLayouts(30, 18)).toBeGreaterThan(countPossibleLayouts(18, 18));
  });
});

describe('enumerateLayouts', () => {
  it('lists every distinct layout exactly once', () => {
    const all = enumerateLayouts(imageIds(3), 3);
    expect(all).toHaveLength(90);
    expect(new Set(all.map((l) => l.join())).size).toBe(90);
    all.forEach((l) => expectValidLayout(l, 3, imageIds(3)));
  });

  it('agrees with the counting formula when there are spare images', () => {
    expect(enumerateLayouts(imageIds(5), 3)).toHaveLength(Number(countPossibleLayouts(5, 3)));
  });
});

describe('randomLayout', () => {
  it('uses a random subset when the board has more images than needed', () => {
    const pool = imageIds(30);
    const rng = secureRng();
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const layout = randomLayout(pool, 6, rng);
      expectValidLayout(layout, 6, pool);
      layout.forEach((id) => seen.add(id));
    }
    // 50 games × 6 images from 30 → practically every image appears.
    expect(seen.size).toBeGreaterThan(25);
  });
});

describe('dealUniqueLayout', () => {
  it('never repeats a layout until all 90 tiny layouts are used', async () => {
    const rng = secureRng();
    let history: string[] = [];
    const layouts = new Set<string>();
    for (let i = 0; i < 90; i++) {
      const result = await dealUniqueLayout({
        imageIds: imageIds(3),
        pairs: 3,
        history,
        rng,
        hash: sha256,
      });
      expect(result.historyWasReset).toBe(false);
      expectValidLayout(result.layout, 3, imageIds(3));
      expect(result.hash).toBe(await hashLayout(result.layout, sha256));
      layouts.add(result.layout.join());
      history = result.history;
    }
    expect(layouts.size).toBe(90);
    expect(history).toHaveLength(90);
  });

  it('resets when exhausted but still avoids the last 10 layouts', async () => {
    const all = enumerateLayouts(imageIds(3), 3);
    const history = await Promise.all(all.map((l) => hashLayout(l, sha256)));
    const lastTen = new Set(history.slice(-RECENT_LAYOUTS_TO_AVOID));

    for (let i = 0; i < 40; i++) {
      const result = await dealUniqueLayout({
        imageIds: imageIds(3),
        pairs: 3,
        history,
        rng: secureRng(),
        hash: sha256,
      });
      expect(result.historyWasReset).toBe(true);
      expect(lastTen.has(result.hash)).toBe(false);
      expect(result.history).toEqual([...lastTen, result.hash]);
    }
  });

  it('keeps avoiding repeats after a reset', async () => {
    const all = enumerateLayouts(imageIds(3), 3);
    let history = await Promise.all(all.map((l) => hashLayout(l, sha256)));
    const rng = secureRng();
    const afterReset: string[] = [];
    for (let i = 0; i < 80; i++) {
      const result = await dealUniqueLayout({
        imageIds: imageIds(3),
        pairs: 3,
        history,
        rng,
        hash: sha256,
      });
      afterReset.push(result.hash);
      history = result.history;
    }
    // 10 kept + 80 new = 90 → none repeated
    expect(new Set([...afterReset, ...all.slice(0, 0)]).size).toBe(80);
    expect(new Set(history).size).toBe(90);
  });

  it('picks uniformly among unused layouts in small spaces', async () => {
    const all = enumerateLayouts(imageIds(3), 3);
    const hashes = await Promise.all(all.map((l) => hashLayout(l, sha256)));
    // Leave exactly 2 unused layouts.
    const unused = hashes.slice(0, 2);
    const history = hashes.slice(2);
    const counts = new Map<string, number>();
    const rng = secureRng();
    for (let i = 0; i < 400; i++) {
      const r = await dealUniqueLayout({
        imageIds: imageIds(3),
        pairs: 3,
        history,
        rng,
        hash: sha256,
      });
      expect(unused).toContain(r.hash);
      counts.set(r.hash, (counts.get(r.hash) ?? 0) + 1);
    }
    expect(counts.size).toBe(2);
    for (const c of counts.values()) expect(c).toBeGreaterThan(140);
  });

  it('never repeats on large levels and re-shuffles on a hash collision', async () => {
    const pool = imageIds(24);
    // The layout a seeded RNG produces first…
    const firstLayout = randomLayout(pool, 18, seededRng('collide'));
    const firstHash = await hashLayout(firstLayout, sha256);
    // …is already in the history, so the same seed must produce something else.
    const result = await dealUniqueLayout({
      imageIds: pool,
      pairs: 18,
      history: [firstHash],
      rng: seededRng('collide'),
      hash: sha256,
    });
    expect(result.hash).not.toBe(firstHash);
    expect(result.layout).not.toEqual(firstLayout);
    expectValidLayout(result.layout, 18, pool);
  });

  it('deals 300 distinct expert boards in a row', async () => {
    const rng = secureRng();
    let history: string[] = [];
    for (let i = 0; i < 300; i++) {
      history = (
        await dealUniqueLayout({ imageIds: imageIds(24), pairs: 18, history, rng, hash: sha256 })
      ).history;
    }
    expect(new Set(history).size).toBe(300);
  });

  it('counts calls to the hasher lazily for small spaces', async () => {
    let calls = 0;
    const counting: Hasher = async (s) => {
      calls++;
      return sha256(s);
    };
    await dealUniqueLayout({
      imageIds: imageIds(3),
      pairs: 3,
      history: [],
      rng: secureRng(),
      hash: counting,
    });
    expect(calls).toBe(1);
  });

  it('gives up instead of looping forever if the hasher is broken', async () => {
    const constant: Hasher = async () => 'same';
    await expect(
      dealUniqueLayout({
        imageIds: imageIds(24),
        pairs: 18,
        history: ['same'],
        rng: secureRng(),
        hash: constant,
        maxAttempts: 5,
      }),
    ).rejects.toThrow('Could not find an unused layout');
  });

  it('validates its input', async () => {
    const base = { history: [], rng: secureRng(), hash: sha256 };
    await expect(dealUniqueLayout({ ...base, imageIds: imageIds(2), pairs: 3 })).rejects.toThrow(
      RangeError,
    );
    await expect(
      dealUniqueLayout({ ...base, imageIds: ['a', 'a', 'b', 'c'], pairs: 3 }),
    ).rejects.toThrow('distinct');
    await expect(dealUniqueLayout({ ...base, imageIds: imageIds(3), pairs: 0 })).rejects.toThrow(
      RangeError,
    );
  });

  it('ignores duplicate hashes stored in the history', async () => {
    const r = await dealUniqueLayout({
      imageIds: imageIds(3),
      pairs: 3,
      history: ['a', 'a', 'b'],
      rng: secureRng(),
      hash: sha256,
    });
    expect(r.history).toEqual(['a', 'b', r.hash]);
  });
});
