/** @jest-environment node */
import { sample, shuffle } from '..';

import { chiSquare, secureRng } from './helpers';

describe('shuffle (Fisher–Yates)', () => {
  it('returns a permutation and does not mutate the input', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = shuffle(input, secureRng());
    expect(out).not.toBe(input);
    expect([...out].sort()).toEqual([...input]);
  });

  it('handles empty and single-item arrays', () => {
    expect(shuffle([], secureRng())).toEqual([]);
    expect(shuffle(['a'], secureRng())).toEqual(['a']);
  });

  it('produces all permutations uniformly', () => {
    const rng = secureRng();
    const counts = new Map<string, number>();
    for (let i = 0; i < 24000; i++) {
      const key = shuffle(['a', 'b', 'c', 'd'], rng).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(24);
    // 23 dof: p = 0.001 critical ≈ 49.7
    expect(chiSquare([...counts.values()])).toBeLessThan(49.7);
  });
});

describe('sample', () => {
  it('returns distinct items of the requested size', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const out = sample(items, 18, secureRng());
    expect(out).toHaveLength(18);
    expect(new Set(out).size).toBe(18);
    out.forEach((v) => expect(items).toContain(v));
  });

  it('picks every item with equal probability', () => {
    const rng = secureRng();
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i++)
      for (const v of sample([...counts.keys()], 3, rng)) counts[v]!++;
    expect(chiSquare(counts)).toBeLessThan(27.9); // 9 dof, p = 0.001
  });

  it('throws when asking for too many items', () => {
    expect(() => sample([1, 2], 3, secureRng())).toThrow(RangeError);
    expect(() => sample([1, 2], -1, secureRng())).toThrow(RangeError);
  });
});
