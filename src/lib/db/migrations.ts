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
  // 2 — custom photo boards (files live in the app's document directory)
  `
  CREATE TABLE IF NOT EXISTS custom_boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    card_back TEXT NOT NULL,
    cover_photo_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS custom_photos (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES custom_boards (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    source_file TEXT NOT NULL,
    card_file TEXT NOT NULL,
    thumb_file TEXT NOT NULL,
    source_width INTEGER NOT NULL,
    source_height INTEGER NOT NULL,
    crop_rotation INTEGER NOT NULL DEFAULT 0,
    crop_x REAL NOT NULL,
    crop_y REAL NOT NULL,
    crop_size REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS custom_photos_board ON custom_photos (board_id, position);
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
