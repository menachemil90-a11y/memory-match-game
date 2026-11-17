import { createHash, randomBytes } from 'node:crypto';

import { createRandomSource, type Hasher, type RandomSource } from '..';

/** Real SHA-256, as used in production. */
export const sha256: Hasher = async (input) => createHash('sha256').update(input).digest('hex');

/** Secure RNG backed by node:crypto. */
export function secureRng(): RandomSource {
  return createRandomSource((n) => new Uint8Array(randomBytes(n)));
}

/** Deterministic byte stream (SHA-256 in counter mode) for reproducible tests. */
export function seededRng(seed: string): RandomSource {
  let counter = 0;
  return createRandomSource((n) => {
    const out = new Uint8Array(n);
    let filled = 0;
    while (filled < n) {
      const block = createHash('sha256').update(`${seed}:${counter++}`).digest();
      const take = Math.min(block.length, n - filled);
      out.set(block.subarray(0, take), filled);
      filled += take;
    }
    return out;
  });
}

export function imageIds(count: number, prefix = 'img'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

/** Chi-square statistic for observed counts against a uniform expectation. */
export function chiSquare(counts: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = total / counts.length;
  return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
}
