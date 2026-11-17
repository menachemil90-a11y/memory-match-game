/** @jest-environment node */
import { isBetterScore, maxMovesForStars, starRating } from '..';

describe('star rating', () => {
  it('gives 3 stars for near-perfect play and fewer as moves grow', () => {
    // 8 pairs → 3★ ≤ 14 moves, 2★ ≤ 20 moves
    expect(maxMovesForStars(8)).toEqual({ three: 14, two: 20 });
    expect(starRating(8, 8)).toBe(3);
    expect(starRating(14, 8)).toBe(3);
    expect(starRating(15, 8)).toBe(2);
    expect(starRating(20, 8)).toBe(2);
    expect(starRating(21, 8)).toBe(1);
    expect(starRating(500, 8)).toBe(1);
  });

  it('works for the smallest level', () => {
    expect(maxMovesForStars(3)).toEqual({ three: 6, two: 8 });
    expect(starRating(3, 3)).toBe(3);
  });

  it('rejects invalid pair counts', () => {
    expect(() => starRating(3, 0)).toThrow(RangeError);
  });
});

describe('isBetterScore', () => {
  const base = { stars: 2 as const, moves: 15, timeMs: 60000 };
  it('prefers more stars, then fewer moves, then less time', () => {
    expect(isBetterScore(base, null)).toBe(true);
    expect(isBetterScore({ ...base, stars: 3 }, base)).toBe(true);
    expect(isBetterScore({ ...base, stars: 1, moves: 1 }, base)).toBe(false);
    expect(isBetterScore({ ...base, moves: 14 }, base)).toBe(true);
    expect(isBetterScore({ ...base, moves: 16, timeMs: 1 }, base)).toBe(false);
    expect(isBetterScore({ ...base, timeMs: 59000 }, base)).toBe(true);
    expect(isBetterScore(base, base)).toBe(false);
  });
});
