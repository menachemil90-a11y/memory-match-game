/** @jest-environment node */
import { enumerateLayouts, hashLayout, RECENT_LAYOUTS_TO_AVOID } from '@/game';
import { imageIds, secureRng, sha256 } from '@/game/__tests__/helpers';
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

import { dealNewLayout } from '../dealService';
import { layoutHistoryRepo } from '../layoutHistoryRepo';

async function setup() {
  const db = createTestDb();
  await migrate(db);
  return { db, rng: secureRng(), hash: sha256 };
}

describe('dealNewLayout (with SQLite history)', () => {
  it('never deals a repeated tiny layout across 90 games, then resets safely', async () => {
    const deps = await setup();
    const req = { boardId: 'b1', levelId: 'tiny' as const, imageIds: imageIds(3) };
    const seen = new Set<string>();
    for (let i = 0; i < 90; i++) seen.add((await dealNewLayout(deps, req)).join());
    expect(seen.size).toBe(90);
    expect(await layoutHistoryRepo.load(deps.db, 'b1', 'tiny')).toHaveLength(90);

    const lastTen = (await layoutHistoryRepo.load(deps.db, 'b1', 'tiny')).slice(
      -RECENT_LAYOUTS_TO_AVOID,
    );
    const next = await dealNewLayout(deps, req);
    expect(lastTen).not.toContain(await hashLayout(next, sha256));
    expect(await layoutHistoryRepo.load(deps.db, 'b1', 'tiny')).toHaveLength(
      RECENT_LAYOUTS_TO_AVOID + 1,
    );
  });

  it('keeps separate histories per board and level', async () => {
    const deps = await setup();
    const all = enumerateLayouts(imageIds(3), 3);
    const hashes = await Promise.all(all.map((l) => hashLayout(l, sha256)));
    for (const h of hashes.slice(0, 89)) {
      await layoutHistoryRepo.record(deps.db, 'b1', 'tiny', {
        hash: h,
        history: [],
        historyWasReset: false,
      });
    }
    // b1 has exactly one unused layout left.
    const last = await dealNewLayout(deps, {
      boardId: 'b1',
      levelId: 'tiny',
      imageIds: imageIds(3),
    });
    expect(await hashLayout(last, sha256)).toBe(hashes[89]);
    // b2 is unaffected.
    await dealNewLayout(deps, { boardId: 'b2', levelId: 'tiny', imageIds: imageIds(3) });
    expect(await layoutHistoryRepo.load(deps.db, 'b2', 'tiny')).toHaveLength(1);
    expect(await layoutHistoryRepo.load(deps.db, 'b1', 'easy')).toHaveLength(0);
  });

  it('clears history per board', async () => {
    const deps = await setup();
    await dealNewLayout(deps, { boardId: 'b1', levelId: 'easy', imageIds: imageIds(12) });
    await dealNewLayout(deps, { boardId: 'b2', levelId: 'easy', imageIds: imageIds(12) });
    await layoutHistoryRepo.clearBoard(deps.db, 'b1');
    expect(await layoutHistoryRepo.load(deps.db, 'b1', 'easy')).toEqual([]);
    expect(await layoutHistoryRepo.load(deps.db, 'b2', 'easy')).toHaveLength(1);
    await layoutHistoryRepo.clearAll(deps.db);
    expect(await layoutHistoryRepo.load(deps.db, 'b2', 'easy')).toEqual([]);
  });
});
