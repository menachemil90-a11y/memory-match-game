import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getBuiltinBoard, isBuiltinBoardId } from './builtin';
import { toGameBoard, useCustomBoards, type BoardsStatus } from './custom/customBoardsStore';
import { CUSTOM_BOARD_PREFIX } from './custom/types';
import type { Board } from './types';

/**
 * Loads custom boards from the device once (repairing/flagging missing files)
 * and returns the load status. A failed load is shown by the screens with a
 * "Try again" button (see BoardsLoadError) — never swallowed.
 */
export function useCustomBoardsStatus(): BoardsStatus {
  const status = useCustomBoards((s) => s.status);
  const load = useCustomBoards((s) => s.load);
  useEffect(() => {
    if (status === 'idle') void load(); // load() reports failure through `status`
  }, [status, load]);
  return status;
}

/** All custom boards as playable boards (photos with missing files left out). */
export function useCustomGameBoards(): Board[] {
  useCustomBoardsStatus();
  const boards = useCustomBoards((s) => s.boards);
  return useMemo(() => boards.map(toGameBoard), [boards]);
}

/** Looks up a built-in or custom board by id (null while loading or when not found). */
export function useBoard(boardId: string | undefined): Board | null {
  const isCustom = !!boardId?.startsWith(CUSTOM_BOARD_PREFIX);
  const customBoards = useCustomGameBoards();
  if (!boardId) return null;
  if (!isCustom) return getBuiltinBoard(boardId) ?? null;
  return customBoards.find((b) => b.id === boardId) ?? null;
}

/** Display name of a board (translated for built-in boards). */
export function useBoardName(board: Board | null): string {
  const { t } = useTranslation();
  if (!board) return '';
  if (board.kind === 'builtin' && isBuiltinBoardId(board.id)) return t(`boards.names.${board.id}`);
  return board.name ?? '';
}
