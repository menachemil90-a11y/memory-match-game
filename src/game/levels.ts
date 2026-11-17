import type { LevelDefinition, LevelId } from './types';

/** Difficulty levels, smallest first. Grids are cols × rows for portrait phones. */
export const LEVELS: readonly LevelDefinition[] = [
  { id: 'tiny', pairs: 3, cols: 2, rows: 3 },
  { id: 'easy', pairs: 6, cols: 3, rows: 4 },
  { id: 'medium', pairs: 8, cols: 4, rows: 4 },
  { id: 'tricky', pairs: 10, cols: 4, rows: 5 },
  { id: 'hard', pairs: 12, cols: 4, rows: 6 },
  { id: 'expert', pairs: 18, cols: 6, rows: 6 },
] as const;

export const LEVEL_IDS: readonly LevelId[] = LEVELS.map((level) => level.id);

/** Minimum number of distinct images a board needs to be playable at all. */
export const MIN_BOARD_IMAGES = LEVELS[0]!.pairs;

/** Maximum number of photos on a custom board. */
export const MAX_BOARD_IMAGES = 30;

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (LEVEL_IDS as readonly string[]).includes(value);
}

export function getLevel(id: LevelId): LevelDefinition {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level: ${id}`);
  return level;
}

export interface LevelAvailability {
  level: LevelDefinition;
  locked: boolean;
  /** How many more images the board needs to unlock this level (0 when unlocked). */
  missingImages: number;
}

/** Which levels a board with `imageCount` distinct images can play. */
export function getLevelAvailability(imageCount: number): LevelAvailability[] {
  return LEVELS.map((level) => {
    const missingImages = Math.max(0, level.pairs - imageCount);
    return { level, locked: missingImages > 0, missingImages };
  });
}

export function isLevelUnlocked(levelId: LevelId, imageCount: number): boolean {
  return imageCount >= getLevel(levelId).pairs;
}

/** The next locked level and how many images it needs, for "Add 2 more photos to unlock Hard". */
export function nextLockedLevel(imageCount: number): LevelAvailability | null {
  return getLevelAvailability(imageCount).find((a) => a.locked) ?? null;
}
