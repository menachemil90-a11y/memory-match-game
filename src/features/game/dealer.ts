import { getDb } from '@/lib/db';
import { secureRandom, sha256 } from '@/lib/secureRandom';

import { dealNewLayout } from './dealService';
import type { Dealer } from './gameSessionStore';

/** Production dealer: secure RNG + SHA-256 + on-device SQLite history. */
export const deviceDealer: Dealer = async (config) => {
  const db = await getDb();
  return dealNewLayout(
    { db, rng: secureRandom, hash: sha256 },
    {
      boardId: config.board.id,
      levelId: config.levelId,
      imageIds: config.board.images.map((i) => i.id),
    },
  );
};
