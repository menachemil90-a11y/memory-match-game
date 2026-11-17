/** @jest-environment node */
/* eslint-disable import/first -- modules must load after jest.mock() */
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

// ---- In-memory fakes for the native modules ----
const mockFiles = new Map<string, string>(); // uri -> content
let mockFreeSpace = 10 * 1024 ** 3;
let mockCounter = 0;

jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCounter}` }));

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    moveSync(dest: { uri: string }) {
      mockFiles.set(dest.uri, mockFiles.get(this.uri) ?? '');
      mockFiles.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return (
        [...mockFiles.keys()].some((k) => k.startsWith(this.uri + '/')) || mockFiles.has(this.uri)
      );
    }
    create() {
      mockFiles.set(this.uri, 'dir');
    }
    delete() {
      for (const k of [...mockFiles.keys()])
        if (k === this.uri || k.startsWith(this.uri + '/')) mockFiles.delete(k);
    }
  }
  return {
    File,
    Directory,
    Paths: {
      document: { uri: 'doc' },
      get availableDiskSpace() {
        return mockFreeSpace;
      },
    },
  };
});

const mockManipulations: string[] = [];
jest.mock('expo-image-manipulator', () => {
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
        mockManipulations.push(`${src} ${ops.join(' ')}`.trim());
        return {
          width,
          height,
          async saveAsync() {
            const uri = `cache/${++mockCounter}.jpg`;
            mockFiles.set(uri, `${width}x${height}`);
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
      manipulate: (
        source: string | { width: number; height: number },
        opts?: { maxWidth?: number },
      ) =>
        typeof source === 'string'
          ? // Picked photos are 4000×3000; the decoder honours maxWidth.
            opts?.maxWidth
            ? ctx(source, 1600, 1200)
            : ctx(source, 1600, 1200)
          : ctx('ref', source.width, source.height),
    },
  };
});

const mockDb = createTestDb();
jest.mock('@/lib/db', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/i18n', () => ({ i18n: { t: (_k: string, o: { n: number }) => `Photo ${o.n}` } }));

import { LowStorageError } from '../photoStorage';
import { toGameBoard, useCustomBoards } from '../customBoardsStore';

beforeAll(async () => {
  await mockDb.execAsync('PRAGMA foreign_keys = ON');
  await migrate(mockDb);
});

describe('custom boards (store + mockFiles)', () => {
  it('imports photos: source copy, auto-cropped card and thumbnail', async () => {
    const store = useCustomBoards.getState();
    const id = await store.createBoard('  Grandma   & me ');
    expect(useCustomBoards.getState().boards[0]).toMatchObject({ id, name: 'Grandma & me' });

    const progress: number[] = [];
    const { addedIds, failed } = await store.importPhotos(
      id,
      ['content://a', 'content://b', 'content://c'],
      (p) => progress.push(p.done),
    );
    expect(failed).toBe(0);
    expect(addedIds).toHaveLength(3);
    expect(progress).toEqual([0, 1, 2, 3]);

    const board = useCustomBoards.getState().boards.find((b) => b.id === id)!;
    const photo = board.photos[0]!;
    expect(photo).toMatchObject({ sourceWidth: 1600, sourceHeight: 1200 });
    expect(photo.crop).toEqual({ rotation: 0, originX: 200, originY: 0, size: 1200 });
    for (const name of [photo.sourceFile, photo.cardFile, photo.thumbFile]) {
      expect(mockFiles.has(`doc/boards/${id}/${name}`)).toBe(true);
    }
    // Card = centered square crop resized to 700×700.
    expect(mockManipulations.some((m) => m.includes('crop:200,0,1200 resize:700x700'))).toBe(true);

    const game = toGameBoard(board);
    expect(game.images).toHaveLength(3);
    expect(game.images[1]).toMatchObject({ kind: 'photo', label: 'Photo 2' });
    expect(game.coverImageId).toBe(photo.id);
  });

  it('re-crops with rotation into new versioned mockFiles and removes the old ones', async () => {
    const board = useCustomBoards.getState().boards[0]!;
    const photo = board.photos[0]!;
    const oldCard = `doc/boards/${board.id}/${photo.cardFile}`;
    await useCustomBoards
      .getState()
      .saveCrop(photo, { rotation: 90, originX: 100, originY: 300, size: 800 });
    const updated = useCustomBoards.getState().boards[0]!.photos[0]!;
    expect(updated.crop).toEqual({ rotation: 90, originX: 100, originY: 300, size: 800 });
    expect(updated.cardFile).not.toBe(photo.cardFile);
    expect(mockFiles.has(oldCard)).toBe(false);
    expect(mockManipulations.at(-2)).toContain('rotate:90 crop:100,300,800 resize:700x700');
  });

  it('flags photos whose mockFiles vanished and repairs cards from the source', async () => {
    const board = useCustomBoards.getState().boards[0]!;
    const [p1, p2] = board.photos;
    mockFiles.delete(`doc/boards/${board.id}/${p1!.cardFile}`); // card lost, source kept → repaired
    mockFiles.delete(`doc/boards/${board.id}/${p2!.cardFile}`);
    mockFiles.delete(`doc/boards/${board.id}/${p2!.sourceFile}`); // everything lost → missing
    await useCustomBoards.getState().load();
    const state = useCustomBoards.getState();
    expect(state.missing[board.id]).toEqual([p2!.id]);
    const repaired = state.boards[0]!.photos[0]!;
    expect(mockFiles.has(`doc/boards/${board.id}/${repaired.cardFile}`)).toBe(true);
    expect(toGameBoard(state.boards[0]!, state.missing[board.id]).images).toHaveLength(2);

    await useCustomBoards.getState().deletePhoto(state.boards[0]!.photos[1]!);
    expect(useCustomBoards.getState().missing[board.id]).toEqual([]);
  });

  it('refuses to import when storage is almost full', async () => {
    mockFreeSpace = 10 * 1024 * 1024;
    const id = useCustomBoards.getState().boards[0]!.id;
    await expect(
      useCustomBoards.getState().importPhotos(id, ['content://x']),
    ).rejects.toBeInstanceOf(LowStorageError);
    mockFreeSpace = 10 * 1024 ** 3;
  });

  it('deletes the board, its mockFiles and its history', async () => {
    const id = useCustomBoards.getState().boards[0]!.id;
    await useCustomBoards.getState().deleteBoard(id);
    expect(useCustomBoards.getState().boards).toEqual([]);
    expect([...mockFiles.keys()].some((k) => k.startsWith(`doc/boards/${id}`))).toBe(false);
  });
});
