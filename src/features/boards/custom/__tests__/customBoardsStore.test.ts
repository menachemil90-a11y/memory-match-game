/** @jest-environment node */
/* eslint-disable import/first -- modules must load after jest.mock() */
import { createTestDb } from '@/lib/db/__tests__/nodeSqliteDb';
import { migrate } from '@/lib/db/migrations';

import type * as NativeFakes from './nativeFakes';

jest.mock('expo-crypto', () =>
  jest.requireActual<typeof NativeFakes>('./nativeFakes').fakeCrypto(),
);
jest.mock('expo-file-system', () =>
  jest.requireActual<typeof NativeFakes>('./nativeFakes').fakeFileSystem(),
);
jest.mock('expo-image-manipulator', () =>
  jest.requireActual<typeof NativeFakes>('./nativeFakes').fakeImageManipulator(),
);

const mockDb = createTestDb();
let mockDbFails = false;
jest.mock('@/lib/db', () => ({
  getDb: async () => {
    if (mockDbFails) throw new Error('database unavailable');
    return mockDb;
  },
}));
jest.mock('@/lib/i18n', () => ({ i18n: { t: (_k: string, o: { n: number }) => `Photo ${o.n}` } }));

import { boardFiles, fakeState } from './nativeFakes';
import { LowStorageError } from '../photoStorage';
import {
  NotEnoughPhotosError,
  playablePhotos,
  toGameBoard,
  useCustomBoards,
} from '../customBoardsStore';

const store = () => useCustomBoards.getState();
const boardById = (id: string) => store().boards.find((b) => b.id === id)!;
const PICKED = ['content://a', 'content://b', 'content://c'];

beforeAll(async () => {
  await mockDb.execAsync('PRAGMA foreign_keys = ON');
  await migrate(mockDb);
  await store().load();
});

describe('creating boards', () => {
  it('creates a board together with its photos: source copy, auto-cropped card, thumbnail', async () => {
    const progress: number[] = [];
    const { boardId, addedIds, failed } = await store().createBoard(
      '  Grandma   & me ',
      PICKED,
      (p) => progress.push(p.done),
    );
    expect(failed).toBe(0);
    expect(addedIds).toHaveLength(3);
    expect(progress).toEqual([0, 1, 2, 3]);

    const board = boardById(boardId);
    expect(board.name).toBe('Grandma & me');
    const photo = board.photos[0]!;
    expect(photo).toMatchObject({ sourceWidth: 1600, sourceHeight: 1200, fileMissing: false });
    expect(photo.crop).toEqual({ rotation: 0, originX: 200, originY: 0, size: 1200 });
    for (const name of [photo.sourceFile, photo.cardFile, photo.thumbFile]) {
      expect(fakeState.files.has(`doc/boards/${boardId}/${name}`)).toBe(true);
    }
    expect(fakeState.manipulations.some((m) => m.includes('crop:200,0,1200 resize:700x700'))).toBe(
      true,
    );

    const game = toGameBoard(board);
    expect(game.images).toHaveLength(3);
    expect(game.images[1]).toMatchObject({ kind: 'photo', label: 'Photo 2' });
    expect(game.coverImageId).toBe(photo.id);
  });

  it('refuses to save a board with fewer than 3 photos — nothing is kept', async () => {
    const before = store().boards.length;
    const filesBefore = fakeState.files.size;
    await expect(store().createBoard('Two', PICKED.slice(0, 2))).rejects.toBeInstanceOf(
      NotEnoughPhotosError,
    );
    expect(store().boards).toHaveLength(before);
    expect(fakeState.files.size).toBe(filesBefore);
  });

  it('removes a half-made board when too few photos could be imported', async () => {
    const before = store().boards.map((b) => b.id);
    const error = await store()
      .createBoard('Broken', ['content://ok', 'content://broken-1', 'content://broken-2'])
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotEnoughPhotosError);
    expect((error as NotEnoughPhotosError).added).toBe(1);
    expect(store().boards.map((b) => b.id)).toEqual(before);
    const rows = await mockDb.getAllAsync<{ id: string }>('SELECT id FROM custom_boards');
    expect(rows.map((r) => r.id).sort()).toEqual([...before].sort());
    // Files written for the one good photo were removed with the board.
    for (const k of fakeState.files.keys()) {
      if (k.startsWith('doc/boards/')) {
        expect(before.some((id) => k.startsWith(`doc/boards/${id}`))).toBe(true);
      }
    }
  });

  it('reports photos that could not be added but keeps a board that has enough', async () => {
    const { boardId, addedIds, failed } = await store().createBoard('Mixed', [
      ...PICKED,
      'content://broken',
    ]);
    expect(addedIds).toHaveLength(3);
    expect(failed).toBe(1);
    await store().deleteBoard(boardId);
  });

  it('refuses to import when storage is almost full', async () => {
    fakeState.freeSpace = 10 * 1024 * 1024;
    const id = store().boards[0]!.id;
    await expect(store().importPhotos(id, ['content://x'])).rejects.toBeInstanceOf(LowStorageError);
    fakeState.freeSpace = 10 * 1024 ** 3;
  });
});

