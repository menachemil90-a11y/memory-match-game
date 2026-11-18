/**
 * In-memory fakes for the native modules the photo-board code uses
 * (expo-file-system, expo-image-manipulator, expo-crypto). Shared by the store
 * tests and the screen/flow tests so every test exercises the real store code
 * against the same fake "phone storage".
 *
 * Use from a jest.mock factory (factories may only `require`):
 *   jest.mock('expo-file-system', () => require('./nativeFakes').fakeFileSystem());
 */

import type * as NodeCrypto from 'node:crypto';

export const fakeState = {
  /** uri → content. Board files live under `doc/boards/<boardId>/`. */
  files: new Map<string, string>(),
  freeSpace: 10 * 1024 ** 3,
  counter: 0,
  manipulations: [] as string[],
};

export function resetFakeState(): void {
  fakeState.files.clear();
  fakeState.freeSpace = 10 * 1024 ** 3;
  fakeState.manipulations.length = 0;
}

/** Every stored file of a board (excluding the folder marker itself). */
export function boardFiles(boardId: string): string[] {
  const prefix = `doc/boards/${boardId}/`;
  return [...fakeState.files.keys()].filter((k) => k.startsWith(prefix));
}

export function fakeCrypto() {
  const { createHash, randomBytes } = jest.requireActual<typeof NodeCrypto>('node:crypto');
  return {
    randomUUID: () => `uuid-${++fakeState.counter}`,
    // The game's shuffle and no-repeat history use real crypto primitives.
    getRandomBytes: (n: number) => new Uint8Array(randomBytes(n)),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm: string, data: string) =>
      createHash('sha256').update(data).digest('hex'),
  };
}

export function fakeFileSystem() {
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  const nameOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get name() {
      return nameOf(this.uri);
    }
    get exists() {
      return fakeState.files.has(this.uri);
    }
    delete() {
      fakeState.files.delete(this.uri);
    }
    moveSync(dest: { uri: string }) {
      fakeState.files.set(dest.uri, fakeState.files.get(this.uri) ?? '');
      fakeState.files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get name() {
      return nameOf(this.uri);
    }
    /** Direct children: sub-folders (marker or nested files) and files. */
    list(): (File | Directory)[] {
      const prefix = this.uri + '/';
      const seen = new Map<string, File | Directory>();
      for (const [key, content] of fakeState.files) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const segment = rest.split('/')[0]!;
        if (seen.has(segment)) continue;
        const isDir = rest.includes('/') || content === 'dir';
        seen.set(segment, isDir ? new Directory(prefix + segment) : new File(prefix + segment));
      }
      return [...seen.values()];
    }
    get exists() {
      return (
        [...fakeState.files.keys()].some((k) => k.startsWith(this.uri + '/')) ||
        fakeState.files.has(this.uri)
      );
    }
    create() {
      fakeState.files.set(this.uri, 'dir');
    }
    delete() {
      for (const k of [...fakeState.files.keys()])
        if (k === this.uri || k.startsWith(this.uri + '/')) fakeState.files.delete(k);
    }
  }
  return {
    File,
    Directory,
    Paths: {
      document: { uri: 'doc' },
      get availableDiskSpace() {
        return fakeState.freeSpace;
      },
    },
  };
}

export function fakeImageManipulator() {
  const ctx = (src: string, w: number, h: number) => {
    const ops: string[] = [];
    let width = w;
    let height = h;
    const api = {
      rotate(d: number) {
        ops.push(`rotate:${d}`);
        if (d % 180) [width, height] = [height, width];
        return api;
      },
      crop(r: { width: number; height: number; originX: number; originY: number }) {
        ops.push(`crop:${r.originX},${r.originY},${r.width}`);
        width = r.width;
        height = r.height;
        return api;
      },
      resize(s: { width: number; height: number }) {
        ops.push(`resize:${s.width}x${s.height}`);
        width = s.width;
        height = s.height;
        return api;
      },
      async renderAsync() {
        if (src.includes('broken')) throw new Error('Could not decode image');
        fakeState.manipulations.push(`${src} ${ops.join(' ')}`.trim());
        return {
          width,
          height,
          async saveAsync() {
            const uri = `cache/${++fakeState.counter}.jpg`;
            fakeState.files.set(uri, `${width}x${height}`);
            return { uri, width, height };
          },
        };
      },
    };
    return api;
  };
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: {
      // Picked photos decode (downsampled) to 1600×1200.
      manipulate: (source: string | { width: number; height: number }) =>
        typeof source === 'string'
          ? ctx(source, 1600, 1200)
          : ctx('ref', source.width, source.height),
    },
  };
}
