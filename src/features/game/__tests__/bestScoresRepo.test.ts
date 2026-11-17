/** @jest-environment node */
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

import { bestScoresRepo } from '../bestScoresRepo';

describe('bestScoresRepo', () => {
  it('stores only better scores per board + level', async () => {
    const db = createTestDb();
    await migrate(db);
    expect(await bestScoresRepo.get(db, 'animals', 'easy')).toBeNull();
    expect(
      await bestScoresRepo.saveIfBetter(db, 'animals', 'easy', {
        moves: 12,
        timeMs: 50000,
        stars: 2,
      }),
    ).toBe(true);
    expect(
      await bestScoresRepo.saveIfBetter(db, 'animals', 'easy', {
        moves: 14,
        timeMs: 1000,
        stars: 2,
      }),
    ).toBe(false);
    expect(
      await bestScoresRepo.saveIfBetter(db, 'animals', 'easy', {
        moves: 9,
        timeMs: 70000,
        stars: 3,
      }),
    ).toBe(true);
    expect(await bestScoresRepo.get(db, 'animals', 'easy')).toEqual({
      moves: 9,
      timeMs: 70000,
      stars: 3,
    });
    await bestScoresRepo.saveIfBetter(db, 'animals', 'tiny', { moves: 4, timeMs: 9000, stars: 3 });
    expect(Object.keys(await bestScoresRepo.forBoard(db, 'animals')).sort()).toEqual([
      'easy',
      'tiny',
    ]);
    expect(await bestScoresRepo.forBoard(db, 'space')).toEqual({});
    await bestScoresRepo.clearAll(db);
    expect(await bestScoresRepo.get(db, 'animals', 'easy')).toBeNull();
  });
});