describe('editing boards', () => {
  it('re-crops with rotation into new versioned files and removes the old ones', async () => {
    const board = store().boards[0]!;
    const photo = board.photos[0]!;
    const oldCard = `doc/boards/${board.id}/${photo.cardFile}`;
    await store().saveCrop(photo, { rotation: 90, originX: 100, originY: 300, size: 800 });
    const updated = boardById(board.id).photos[0]!;
    expect(updated.crop).toEqual({ rotation: 90, originX: 100, originY: 300, size: 800 });
    expect(updated.cardFile).not.toBe(photo.cardFile);
    expect(fakeState.files.has(oldCard)).toBe(false);
    expect(fakeState.manipulations.at(-2)).toContain('rotate:90 crop:100,300,800 resize:700x700');
  });

  it('renames (rejecting empty names), sets the cover and adds photos', async () => {
    const id = store().boards[0]!.id;
    await store().rename(id, '  משפחה  ');
    expect(boardById(id).name).toBe('משפחה');
    await expect(store().rename(id, '   ')).rejects.toThrow();
    expect(boardById(id).name).toBe('משפחה');

    const third = boardById(id).photos[2]!;
    await store().setCover(id, third.id);
    expect(toGameBoard(boardById(id)).coverImageId).toBe(third.id);

    const { addedIds } = await store().importPhotos(id, ['content://d']);
    expect(boardById(id).photos.map((p) => p.id)).toContain(addedIds[0]);
  });

  it('deletes a single photo and its files from the device', async () => {
    const board = store().boards[0]!;
    const photo = board.photos.at(-1)!;
    await store().deletePhoto(photo);
    expect(boardById(board.id).photos.some((p) => p.id === photo.id)).toBe(false);
    for (const name of [photo.sourceFile, photo.cardFile, photo.thumbFile]) {
      expect(fakeState.files.has(`doc/boards/${board.id}/${name}`)).toBe(false);
    }
  });

  it('lets a board drop below 3 photos (the editor then asks for more) without losing it', async () => {
    const board = store().boards[0]!;
    await store().deletePhoto(board.photos[0]!);
    const left = boardById(board.id);
    expect(left.photos).toHaveLength(2);
    expect(toGameBoard(left).images).toHaveLength(2);
    await store().importPhotos(board.id, ['content://e']);
    expect(boardById(board.id).photos).toHaveLength(3);
  });
});

describe('files on the device', () => {
  it('flags photos whose files vanished and repairs cards from the kept source', async () => {
    const board = store().boards[0]!;
    const [p1, p2] = board.photos;
    fakeState.files.delete(`doc/boards/${board.id}/${p1!.cardFile}`); // card lost, source kept
    fakeState.files.delete(`doc/boards/${board.id}/${p2!.cardFile}`);
    fakeState.files.delete(`doc/boards/${board.id}/${p2!.sourceFile}`); // everything lost
    await store().load();
    const reloaded = boardById(board.id);
    expect(reloaded.photos.find((p) => p.id === p2!.id)!.fileMissing).toBe(true);
    const repaired = reloaded.photos.find((p) => p.id === p1!.id)!;
    expect(repaired.fileMissing).toBe(false);
    expect(fakeState.files.has(`doc/boards/${board.id}/${repaired.cardFile}`)).toBe(true);
    expect(playablePhotos(reloaded)).toHaveLength(2);
    expect(toGameBoard(reloaded).images).toHaveLength(2);

    await store().deletePhoto(reloaded.photos.find((p) => p.id === p2!.id)!);
    expect(boardById(board.id).photos.every((p) => !p.fileMissing)).toBe(true);
  });

  it('sweeps files nothing refers to (interrupted deletes, half-written imports)', async () => {
    const board = store().boards[0]!;
    const keep = boardFiles(board.id);
    fakeState.files.set(`doc/boards/${board.id}/stray-card-x.jpg`, 'x');
    fakeState.files.set('doc/boards/custom-deleted-long-ago/a-src.jpg', 'x');
    fakeState.files.set('doc/boards/custom-deleted-long-ago', 'dir');
    await store().load();
    expect(boardFiles(board.id).sort()).toEqual(keep.sort());
    expect([...fakeState.files.keys()].some((k) => k.includes('custom-deleted-long-ago'))).toBe(
      false,
    );
  });

  it('deletes the board, its folder and its database rows', async () => {
    const id = store().boards[0]!.id;
    await store().deleteBoard(id);
    expect(store().boards.some((b) => b.id === id)).toBe(false);
    expect([...fakeState.files.keys()].some((k) => k.startsWith(`doc/boards/${id}`))).toBe(false);
    const photos = await mockDb.getAllAsync('SELECT id FROM custom_photos WHERE board_id = ?', id);
    expect(photos).toEqual([]);
  });
});

describe('store contract', () => {
  it('selectors return the stored objects: same reference on every call', async () => {
    const { boardId } = await store().createBoard('Stable', PICKED);
    const state = store();
    const select = (s: typeof state) => s.boards.find((b) => b.id === boardId);
    expect(select(state)).toBe(select(state));
    expect(state.boards).toBe(store().boards);
  });

  it('reports a failed load through `status` (with retry) instead of dropping the error', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDbFails = true;
    await store().load();
    expect(store().status).toBe('failed');
    expect(errors).toHaveBeenCalled();
    mockDbFails = false;
    await store().load();
    expect(store().status).toBe('ready');
    errors.mockRestore();
  });
});
