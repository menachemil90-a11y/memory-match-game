/** @jest-environment node */
import { createRandomSource } from '..';

import { chiSquare, secureRng, seededRng } from './helpers';

describe('createRandomSource', () => {
  it('returns integers within [0, max)', () => {
    const rng = secureRng();
    for (const max of [1, 2, 3, 7, 10, 36, 1000, 2 ** 31, 2 ** 32]) {
      for (let i = 0; i < 200; i++) {
        const v = rng.nextInt(max);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(max);
      }
    }
  });

  it('is statistically uniform for a non power-of-two range', () => {
    const rng = secureRng();
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60000; i++) counts[rng.nextInt(6)]!++;
    // 5 degrees of freedom: p = 0.001 critical value ≈ 20.5
    expect(chiSquare(counts)).toBeLessThan(20.5);
  });

  it('rejects biased values instead of using a plain modulo', () => {
    // Bytes: first uint32 = 0xFFFFFFFF (≥ limit for max=3, must be rejected), then 5.
    const chunks = [
      [0xff, 0xff, 0xff, 0xff],
      [0, 0, 0, 5],
    ];
    let call = 0;
    const rng = createRandomSource(() => new Uint8Array(chunks[call++] ?? [0, 0, 0, 0]));
    expect(rng.nextInt(3)).toBe(5 % 3);
    expect(call).toBe(2);
  });

  it('throws on invalid ranges', () => {
    const rng = secureRng();
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
    expect(() => rng.nextInt(1.5)).toThrow(RangeError);
    expect(() => rng.nextInt(2 ** 32 + 1)).toThrow(RangeError);
  });

  it('is reproducible with a seeded byte source', () => {
    const a = seededRng('x');
    const b = seededRng('x');
    const seqA = Array.from({ length: 50 }, () => a.nextInt(1000));
    const seqB = Array.from({ length: 50 }, () => b.nextInt(1000));
    expect(seqA).toEqual(seqB);
  });
});
