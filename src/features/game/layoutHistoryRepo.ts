import type { DealResult, LevelId } from '@/game';
import type { Db } from '@/lib/db/types';

/** Persistence for the "never the same board twice" history, per (board, level). */
export const layoutHistoryRepo = {
  async load(db: Db, boardId: string, levelId: LevelId): Promise<string[]> {
    const rows = await db.getAllAsync<{ hash: string }>(
      'SELECT hash FROM layout_history WHERE board_id = ? AND level_id = ? ORDER BY seq',
      boardId,
      levelId,
    );
    return rows.map((r) => r.hash);
  },

  /** Stores the outcome of `dealUniqueLayout`. */
  async record(
    db: Db,
    boardId: string,
    levelId: LevelId,
    result: Pick<DealResult, 'hash' | 'history' | 'historyWasReset'>,
    now: number = Date.now(),
  ): Promise<void> {
    await db.withTransactionAsync(async () => {
      if (result.historyWasReset) {
        await db.runAsync(
          'DELETE FROM layout_history WHERE board_id = ? AND level_id = ?',
          boardId,
          levelId,
        );
        for (const hash of result.history) {
          await db.runAsync(
            'INSERT INTO layout_history (board_id, level_id, hash, played_at) VALUES (?, ?, ?, ?)',
            boardId,
            levelId,
            hash,
            now,
          );
        }
        return;
      }
      await db.runAsync(
        'INSERT INTO layout_history (board_id, level_id, hash, played_at) VALUES (?, ?, ?, ?)',
        boardId,
        levelId,
        result.hash,
        now,
      );
    });
  },

  async clearBoard(db: Db, boardId: string): Promise<void> {
    await db.runAsync('DELETE FROM layout_history WHERE board_id = ?', boardId);
  },

  async clearAll(db: Db): Promise<void> {
    await db.runAsync('DELETE FROM layout_history');
  },
};
