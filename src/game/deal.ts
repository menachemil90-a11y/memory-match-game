import type { RandomSource } from './rng';
import { sample, shuffle } from './shuffle';
import type { ImageId, Layout } from './types';

/** SHA-256 (hex) of a string. Injected: expo-crypto in the app, node:crypto in tests. */
export type Hasher = (input: string) => Promise<string>;

/** After the layout space is exhausted, the most recent layouts that stay forbidden. */
export const RECENT_LAYOUTS_TO_AVOID = 10;

/** Spaces at or below this size are enumerated exactly instead of retried randomly. */
export const DEFAULT_ENUMERATION_LIMIT = 5000;

/** Random retries before treating a large space as exhausted (practically unreachable). */
export const DEFAULT_MAX_ATTEMPTS = 1000;

export interface DealOptions {
  /** All distinct image IDs available on the board. */
  imageIds: readonly ImageId[];
  /** Pairs needed by the level. */
  pairs: number;
  /** Hashes of layouts already played for this (board, level), oldest first. */
  history: readonly string[];
  rng: RandomSource;
  hash: Hasher;
  maxAttempts?: number;
  enumerationLimit?: number;
}

export interface DealResult {
  layout: ImageId[];
  hash: string;
  /** The updated history to persist (includes `hash` as the newest entry). */
  history: string[];
  /** True when every possible layout had been played and the history was reset. */
  historyWasReset: boolean;
}

/** Stable string form of a layout, hashed for the history. */
export function serializeLayout(layout: Layout): string {
  return JSON.stringify(layout);
}

export function hashLayout(layout: Layout, hash: Hasher): Promise<string> {
  return hash(serializeLayout(layout));
}

function binomial(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let result = 1n;
  const kk = Math.min(k, n - k);
  for (let i = 1; i <= kk; i++) {
    result = (result * BigInt(n - kk + i)) / BigInt(i);
  }
  return result;
}

function factorial(n: number): bigint {
  let result = 1n;
  for (let i = 2; i <= n; i++) result *= BigInt(i);
  return result;
}

/**
 * Number of distinct layouts for a board with `imageCount` images at a level
 * with `pairs` pairs: C(imageCount, pairs) · (2·pairs)! / 2^pairs.
 * E.g. 3 images, 3 pairs → 6!/(2!)³ = 90.
 */
export function countPossibleLayouts(imageCount: number, pairs: number): bigint {
  return (binomial(imageCount, pairs) * factorial(2 * pairs)) / 2n ** BigInt(pairs);
}

/** One uniformly random layout: random subset of images, doubled, shuffled. */
export function randomLayout(
  imageIds: readonly ImageId[],
  pairs: number,
  rng: RandomSource,
): ImageId[] {
  const chosen = sample(imageIds, pairs, rng);
  return shuffle([...chosen, ...chosen], rng);
}

function* combinations<T>(
  items: readonly T[],
  k: number,
  start = 0,
  acc: T[] = [],
): Generator<T[]> {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= items.length - (k - acc.length); i++) {
    acc.push(items[i]!);
    yield* combinations(items, k, i + 1, acc);
    acc.pop();
  }
}

/** All distinct orderings where every chosen image appears exactly twice. */
function* pairPermutations(chosen: readonly ImageId[]): Generator<ImageId[]> {
  const remaining = new Map<ImageId, number>(chosen.map((id) => [id, 2]));
  const total = chosen.length * 2;
  const current: ImageId[] = [];
  function* step(): Generator<ImageId[]> {
    if (current.length === total) {
      yield current.slice();
      return;
    }
    for (const [id, count] of remaining) {
      if (count === 0) continue;
      remaining.set(id, count - 1);
      current.push(id);
      yield* step();
      current.pop();
      remaining.set(id, count);
    }
  }
  yield* step();
}

/** Every possible layout (only use for small spaces). */
export function enumerateLayouts(imageIds: readonly ImageId[], pairs: number): ImageId[][] {
  const result: ImageId[][] = [];
  for (const chosen of combinations(imageIds, pairs)) {
    for (const layout of pairPermutations(chosen)) result.push(layout);
  }
  return result;
}

function validate(imageIds: readonly ImageId[], pairs: number): void {
  if (!Number.isInteger(pairs) || pairs < 1) throw new RangeError(`Invalid pair count: ${pairs}`);
  if (new Set(imageIds).size !== imageIds.length) {
    throw new Error('Board image IDs must be distinct');
  }
  if (imageIds.length < pairs) {
    throw new RangeError(`Board has ${imageIds.length} images but the level needs ${pairs}`);
  }
}

/**
 * Deals a layout the player has never seen for this (board, level).
 *
 * - Small spaces (≤ `enumerationLimit` layouts) are enumerated, so the choice
 *   is exact and uniform among unused layouts.
 * - Large spaces use random retries against the stored hashes.
 * - When every layout has been played, the history resets but the last
 *   {@link RECENT_LAYOUTS_TO_AVOID} layouts stay forbidden.
 */
export async function dealUniqueLayout(options: DealOptions): Promise<DealResult> {
  const {
    imageIds,
    pairs,
    rng,
    hash,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    enumerationLimit = DEFAULT_ENUMERATION_LIMIT,
  } = options;
  validate(imageIds, pairs);

  const total = countPossibleLayouts(imageIds.length, pairs);
  let history = [...new Set(options.history)];
  let historyWasReset = false;

  const resetHistory = () => {
    history = history.slice(-RECENT_LAYOUTS_TO_AVOID);
    historyWasReset = true;
  };

  if (BigInt(history.length) >= total) resetHistory();

  const finish = (layout: ImageId[], layoutHash: string): DealResult => ({
    layout,
    hash: layoutHash,
    history: [...history, layoutHash],
    historyWasReset,
  });

  if (total <= BigInt(enumerationLimit)) {
    // Visit every layout in random order; hash lazily and take the first unused one.
    const all = shuffle(enumerateLayouts(imageIds, pairs), rng);
    for (let pass = 0; pass < 2; pass++) {
      const used = new Set(history);
      for (const layout of all) {
        const layoutHash = await hashLayout(layout, hash);
        if (!used.has(layoutHash)) return finish(layout, layoutHash);
      }
      // Every layout is in the history (e.g. duplicates were stored) → reset and retry once.
      resetHistory();
    }
    throw new Error('Could not find an unused layout');
  }

  let used = new Set(history);
  for (let attempt = 0; ; attempt++) {
    if (attempt === maxAttempts) {
      resetHistory();
      used = new Set(history);
    }
    const layout = randomLayout(imageIds, pairs, rng);
    const layoutHash = await hashLayout(layout, hash);
    if (!used.has(layoutHash)) return finish(layout, layoutHash);
    if (attempt > maxAttempts * 2) throw new Error('Could not find an unused layout');
  }
}
