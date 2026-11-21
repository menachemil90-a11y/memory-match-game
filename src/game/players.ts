import { getLevel, LEVELS } from './levels';
import type { LevelDefinition, LevelId } from './types';

/**
 * Player-count rules, shared by solo, pass-and-play and online games.
 *
 * The server mirrors these values (supabase/migrations: `app_config.max_players`
 * and `private.min_pairs_for_players`); a server test fails if they drift apart.
 */

/** Most players in one game — on one phone and online. */
export const MAX_PLAYERS = 8;

/** Fewest players in a multiplayer game (solo is a single player). */
export const MIN_MULTIPLAYER = 2;

/**
 * Smallest board (in pairs) for a number of players, so that nobody is left
 * without turns: 2 players → any level; 3–4 → at least 8 pairs; 5–8 → at least 12.
 */
export function minPairsForPlayers(playerCount: number): number {
  if (playerCount <= 2) return 0;
  if (playerCount <= 4) return 8;
  return 12;
}

/** Whether `levelId` may be played by `playerCount` players. */
export function isLevelAllowedForPlayers(levelId: LevelId, playerCount: number): boolean {
  return (
    Number.isInteger(playerCount) &&
    playerCount >= 1 &&
    playerCount <= MAX_PLAYERS &&
    getLevel(levelId).pairs >= minPairsForPlayers(playerCount)
  );
}

/** Most players a level allows (online rooms take this many at most). */
export function maxPlayersForLevel(levelId: LevelId): number {
  let max = 1;
  for (let n = 1; n <= MAX_PLAYERS; n++) if (isLevelAllowedForPlayers(levelId, n)) max = n;
  return max;
}

/** The smallest level that `playerCount` players may play (for "Medium or bigger" hints). */
export function smallestLevelForPlayers(playerCount: number): LevelDefinition {
  const level = LEVELS.find((l) => l.pairs >= minPairsForPlayers(playerCount));
  if (!level) throw new RangeError(`No level fits ${playerCount} players`);
  return level;
}
