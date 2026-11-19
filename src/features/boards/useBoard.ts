import { useTranslation } from 'react-i18next';

import { getBuiltinBoard, isBuiltinBoardId } from './builtin';
import { CUSTOM_BOARD_PREFIX } from './custom/types';
import { useCustomGameBoards } from './custom/useCustomGameBoards';
import type { Board } from './types';

export { useCustomBoardsStatus, useCustomGameBoards } from './custom/useCustomGameBoards';

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
