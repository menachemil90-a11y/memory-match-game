/** Values that can be bound to SQL parameters. */
export type SqlValue = string | number | null | boolean | Uint8Array;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

/**
 * The subset of `expo-sqlite`'s SQLiteDatabase the app uses. Repositories
 * depend on this interface so they can be unit-tested against node:sqlite.
 */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlValue[]): Promise<RunResult>;
  getAllAsync<T>(source: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
