import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import { MIN_BOARD_IMAGES } from '@/game';
import { getDb } from '@/lib/db';
import type { Db } from '@/lib/db/types';
import { i18n } from '@/lib/i18n';
import { colors } from '@/ui/theme';

import { CARD_BACK_IDS } from '../builtin';
import type { CardBackId } from '../builtin/types';
import type { Board } from '../types';

import type { CropParams } from './cropMath';
import { customBoardsRepo } from './customBoardsRepo';
import {
  assertFreeSpace,
  boardFileExists,
  boardFileUri,
  deleteBoardFiles,
  deleteCardFiles,
  deletePhotoFiles,
  importPhoto,
  renderCardFiles,
  sweepOrphanFiles,
} from './photoStorage';
import {
  CUSTOM_BOARD_PREFIX,
  MAX_BOARD_NAME_LENGTH,
  type CustomBoard,
  type CustomBoardRecord,
  type PhotoRecord,
} from './types';

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportResult {
  addedIds: string[];
  failed: number;
}

/** A new board needs at least MIN_BOARD_IMAGES photos; fewer were imported. */
export class NotEnoughPhotosError extends Error {
  constructor(readonly added: number) {
    super(`A board needs at least ${MIN_BOARD_IMAGES} photos (got ${added})`);
    this.name = 'NotEnoughPhotosError';
  }
}

/**
 * - `idle`: not loaded yet · `loading` · `ready`
 * - `failed`: the device database could not be read; screens offer "Try again".
 */
export type BoardsStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface CustomBoardsState {
  /** Boards with each photo's `fileMissing` flag. Selectors return these objects as-is. */
  boards: CustomBoard[];
  status: BoardsStatus;
  load: () => Promise<void>;
  /** Creates a board from picked photos; throws NotEnoughPhotosError (and keeps nothing) below the minimum. */
  createBoard: (
    name: string,
    uris: string[],
    onProgress?: (p: ImportProgress) => void,
  ) => Promise<ImportResult & { boardId: string }>;
  importPhotos: (
    boardId: string,
    uris: string[],
    onProgress?: (p: ImportProgress) => void,
  ) => Promise<ImportResult>;
  saveCrop: (photo: PhotoRecord, crop: CropParams) => Promise<void>;
  rename: (boardId: string, name: string) => Promise<void>;
  setCardBack: (boardId: string, cardBack: CardBackId) => Promise<void>;
  setCover: (boardId: string, photoId: string) => Promise<void>;
  movePhoto: (boardId: string, photoId: string, step: -1 | 1) => Promise<void>;
  deletePhoto: (photo: PhotoRecord) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
}

export function sanitizeBoardName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_BOARD_NAME_LENGTH);
}

/**
 * Checks every photo's files. A lost card/thumbnail is re-rendered from the
 * kept source copy (and saved to the database); photos that can't be repaired
 * are returned as missing. Never mutates the records it is given.
 */
async function repairFiles(db: Db, boards: CustomBoardRecord[]): Promise<Set<string>> {
  const missing = new Set<string>();
  for (const board of boards) {
    for (const photo of board.photos) {
      if (boardFileExists(board.id, photo.cardFile) && boardFileExists(board.id, photo.thumbFile)) {
        continue;
      }
      if (!boardFileExists(board.id, photo.sourceFile)) {
        missing.add(photo.id);
        continue;
      }
      let files: { cardFile: string; thumbFile: string };
      try {
        files = await renderCardFiles(
          board.id,
          photo.id,
          photo.sourceFile,
          { width: photo.sourceWidth, height: photo.sourceHeight },
          photo.crop,
        );
      } catch (error) {
        // The kept copy exists but can't be decoded: the photo is unusable. It is
        // shown as missing in the editor (with a one-tap remove), not hidden.
        console.warn(`Photo ${photo.id} could not be repaired`, error);
        missing.add(photo.id);
        continue;
      }
      await customBoardsRepo.updatePhoto(db, { ...photo, ...files });
    }
  }
  return missing;
}

