import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

import { centerCrop, rotatedSize, toPixelRect, type CropParams, type Size } from './cropMath';
import type { NewPhoto } from './customBoardsRepo';
import type { PhotoRecord } from './types';

/** Longest side of the kept source copy (for re-cropping later). */
export const SOURCE_MAX_PX = 1600;
/** Final card image size (square). */
export const CARD_PX = 700;
export const THUMB_PX = 200;
const SOURCE_QUALITY = 0.88;
const CARD_QUALITY = 0.8;
/** Keep a safety margin of free space; one photo needs roughly 0.6 MB. */
export const MIN_FREE_BYTES = 40 * 1024 * 1024;
export const BYTES_PER_PHOTO = 1024 * 1024;

export class LowStorageError extends Error {
  constructor() {
    super('Not enough free storage');
    this.name = 'LowStorageError';
  }
}

const boardsRoot = () => new Directory(Paths.document, 'boards');
const boardDir = (boardId: string) => new Directory(Paths.document, 'boards', boardId);

/** File URI of a stored board file (paths are stored relative, the root can move on iOS). */
export function boardFileUri(boardId: string, name: string): string {
  return new File(Paths.document, 'boards', boardId, name).uri;
}

export function boardFileExists(boardId: string, name: string): boolean {
  return new File(Paths.document, 'boards', boardId, name).exists;
}

function ensureBoardDir(boardId: string): void {
  const root = boardsRoot();
  if (!root.exists) root.create({ intermediates: true, idempotent: true });
  const dir = boardDir(boardId);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

/** Throws LowStorageError when there is not enough room for `photoCount` photos. */
export function assertFreeSpace(photoCount: number): void {
  let free = Number.POSITIVE_INFINITY;
  try {
    free = Paths.availableDiskSpace;
  } catch {
    // Unknown → let the write itself fail if it must.
  }
  if (free < MIN_FREE_BYTES + photoCount * BYTES_PER_PHOTO) throw new LowStorageError();
}

async function saveJpeg(ref: ImageRef, boardId: string, name: string, quality: number) {
  const result = await ref.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  const dest = new File(Paths.document, 'boards', boardId, name);
  if (dest.exists) dest.delete();
  new File(result.uri).moveSync(dest);
}

const stamp = () => Date.now().toString(36);

/**
 * Renders the 700×700 card and a thumbnail from the source copy. File names
 * are versioned so image caches never show a stale crop.
 */
export async function renderCardFiles(
  boardId: string,
  photoId: string,
  sourceFile: string,
  sourceSize: Size,
  crop: CropParams,
): Promise<{ cardFile: string; thumbFile: string }> {
  ensureBoardDir(boardId);
  const rotated = rotatedSize(sourceSize, crop.rotation);
  const rect = toPixelRect(crop, rotated);
  const ctx = ImageManipulator.manipulate(boardFileUri(boardId, sourceFile));
  if (crop.rotation !== 0) ctx.rotate(crop.rotation);
  ctx.crop(rect).resize({ width: CARD_PX, height: CARD_PX });
  const card = await ctx.renderAsync();
  const version = stamp();
  const cardFile = `${photoId}-card-${version}.jpg`;
  const thumbFile = `${photoId}-thumb-${version}.jpg`;
  await saveJpeg(card, boardId, cardFile, CARD_QUALITY);
  const thumb = await ImageManipulator.manipulate(card)
    .resize({ width: THUMB_PX, height: THUMB_PX })
    .renderAsync();
  await saveJpeg(thumb, boardId, thumbFile, CARD_QUALITY);
  return { cardFile, thumbFile };
}

/**
 * Imports one picked photo: keeps a downscaled source copy (≤1600px), then
 * auto-crops the centered square into the card and thumbnail.
 */
export async function importPhoto(boardId: string, pickedUri: string): Promise<NewPhoto> {
  ensureBoardDir(boardId);
  const id = Crypto.randomUUID();
  // Decode already downsampled, so huge camera photos never fill memory.
  let source = await ImageManipulator.manipulate(pickedUri, {
    maxWidth: SOURCE_MAX_PX,
    maxHeight: SOURCE_MAX_PX,
  }).renderAsync();
  const longest = Math.max(source.width, source.height);
  if (longest > SOURCE_MAX_PX) {
    const scale = SOURCE_MAX_PX / longest;
    source = await ImageManipulator.manipulate(source)
      .resize({
        width: Math.round(source.width * scale),
        height: Math.round(source.height * scale),
      })
      .renderAsync();
  }
  const sourceFile = `${id}-src.jpg`;
  const sourceSize = { width: source.width, height: source.height };
  await saveJpeg(source, boardId, sourceFile, SOURCE_QUALITY);
  const crop: CropParams = { rotation: 0, ...centerCrop(sourceSize) };
  const files = await renderCardFiles(boardId, id, sourceFile, sourceSize, crop);
  return {
    id,
    sourceFile,
    ...files,
    sourceWidth: sourceSize.width,
    sourceHeight: sourceSize.height,
    crop,
  };
}

/** Deletes a board file if it is there. Real I/O errors propagate to the caller. */
function deleteIfExists(boardId: string, name: string): void {
  const f = new File(Paths.document, 'boards', boardId, name);
  if (f.exists) f.delete();
}

export function deleteCardFiles(boardId: string, files: { cardFile: string; thumbFile: string }) {
  deleteIfExists(boardId, files.cardFile);
  deleteIfExists(boardId, files.thumbFile);
}

export function deletePhotoFiles(
  photo: Pick<PhotoRecord, 'boardId' | 'sourceFile' | 'cardFile' | 'thumbFile'>,
) {
  deleteIfExists(photo.boardId, photo.sourceFile);
  deleteCardFiles(photo.boardId, photo);
}

/** Removes a board's folder with every file in it. */
export function deleteBoardFiles(boardId: string): void {
  const dir = boardDir(boardId);
  if (dir.exists) dir.delete();
}

type StoredFiles = Pick<PhotoRecord, 'sourceFile' | 'cardFile' | 'thumbFile'>;

/**
 * Deletes every file under the boards folder that no saved board/photo refers
 * to: folders of deleted boards, files of deleted photos, old crop versions and
 * half-written imports (e.g. the app was closed mid-way). Returns how many
 * entries were removed. Must not run while photos are being imported.
 */
export function sweepOrphanFiles(
  boards: readonly { id: string; photos: readonly StoredFiles[] }[],
): number {
  const root = boardsRoot();
  if (!root.exists) return 0;
  const keep = new Map(
    boards.map((b) => [
      b.id,
      new Set(b.photos.flatMap((p) => [p.sourceFile, p.cardFile, p.thumbFile])),
    ]),
  );
  let removed = 0;
  for (const entry of root.list()) {
    const files = keep.get(entry.name);
    if (!(entry instanceof Directory) || !files) {
      entry.delete();
      removed++;
      continue;
    }
    for (const file of entry.list()) {
      if (!files.has(file.name)) {
        file.delete();
        removed++;
      }
    }
  }
  return removed;
}
