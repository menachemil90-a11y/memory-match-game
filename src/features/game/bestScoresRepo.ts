import { isBetterScore, type LevelId, type SoloScore, type StarRating } from '@/game';
import type { Db } from '@/lib/db/types';

interface Row {
  level_id: LevelId;
  moves: number;
  time_ms: number;
  stars: number;
}

const toScore = (r: Row): SoloScore => ({
  moves: r.moves,
  timeMs: r.time_ms,
  stars: Math.min(3, Math.max(1, r.stars)) as StarRating,
});

export const bestScoresRepo = {
  async get(db: Db, boardId: string, levelId: LevelId): Promise<SoloScore | null> {
    const row = await db.getFirstAsync<Row>(
      'SELECT level_id, moves, time_ms, stars FROM best_scores WHERE board_id = ? AND level_id = ?',
      boardId,
      levelId,
    );
    return row ? toScore(row) : null;
  },

  async forBoard(db: Db, boardId: string): Promise<Partial<Record<LevelId, SoloScore>>> {
    const rows = await db.getAllAsync<Row>(
      'SELECT level_id, moves, time_ms, stars FROM best_scores WHERE board_id = ?',
      boardId,
    );
    return Object.fromEntries(rows.map((r) => [r.level_id, toScore(r)]));
  },

  /** Saves the score if it beats the stored best. Returns true for a new best. */
  async saveIfBetter(
    db: Db,
    boardId: string,
    levelId: LevelId,
    score: SoloScore,
    now: number = Date.now(),
  ): Promise<boolean> {
    const best = await this.get(db, boardId, levelId);
    if (!isBetterScore(score, best)) return false;
    await db.runAsync(
      `INSERT INTO best_scores (board_id, level_id, moves, time_ms, stars, achieved_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (board_id, level_id) DO UPDATE SET
         moves = excluded.moves, time_ms = excluded.time_ms,
         stars = excluded.stars, achieved_at = excluded.achieved_at`,
      boardId,
      levelId,
      score.moves,
      score.timeMs,
      score.stars,
      now,
    );
    return true;
  },

  async clearAll(db: Db): Promise<void> {
    await db.runAsync('DELETE FROM best_scores');
  },
};
