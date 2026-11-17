import { useTranslation } from 'react-i18next';

import { getBuiltinBoard, isBuiltinBoardId } from './builtin';
import type { Board } from './types';

/**
 * Looks up a board by id. Built-in boards resolve synchronously; custom
 * boards are added in Phase 4.
 */
export function useBoard(boardId: string | undefined): Board | null {
  if (!boardId) return null;
  return getBuiltinBoard(boardId) ?? null;
}

/** Display name of a board (translated for built-in boards). */
export function useBoardName(board: Board | null): string {
  const { t } = useTranslation();
  if (!board) return '';
  if (board.kind === 'builtin' && isBuiltinBoardId(board.id)) return t(`boards.names.${board.id}`);
  return board.name ?? '';
}
