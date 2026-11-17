/**
 * Solo star rating, based on moves (pair attempts) relative to pairs.
 *
 * A player with perfect memory needs on average ≈1.6 moves per pair, so
 * 3 stars ≈ near-perfect play, 2 stars = solid, 1 star = finished.
 */
export const STAR_THRESHOLDS = {
  three: 1.75,
  two: 2.5,
} as const;

export type StarRating = 1 | 2 | 3;

export function maxMovesForStars(pairs: number): { three: number; two: number } {
  return {
    three: Math.ceil(pairs * STAR_THRESHOLDS.three),
    two: Math.ceil(pairs * STAR_THRESHOLDS.two),
  };
}

export function starRating(moves: number, pairs: number): StarRating {
  if (pairs <= 0) throw new RangeError('pairs must be positive');
  const limits = maxMovesForStars(pairs);
  if (moves <= limits.three) return 3;
  if (moves <= limits.two) return 2;
  return 1;
}

export interface SoloScore {
  moves: number;
  timeMs: number;
  stars: StarRating;
}

/** True when `candidate` beats `best`: more stars, then fewer moves, then faster. */
export function isBetterScore(candidate: SoloScore, best: SoloScore | null | undefined): boolean {
  if (!best) return true;
  if (candidate.stars !== best.stars) return candidate.stars > best.stars;
  if (candidate.moves !== best.moves) return candidate.moves < best.moves;
  return candidate.timeMs < best.timeMs;
}
