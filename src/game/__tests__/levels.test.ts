/** @jest-environment node */
import {
  LEVELS,
  getLevel,
  getLevelAvailability,
  isLevelId,
  isLevelUnlocked,
  nextLockedLevel,
} from '..';

describe('levels', () => {
  it('matches the brief: pairs and portrait grids', () => {
    expect(LEVELS.map((l) => [l.id, l.pairs, `${l.cols}x${l.rows}`])).toEqual([
      ['tiny', 3, '2x3'],
      ['easy', 6, '3x4'],
      ['medium', 8, '4x4'],
      ['tricky', 10, '4x5'],
      ['hard', 12, '4x6'],
      ['expert', 18, '6x6'],
    ]);
  });

  it('every grid holds exactly two cards per pair, portrait or square', () => {
    for (const level of LEVELS) {
      expect(level.cols * level.rows).toBe(level.pairs * 2);
      expect(level.rows).toBeGreaterThanOrEqual(level.cols);
    }
  });

  it('looks up levels and validates ids', () => {
    expect(getLevel('hard').pairs).toBe(12);
    expect(isLevelId('expert')).toBe(true);
    expect(isLevelId('impossible')).toBe(false);
    expect(isLevelId(3)).toBe(false);
    // @ts-expect-error invalid id on purpose
    expect(() => getLevel('nope')).toThrow();
  });

  it('locks levels that need more images than the board has', () => {
    const availability = getLevelAvailability(10);
    expect(availability.map((a) => [a.level.id, a.locked, a.missingImages])).toEqual([
      ['tiny', false, 0],
      ['easy', false, 0],
      ['medium', false, 0],
      ['tricky', false, 0],
      ['hard', true, 2],
      ['expert', true, 8],
    ]);
    expect(isLevelUnlocked('tricky', 10)).toBe(true);
    expect(isLevelUnlocked('hard', 10)).toBe(false);
  });

  it('reports the next locked level for the "add N more photos" hint', () => {
    expect(nextLockedLevel(10)).toMatchObject({ level: { id: 'hard' }, missingImages: 2 });
    expect(nextLockedLevel(2)).toMatchObject({ level: { id: 'tiny' }, missingImages: 1 });
    expect(nextLockedLevel(18)).toBeNull();
    expect(nextLockedLevel(30)).toBeNull();
  });
});
