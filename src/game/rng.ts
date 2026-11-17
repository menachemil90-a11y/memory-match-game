/**
 * Cryptographically secure random integers.
 *
 * The engine never touches a platform API directly: the caller injects a
 * function that returns secure random bytes (expo-crypto in the app,
 * node:crypto in tests, Web Crypto on the server).
 */

export type RandomBytesFn = (byteCount: number) => Uint8Array;

export interface RandomSource {
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

const UINT32_RANGE = 0x1_0000_0000;
const POOL_SIZE = 256;

/**
 * Builds a RandomSource from a secure byte generator. Uses rejection sampling,
 * so results are unbiased for any range (no modulo bias).
 */
export function createRandomSource(randomBytes: RandomBytesFn): RandomSource {
  let pool: Uint8Array = new Uint8Array(0);
  let offset = 0;

  const nextUint32 = (): number => {
    if (offset + 4 > pool.length) {
      pool = randomBytes(POOL_SIZE);
      if (pool.length < 4) throw new Error('randomBytes returned too few bytes');
      offset = 0;
    }
    const value =
      (pool[offset]! * 0x1000000 +
        (pool[offset + 1]! << 16) +
        (pool[offset + 2]! << 8) +
        pool[offset + 3]!) >>>
      0;
    offset += 4;
    return value;
  };

  return {
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
        throw new RangeError(`maxExclusive must be an integer in [1, 2^32], got ${maxExclusive}`);
      }
      // Largest multiple of maxExclusive that fits in the uint32 range.
      const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
      for (;;) {
        const value = nextUint32();
        if (value < limit) return value % maxExclusive;
      }
    },
  };
}
