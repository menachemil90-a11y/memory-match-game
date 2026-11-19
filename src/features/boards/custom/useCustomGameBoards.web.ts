import type { Board } from '../types';

import type { BoardsStatus } from './customBoardsStore';

/**
 * The web game has no photo boards: making them (and keeping them) is an app
 * feature, and web players never upload photos. A web guest still sees a
 * host's photo cards in an online room — those come from the server
 * (src/features/online/roomPhotos.ts), not from here.
 */
const NONE: Board[] = [];

export function useCustomBoardsStatus(): BoardsStatus {
  return 'ready';
}

export function useCustomGameBoards(): Board[] {
  return NONE;
}
