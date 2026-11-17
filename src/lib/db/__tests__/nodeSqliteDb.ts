import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db, SqlValue } from '../types';

const bind = (params: SqlValue[]): SQLInputValue[] =>
  params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));

/** In-memory `Db` backed by node:sqlite, for repository tests. */
export function createTestDb(): Db & { close(): void } {
  const db = new DatabaseSync(':memory:');
  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, ...params) {
      const r = db.prepare(source).run(...bind(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync<T>(source: string, ...params: SqlValue[]) {
      return db
        .prepare(source)
        .all(...bind(params))
        .map((row) => ({ ...row })) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: SqlValue[]) {
      const row = db.prepare(source).get(...bind(params));
      return (row ? { ...row } : null) as T | null;
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}
