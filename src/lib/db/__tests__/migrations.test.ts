/** @jest-environment node */
import { MIGRATIONS, migrate } from '../migrations';

import { createTestDb } from './nodeSqliteDb';

describe('migrate', () => {
  it('applies every migration once and is idempotent', async () => {
    const db = createTestDb();
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(MIGRATIONS.length);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['layout_history', 'best_scores']),
    );
    db.close();
  });
});
