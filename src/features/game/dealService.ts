import {
  dealUniqueLayout,
  getLevel,
  type Hasher,
  type ImageId,
  type LevelId,
  type RandomSource,
} from '@/game';
import type { Db } from '@/lib/db/types';

import { layoutHistoryRepo } from './layoutHistoryRepo';

export interface DealDeps {
  db: Db;
  rng: RandomSource;
  hash: Hasher;
}

export interface DealRequest {
  boardId: string;
  levelId: LevelId;
  imageIds: readonly ImageId[];
}

/**
 * Deals a never-played layout for (board, level) and records it in the
 * on-device history.
 */
export async function dealNewLayout(
  { db, rng, hash }: DealDeps,
  { boardId, levelId, imageIds }: DealRequest,
): Promise<ImageId[]> {
  const history = await layoutHistoryRepo.load(db, boardId, levelId);
  const result = await dealUniqueLayout({
    imageIds,
    pairs: getLevel(levelId).pairs,
    history,
    rng,
    hash,
  });
  await layoutHistoryRepo.record(db, boardId, levelId, result);
  return result.layout;
}
