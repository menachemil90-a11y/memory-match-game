/** @jest-environment node */
import { capabilities } from '../capabilities';
import type { Db } from '../../db/types';
import type { kvStateStorage } from '../../kvStorage';
import type { Capabilities } from '../types';

// The web files are loaded explicitly (Jest resolves the app's platform files).
const webCapabilities = jest.requireActual<{ capabilities: Capabilities }>(
  '../capabilities.web',
).capabilities;

describe('capabilities', () => {
  it('the app has everything', () => {
    expect(capabilities).toEqual({
      appFeatures: true,
      haptics: true,
      appUpdates: true,
      webShell: false,
    });
  });

  it('the web game is online play only, inside the web shell', () => {
    expect(webCapabilities).toEqual({
      appFeatures: false,
      haptics: false,
      appUpdates: false,
      webShell: true,
    });
  });
});

describe('web storage (localStorage, or memory when the browser blocks it)', () => {
  const load = () => {
    let mod!: { kvStateStorage: typeof kvStateStorage };
    jest.isolateModules(() => {
      mod = jest.requireActual('../../kvStorage.web');
    });
    return mod.kvStateStorage;
  };

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('keeps values in localStorage', () => {
    const data = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      },
    };
    const kv = load();
    kv.setItem('settings', '{"a":1}');
    expect(data.get('settings')).toBe('{"a":1}');
    expect(kv.getItem('settings')).toBe('{"a":1}');
    kv.removeItem('settings');
    expect(kv.getItem('settings')).toBeNull();
  });

  it('falls back to memory (for this visit) when storage is blocked', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (globalThis as { window?: unknown }).window = {
      get localStorage(): Storage {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    const kv = load();
    kv.setItem('k', 'v');
    expect(kv.getItem('k')).toBe('v');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('the web game has no device database (app-only data)', async () => {
    const { getDb } = jest.requireActual<{ getDb: () => Promise<Db> }>('../../db/index.web');
    await expect(getDb()).rejects.toThrow('only available in the app');
  });
});
