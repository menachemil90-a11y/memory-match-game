import type { Db } from './types';

/**
 * Ordered schema migrations. Never edit a shipped migration — append a new one.
 * `PRAGMA user_version` stores how many have been applied.
 */
export const MIGRATIONS: readonly string[] = [
  // 1 — layout history ("never the same board twice") and solo best scores
  `
  CREATE TABLE IF NOT EXISTS layout_history (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id TEXT NOT NULL,
    level_id TEXT NOT NULL,
    hash TEXT NOT NULL,
    played_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS layout_history_key ON layout_history (board_id, level_id, seq);

  CREATE TABLE IF NOT EXISTS best_scores (
    board_id TEXT NOT NULL,
    level_id TEXT NOT NULL,
    moves INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    stars INTEGER NOT NULL,
    achieved_at INTEGER NOT NULL,
    PRIMARY KEY (board_id, level_id)
  );
  `,
];

export async function migrate(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]!);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return MIGRATIONS.length;
}
