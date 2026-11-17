import { openDatabaseAsync } from 'expo-sqlite';

import { migrate } from './migrations';
import type { Db } from './types';

export type { Db, SqlValue } from './types';

const DB_NAME = 'memory-match.db';

let dbPromise: Promise<Db> | null = null;

/** The app database, opened and migrated once. */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })().catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}
