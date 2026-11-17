import type { Db } from '@/lib/db/types';

import type { CardBackId } from '../builtin/types';

import type { Rotation } from './cropMath';
import type { CustomBoardRecord, PhotoRecord } from './types';

interface BoardRow {
  id: string;
  name: string;
  card_back: string;
  cover_photo_id: string | null;
  created_at: number;
  updated_at: number;
}

interface PhotoRow {
  id: string;
  board_id: string;
  position: number;
  source_file: string;
  card_file: string;
  thumb_file: string;
  source_width: number;
  source_height: number;
  crop_rotation: number;
  crop_x: number;
  crop_y: number;
  crop_size: number;
  created_at: number;
}

const toRotation = (r: number): Rotation => (r === 90 || r === 180 || r === 270 ? r : 0);

function toPhoto(r: PhotoRow): PhotoRecord {
  return {
    id: r.id,
    boardId: r.board_id,
    position: r.position,
    sourceFile: r.source_file,
    cardFile: r.card_file,
    thumbFile: r.thumb_file,
    sourceWidth: r.source_width,
    sourceHeight: r.source_height,
    crop: {
      rotation: toRotation(r.crop_rotation),
      originX: r.crop_x,
      originY: r.crop_y,
      size: r.crop_size,
    },
    createdAt: r.created_at,
  };
}

function toBoard(r: BoardRow, photos: PhotoRecord[]): CustomBoardRecord {
  return {
    id: r.id,
    name: r.name,
    cardBack: r.card_back as CardBackId,
    coverPhotoId: r.cover_photo_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    photos,
  };
}

export type NewPhoto = Omit<PhotoRecord, 'position' | 'boardId' | 'createdAt'>;

async function touch(db: Db, boardId: string, now: number) {
  await db.runAsync('UPDATE custom_boards SET updated_at = ? WHERE id = ?', now, boardId);
}

