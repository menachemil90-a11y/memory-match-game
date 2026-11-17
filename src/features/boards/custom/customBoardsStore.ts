import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

import { getDb } from '@/lib/db';
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
} from './photoStorage';
import {
  CUSTOM_BOARD_PREFIX,
  MAX_BOARD_NAME_LENGTH,
  type CustomBoardRecord,
  type PhotoRecord,
} from './types';

export interface ImportProgress {
  done: number;
  total: number;
}

interface CustomBoardsState {
  boards: CustomBoardRecord[];
  /** Photo ids whose files are gone (e.g. storage cleaned up), per board. */
  missing: Record<string, string[]>;
  loaded: boolean;
  load: () => Promise<void>;
  createBoard: (name: string) => Promise<string>;
  importPhotos: (
    boardId: string,
    uris: string[],
    onProgress?: (p: ImportProgress) => void,
  ) => Promise<{ addedIds: string[]; failed: number }>;
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

/** Checks files on disk; regenerates a lost card from its source copy when possible. */
async function checkFiles(boards: CustomBoardRecord[]): Promise<Record<string, string[]>> {
  const db = await getDb();
  const missing: Record<string, string[]> = {};
  for (const board of boards) {
    for (const photo of board.photos) {
      const cardOk = boardFileExists(board.id, photo.cardFile);
      const thumbOk = boardFileExists(board.id, photo.thumbFile);
      if (cardOk && thumbOk) continue;
      if (boardFileExists(board.id, photo.sourceFile)) {
        try {
          const files = await renderCardFiles(
            board.id,
            photo.id,
            photo.sourceFile,
            { width: photo.sourceWidth, height: photo.sourceHeight },
            photo.crop,
          );
          await customBoardsRepo.updatePhoto(db, { ...photo, ...files });
          Object.assign(photo, files);
          continue;
        } catch {
          // Fall through: treat as missing.
        }
      }
      (missing[board.id] ??= []).push(photo.id);
    }
  }
  return missing;
}

export const useCustomBoards = create<CustomBoardsState>()((set, get) => {
  const reload = async () => {
    const db = await getDb();
    const boards = await customBoardsRepo.list(db);
    set({ boards, loaded: true });
    return boards;
  };

  return {
    boards: [],
    missing: {},
    loaded: false,

    async load() {
      const boards = await reload();
      const missing = await checkFiles(boards);
      set({ missing, boards: [...get().boards] });
    },

    async createBoard(name) {
      const db = await getDb();
      const id = `${CUSTOM_BOARD_PREFIX}${Crypto.randomUUID()}`;
      const cardBack = CARD_BACK_IDS[get().boards.length % CARD_BACK_IDS.length]!;
      await customBoardsRepo.create(db, { id, name: sanitizeBoardName(name), cardBack });
      await reload();
      return id;
    },

    async importPhotos(boardId, uris, onProgress) {
      assertFreeSpace(uris.length);
      const db = await getDb();
      const addedIds: string[] = [];
      let failed = 0;
      onProgress?.({ done: 0, total: uris.length });
      for (const [i, uri] of uris.entries()) {
        try {
          const photo = await importPhoto(boardId, uri);
          await customBoardsRepo.addPhotos(db, boardId, [photo]);
          addedIds.push(photo.id);
        } catch (error) {
          failed++;
          if (error instanceof Error && /space|ENOSPC|full/i.test(error.message)) {
            await reload();
            throw error;
          }
        }
        onProgress?.({ done: i + 1, total: uris.length });
      }
      await reload();
      return { addedIds, failed };
    },

    async saveCrop(photo, crop) {
      const db = await getDb();
      const files = await renderCardFiles(
        photo.boardId,
        photo.id,
        photo.sourceFile,
        { width: photo.sourceWidth, height: photo.sourceHeight },
        crop,
      );
      await customBoardsRepo.updatePhoto(db, { ...photo, crop, ...files });
      deleteCardFiles(photo.boardId, photo);
      await reload();
    },

    async rename(boardId, name) {
      const clean = sanitizeBoardName(name);
      if (!clean) return;
      await customBoardsRepo.rename(await getDb(), boardId, clean);
      await reload();
    },

    async setCardBack(boardId, cardBack) {
      await customBoardsRepo.setCardBack(await getDb(), boardId, cardBack);
      await reload();
    },

    async setCover(boardId, photoId) {
      await customBoardsRepo.setCover(await getDb(), boardId, photoId);
      await reload();
    },

    async movePhoto(boardId, photoId, step) {
      await customBoardsRepo.movePhoto(await getDb(), boardId, photoId, step);
      await reload();
    },

    async deletePhoto(photo) {
      await customBoardsRepo.deletePhoto(await getDb(), photo.boardId, photo.id);
      deletePhotoFiles(photo);
      const missing = { ...get().missing };
      if (missing[photo.boardId]) {
        missing[photo.boardId] = missing[photo.boardId]!.filter((id) => id !== photo.id);
      }
      set({ missing });
      await reload();
    },

    async deleteBoard(boardId) {
      await customBoardsRepo.remove(await getDb(), boardId);
      deleteBoardFiles(boardId);
      await reload();
    },
  };
});

/** Converts a stored custom board into a playable Board (missing photos left out). */
export function toGameBoard(record: CustomBoardRecord, missingIds: readonly string[] = []): Board {
  const photos = record.photos.filter((p) => !missingIds.includes(p.id));
  const cover = photos.find((p) => p.id === record.coverPhotoId) ?? photos[0] ?? record.photos[0];
  return {
    id: record.id,
    kind: 'custom',
    name: record.name,
    cardBack: record.cardBack,
    accent: colors.button.danger.face,
    coverImageId: cover?.id ?? '',
    images: photos.map((p, i) => ({
      id: p.id,
      label: i18n.t('myBoards.photoLabel', { n: i + 1 }),
      source: { uri: boardFileUri(record.id, p.cardFile) },
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
