import { Storage } from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Synchronous key-value storage backed by SQLite, used for small persisted
 * stores (settings, remembered player names). Being synchronous means
 * persisted state is ready on the first render — no flicker.
 */
export const kvStateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => {
    Storage.setItemSync(name, value);
  },
  removeItem: (name) => {
    Storage.removeItemSync(name);
  },
} satisfies StateStorage;