/** SQLite persistence for custom photo boards. Files are handled by photoStorage. */
export const customBoardsRepo = {
  async list(db: Db): Promise<CustomBoardRecord[]> {
    const boards = await db.getAllAsync<BoardRow>(
      'SELECT * FROM custom_boards ORDER BY updated_at DESC, created_at DESC',
    );
    const photos = await db.getAllAsync<PhotoRow>(
      'SELECT * FROM custom_photos ORDER BY board_id, position',
    );
    const byBoard = new Map<string, PhotoRecord[]>();
    for (const p of photos) {
      const list = byBoard.get(p.board_id) ?? [];
      list.push(toPhoto(p));
      byBoard.set(p.board_id, list);
    }
    return boards.map((b) => toBoard(b, byBoard.get(b.id) ?? []));
  },

  async get(db: Db, id: string): Promise<CustomBoardRecord | null> {
    const board = await db.getFirstAsync<BoardRow>('SELECT * FROM custom_boards WHERE id = ?', id);
    if (!board) return null;
    const photos = await db.getAllAsync<PhotoRow>(
      'SELECT * FROM custom_photos WHERE board_id = ? ORDER BY position',
      id,
    );
    return toBoard(board, photos.map(toPhoto));
  },

  async create(
    db: Db,
    board: { id: string; name: string; cardBack: CardBackId },
    now: number = Date.now(),
  ): Promise<void> {
    await db.runAsync(
      'INSERT INTO custom_boards (id, name, card_back, cover_photo_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      board.id,
      board.name,
      board.cardBack,
      now,
      now,
    );
  },

  async rename(db: Db, id: string, name: string, now: number = Date.now()): Promise<void> {
    await db.runAsync(
      'UPDATE custom_boards SET name = ?, updated_at = ? WHERE id = ?',
      name,
      now,
      id,
    );
  },

  async setCardBack(db: Db, id: string, cardBack: CardBackId, now = Date.now()): Promise<void> {
    await db.runAsync(
      'UPDATE custom_boards SET card_back = ?, updated_at = ? WHERE id = ?',
      cardBack,
      now,
      id,
    );
  },

  async setCover(db: Db, id: string, photoId: string | null, now = Date.now()): Promise<void> {
    await db.runAsync(
      'UPDATE custom_boards SET cover_photo_id = ?, updated_at = ? WHERE id = ?',
      photoId,
      now,
      id,
    );
  },

  /** Appends photos after the existing ones, in the given order. */
  async addPhotos(db: Db, boardId: string, photos: NewPhoto[], now = Date.now()): Promise<void> {
    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<{ next: number | null }>(
        'SELECT MAX(position) + 1 AS next FROM custom_photos WHERE board_id = ?',
        boardId,
      );
      let position = row?.next ?? 0;
      for (const p of photos) {
        await db.runAsync(
          `INSERT INTO custom_photos (id, board_id, position, source_file, card_file, thumb_file,
             source_width, source_height, crop_rotation, crop_x, crop_y, crop_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          p.id,
          boardId,
          position++,
          p.sourceFile,
          p.cardFile,
          p.thumbFile,
          p.sourceWidth,
          p.sourceHeight,
          p.crop.rotation,
          p.crop.originX,
          p.crop.originY,
          p.crop.size,
          now,
        );
      }
      await touch(db, boardId, now);
    });
  },

  async updatePhoto(
    db: Db,
    photo: Pick<PhotoRecord, 'id' | 'boardId' | 'crop' | 'cardFile' | 'thumbFile'>,
    now = Date.now(),
  ): Promise<void> {
    await db.runAsync(
      `UPDATE custom_photos SET crop_rotation = ?, crop_x = ?, crop_y = ?, crop_size = ?,
         card_file = ?, thumb_file = ? WHERE id = ?`,
      photo.crop.rotation,
      photo.crop.originX,
      photo.crop.originY,
      photo.crop.size,
      photo.cardFile,
      photo.thumbFile,
      photo.id,
    );
    await touch(db, photo.boardId, now);
  },

  /** Deletes a photo, closes the gap in positions and clears it as cover. */
  async deletePhoto(db: Db, boardId: string, photoId: string, now = Date.now()): Promise<void> {
    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<{ position: number }>(
        'SELECT position FROM custom_photos WHERE id = ? AND board_id = ?',
        photoId,
        boardId,
      );
      if (!row) return;
      await db.runAsync('DELETE FROM custom_photos WHERE id = ?', photoId);
      await db.runAsync(
        'UPDATE custom_photos SET position = position - 1 WHERE board_id = ? AND position > ?',
        boardId,
        row.position,
      );
      await db.runAsync(
        'UPDATE custom_boards SET cover_photo_id = NULL WHERE id = ? AND cover_photo_id = ?',
        boardId,
        photoId,
      );
      await touch(db, boardId, now);
    });
  },

  /** Moves a photo one step earlier (-1) or later (+1). */
  async movePhoto(db: Db, boardId: string, photoId: string, step: -1 | 1, now = Date.now()) {
    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<{ position: number }>(
        'SELECT position FROM custom_photos WHERE id = ? AND board_id = ?',
        photoId,
        boardId,
      );
      if (!row) return;
      const target = row.position + step;
      const other = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM custom_photos WHERE board_id = ? AND position = ?',
        boardId,
        target,
      );
      if (!other) return;
      await db.runAsync(
        'UPDATE custom_photos SET position = ? WHERE id = ?',
        row.position,
        other.id,
      );
      await db.runAsync('UPDATE custom_photos SET position = ? WHERE id = ?', target, photoId);
      await touch(db, boardId, now);
    });
  },

  async remove(db: Db, id: string): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM custom_photos WHERE board_id = ?', id);
      await db.runAsync('DELETE FROM custom_boards WHERE id = ?', id);
      await db.runAsync('DELETE FROM layout_history WHERE board_id = ?', id);
      await db.runAsync('DELETE FROM best_scores WHERE board_id = ?', id);
    });
  },
};