export const useCustomBoards = create<CustomBoardsState>()((set, get) => {
  /** Photo ids whose files are gone and couldn't be repaired (from the last load). */
  let missingPhotoIds: ReadonlySet<string> = new Set();
  /** The running load; every change waits for it so the file sweep never races an import. */
  let loading: Promise<void> | null = null;

  const withFileState = (records: CustomBoardRecord[]): CustomBoard[] =>
    records.map((b) => ({
      ...b,
      photos: b.photos.map((p) => ({ ...p, fileMissing: missingPhotoIds.has(p.id) })),
    }));

  const reload = async (db: Db) => {
    set({ boards: withFileState(await customBoardsRepo.list(db)) });
  };

  /** Runs a change after loading has finished, then refreshes the boards. */
  const change = async <T>(fn: (db: Db) => Promise<T>): Promise<T> => {
    if (get().status !== 'ready') await get().load();
    if (get().status !== 'ready') throw new Error('Custom boards could not be loaded');
    const db = await getDb();
    try {
      return await fn(db);
    } finally {
      await reload(db);
    }
  };

  const importInto = async (
    db: Db,
    boardId: string,
    uris: string[],
    onProgress?: (p: ImportProgress) => void,
  ): Promise<ImportResult> => {
    assertFreeSpace(uris.length);
    const addedIds: string[] = [];
    let failed = 0;
    onProgress?.({ done: 0, total: uris.length });
    for (const [i, uri] of uris.entries()) {
      try {
        const photo = await importPhoto(boardId, uri);
        await customBoardsRepo.addPhotos(db, boardId, [photo]);
        addedIds.push(photo.id);
      } catch (error) {
        // One unreadable photo shouldn't stop the others (it's counted and
        // reported); running out of space stops the whole import.
        if (error instanceof Error && /space|ENOSPC|full/i.test(error.message)) throw error;
        console.warn('Photo import failed', error);
        failed++;
      }
      onProgress?.({ done: i + 1, total: uris.length });
    }
    return { addedIds, failed };
  };

  return {
    boards: [],
    status: 'idle',

    load() {
      if (loading) return loading;
      set({ status: 'loading' });
      loading = (async () => {
        try {
          const db = await getDb();
          const records = await customBoardsRepo.list(db);
          missingPhotoIds = await repairFiles(db, records);
          const fresh = await customBoardsRepo.list(db);
          sweepOrphanFiles(fresh);
          set({ boards: withFileState(fresh), status: 'ready' });
        } catch (error) {
          console.error('Loading custom boards failed', error);
          set({ status: 'failed' });
        } finally {
          loading = null;
        }
      })();
      return loading;
    },

    createBoard(name, uris, onProgress) {
      return change(async (db) => {
        const clean = sanitizeBoardName(name);
        if (!clean) throw new Error('A board needs a name');
        if (uris.length < MIN_BOARD_IMAGES) throw new NotEnoughPhotosError(uris.length);
        const boardId = `${CUSTOM_BOARD_PREFIX}${Crypto.randomUUID()}`;
        const cardBack = CARD_BACK_IDS[get().boards.length % CARD_BACK_IDS.length]!;
        await customBoardsRepo.create(db, { id: boardId, name: clean, cardBack });
        try {
          const result = await importInto(db, boardId, uris, onProgress);
          if (result.addedIds.length < MIN_BOARD_IMAGES) {
            throw new NotEnoughPhotosError(result.addedIds.length);
          }
          return { ...result, boardId };
        } catch (error) {
          // Never keep a half-made board: remove its rows and files, then report.
          await customBoardsRepo.remove(db, boardId);
          deleteBoardFiles(boardId);
          throw error;
        }
      });
    },

    importPhotos(boardId, uris, onProgress) {
      return change((db) => importInto(db, boardId, uris, onProgress));
    },

    saveCrop(photo, crop) {
      return change(async (db) => {
        const files = await renderCardFiles(
          photo.boardId,
          photo.id,
          photo.sourceFile,
          { width: photo.sourceWidth, height: photo.sourceHeight },
          crop,
        );
        await customBoardsRepo.updatePhoto(db, { ...photo, crop, ...files });
        deleteCardFiles(photo.boardId, photo);
      });
    },

    rename(boardId, name) {
      return change(async (db) => {
        const clean = sanitizeBoardName(name);
        if (!clean) throw new Error('A board needs a name');
        await customBoardsRepo.rename(db, boardId, clean);
      });
    },

    setCardBack(boardId, cardBack) {
      return change((db) => customBoardsRepo.setCardBack(db, boardId, cardBack));
    },

    setCover(boardId, photoId) {
      return change((db) => customBoardsRepo.setCover(db, boardId, photoId));
    },

    movePhoto(boardId, photoId, step) {
      return change((db) => customBoardsRepo.movePhoto(db, boardId, photoId, step));
    },

    deletePhoto(photo) {
      return change(async (db) => {
        await customBoardsRepo.deletePhoto(db, photo.boardId, photo.id);
        deletePhotoFiles(photo);
        const next = new Set(missingPhotoIds);
        next.delete(photo.id);
        missingPhotoIds = next;
      });
    },

    deleteBoard(boardId) {
      return change(async (db) => {
        await customBoardsRepo.remove(db, boardId);
        deleteBoardFiles(boardId);
      });
    },
  };
});

/** Photos of a board that can be played (files present). */
export function playablePhotos(board: CustomBoard): CustomBoard['photos'] {
  return board.photos.filter((p) => !p.fileMissing);
}

/** Converts a custom board into a playable Board (photos with missing files left out). */
export function toGameBoard(board: CustomBoard): Board {
  const photos = playablePhotos(board);
  const cover = photos.find((p) => p.id === board.coverPhotoId) ?? photos[0];
  return {
    id: board.id,
    kind: 'custom',
    name: board.name,
    cardBack: board.cardBack,
    accent: colors.button.danger.face,
    coverImageId: cover?.id ?? '',
    images: photos.map((p, i) => ({
      id: p.id,
      label: i18n.t('myBoards.photoLabel', { n: i + 1 }),
      source: { uri: boardFileUri(board.id, p.cardFile) },
      kind: 'photo',
      background: colors.card.face,
    })),
  };
}

export function thumbUri(photo: PhotoRecord): string {
  return boardFileUri(photo.boardId, photo.thumbFile);
}

export function sourceUri(photo: PhotoRecord): string {
  return boardFileUri(photo.boardId, photo.sourceFile);
}
