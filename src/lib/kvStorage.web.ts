import type { StateStorage } from 'zustand/middleware';

/**
 * Web version of the small key-value store (settings, nickname, the anonymous
 * online session). The app uses SQLite (kvStorage.ts), but SQLite in a browser
 * needs cross-origin isolation headers that GitHub Pages can't send — and the
 * browser's own localStorage is the right tool here anyway.
 *
 * When the browser blocks storage (e.g. all site data blocked), values live in
 * memory for this visit: the game still works, it just forgets on reload.
 */
function pickBackend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const probe = '__memory_match_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (error) {
    console.warn('Browser storage is blocked; settings are kept for this visit only.', error);
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
}

const backend = pickBackend();

export const kvStateStorage = {
  getItem: (name) => backend.getItem(name),
  setItem: (name, value) => backend.setItem(name, value),
  removeItem: (name) => backend.removeItem(name),
} satisfies StateStorage;
