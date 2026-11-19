import { CARD_BACK_IDS } from '@/features/boards/builtin';
import type { CardBackId } from '@/features/boards/builtin/types';
import type { Board, BoardImage } from '@/features/boards/types';
import { i18n } from '@/lib/i18n';
import { colors } from '@/ui/theme';

import type { RoomRow } from './room';

/**
 * Online games on the host's photo board. The host uploads one small card per
 * pair into a PRIVATE Supabase Storage bucket; both players read them through
 * short-lived signed URLs (works in the app and in a web browser). The server
 * deletes them when the room closes, at the latest after 24 hours
 * (supabase/migrations/…_photo_rooms.sql).
 *
 * This module has no native imports so a web player can use it too.
 */
export const ROOM_PHOTOS_BUCKET = 'room-photos';
/** Longest side of an uploaded card (px). Small on purpose: data minimisation. */
export const ROOM_CARD_PX = 480;
export const ROOM_CARD_QUALITY = 0.75;
/** Signed URLs live this long; the app re-signs well before that. */
export const SIGNED_URL_SECONDS = 2 * 60 * 60;
export const RESIGN_AFTER_MS = 45 * 60 * 1000;

export type PhotoRoom = RoomRow & { photo_ids: string[] };

export function isPhotoRoom(room: RoomRow): room is PhotoRoom {
  return Array.isArray(room.photo_ids) && room.photo_ids.length > 0;
}

export function roomPhotoPath(roomId: string, imageId: string): string {
  return `${roomId}/${imageId}.jpg`;
}

export function roomPhotoPaths(room: PhotoRoom): string[] {
  return room.photo_ids.map((id) => roomPhotoPath(room.id, id));
}

function cardBackOf(room: RoomRow): CardBackId {
  const known = CARD_BACK_IDS.find((id) => id === room.card_back);
  return known ?? CARD_BACK_IDS[0];
}

/** The board both players see in a photo room, from signed URLs (by image id). */
export function photoRoomBoard(room: PhotoRoom, urls: ReadonlyMap<string, string>): Board {
  const images: BoardImage[] = room.photo_ids.map((id, i) => {
    const uri = urls.get(id);
    if (!uri) throw new Error(`No signed URL for photo ${id}`);
    return {
      id,
      label: i18n.t('myBoards.photoLabel', { n: i + 1 }),
      source: { uri },
      kind: 'photo',
      background: colors.card.face,
      ephemeral: true,
    };
  });
  return {
    id: `room:${room.id}`,
    kind: 'custom',
    name: null,
    cardBack: cardBackOf(room),
    accent: colors.button.danger.face,
    coverImageId: images[0]?.id ?? '',
    images,
  };
}
