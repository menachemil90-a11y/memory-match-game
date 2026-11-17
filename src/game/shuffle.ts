import type { RandomSource } from './rng';

/** Fisher–Yates (Durstenfeld) shuffle. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], rng: RandomSource): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/** Uniformly random subset of `count` items (partial Fisher–Yates), in random order. */
export function sample<T>(items: readonly T[], count: number, rng: RandomSource): T[] {
  if (count < 0 || count > items.length) {
    throw new RangeError(`Cannot sample ${count} of ${items.length} items`);
  }
  const pool = items.slice();
  for (let i = 0; i < count; i++) {
    const j = i + rng.nextInt(pool.length - i);
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}
