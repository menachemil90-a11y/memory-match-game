import type { CardBackId } from '../builtin/types';

import type { CropParams } from './cropMath';

/** A photo on a custom board. File names are relative to the board's folder. */
export interface PhotoRecord {
  id: string;
  boardId: string;
  position: number;
  sourceFile: string;
  cardFile: string;
  thumbFile: string;
  sourceWidth: number;
  sourceHeight: number;
  crop: CropParams;
  createdAt: number;
}

export interface CustomBoardRecord {
  id: string;
  name: string;
  cardBack: CardBackId;
  coverPhotoId: string | null;
  createdAt: number;
  updatedAt: number;
  photos: PhotoRecord[];
}

export const MAX_BOARD_NAME_LENGTH = 24;
export const CUSTOM_BOARD_PREFIX = 'custom-';

/**
 * A photo as the app uses it: the stored record plus whether its files are on
 * the device. Missing-file state lives on the photo itself so that screens can
 * select a board with a plain lookup (stable references, no derived arrays).
 */
export interface CustomPhoto extends PhotoRecord {
  fileMissing: boolean;
}

export interface CustomBoard extends Omit<CustomBoardRecord, 'photos'> {
  photos: CustomPhoto[];
}
