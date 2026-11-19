import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Board, BoardImage } from '@/features/boards/types';
import { sample } from '@/game';
import { secureRandom } from '@/lib/secureRandom';

import { ROOM_CARD_PX, ROOM_CARD_QUALITY } from './roomPhotos';

/**
 * Host side of a photo room (app only — uses native image and file modules).
 * The friend who joins never runs any of this: they never upload anything.
 */

/** Picks which of the board's photos go to the room: exactly `count`, at random. */
export function pickRoomPhotos(board: Board, count: number): BoardImage[] {
  if (board.images.length < count) {
    throw new Error(`Board has ${board.images.length} photos, the level needs ${count}`);
  }
  return sample(board.images, count, secureRandom);
}

/** A smaller copy of an already cropped card, as JPEG bytes for the upload. */
export async function roomCardJpeg(image: BoardImage): Promise<ArrayBuffer> {
  if (typeof image.source === 'number') throw new Error('Not a photo card');
  const rendered = await ImageManipulator.manipulate(image.source.uri)
    .resize({ width: ROOM_CARD_PX, height: ROOM_CARD_PX })
    .renderAsync();
  const saved = await rendered.saveAsync({ compress: ROOM_CARD_QUALITY, format: SaveFormat.JPEG });
  const file = new File(saved.uri);
  try {
    return await file.arrayBuffer();
  } finally {
    // The temporary copy is not kept on the device.
    if (file.exists) file.delete();
  }
}
