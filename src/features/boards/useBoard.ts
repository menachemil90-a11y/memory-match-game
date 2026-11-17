import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getBuiltinBoard, isBuiltinBoardId } from './builtin';
import { toGameBoard, useCustomBoards } from './custom/customBoardsStore';
import { CUSTOM_BOARD_PREFIX } from './custom/types';
import type { Board } from './types';

/** Loads custom boards from the device once (and repairs/flags missing files). */
export function useCustomBoardsLoaded(): boolean {
  const loaded = useCustomBoards((s) => s.loaded);
  const load = useCustomBoards((s) => s.load);
  useEffect(() => {
    if (!loaded) void load().catch(() => undefined);
  }, [loaded, load]);
  return loaded;
}

/** All custom boards as playable boards (missing photos left out). */
export function useCustomGameBoards(): Board[] {
  useCustomBoardsLoaded();
  const boards = useCustomBoards((s) => s.boards);
  const missing = useCustomBoards((s) => s.missing);
  return useMemo(() => boards.map((b) => toGameBoard(b, missing[b.id])), [boards, missing]);
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
