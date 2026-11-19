import type { Board, BoardImage } from '@/features/boards/types';

/**
 * Privacy rule: only app users upload photos. The web game can't create photo
 * rooms (its board picker shows built-in boards only), so these are never
 * called on the web; if they were, that would be a bug — fail loudly.
 */
const APP_ONLY = 'Photo games are created in the app; the web game never uploads photos.';

export function pickRoomPhotos(_board: Board, _count: number): BoardImage[] {
  throw new Error(APP_ONLY);
}

export function roomCardJpeg(_image: BoardImage): Promise<ArrayBuffer> {
  return Promise.reject(new Error(APP_ONLY));
}
