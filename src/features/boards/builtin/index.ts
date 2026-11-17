import type { Board } from '../types';

import { AVATAR_SOURCES, BUILTIN_BOARD_DATA, CARD_BACK_IDS, CARD_BACK_SOURCES } from './generated';

export { AVATAR_SOURCES, CARD_BACK_IDS, CARD_BACK_SOURCES };
export type AvatarId = keyof typeof AVATAR_SOURCES;
export const AVATAR_IDS = Object.keys(AVATAR_SOURCES) as AvatarId[];

export type BuiltinBoardId =
  'animals' | 'fruits' | 'vehicles' | 'ocean' | 'space' | 'dinosaurs' | 'food' | 'sports';

/** Built-in boards, bundled with the app so they work offline. */
export const BUILTIN_BOARDS: readonly Board[] = BUILTIN_BOARD_DATA.map((data): Board => ({
  id: data.id,
  kind: 'builtin',
  name: null,
  cardBack: data.cardBack,
  accent: data.accent,
  coverImageId: `${data.id}/${data.images[0]!.key}`,
  images: data.images.map((img) => ({
    id: `${data.id}/${img.key}`,
    label: img.label,
    source: img.source,
    kind: 'art',
    background: img.background,
  })),
}));

export function getBuiltinBoard(id: string): Board | undefined {
  return BUILTIN_BOARDS.find((b) => b.id === id);
}

export function isBuiltinBoardId(id: string): id is BuiltinBoardId {
  return BUILTIN_BOARDS.some((b) => b.id === id);
}
