import type { Db } from './types';

export type { Db, SqlValue } from './types';

/**
 * The web game is online play only: best scores, shuffle history and photo
 * boards live in the app's device database, which the web build doesn't have.
 * Web screens never ask for it (see capabilities.appFeatures); reaching this is
 * a bug in the routing, so it fails loudly instead of pretending.
 */
export function getDb(): Promise<Db> {
  return Promise.reject(new Error('The device database is only available in the app.'));
}
