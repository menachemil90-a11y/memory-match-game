import { useEffect, useMemo } from 'react';

import type { Board } from '../types';

import { toGameBoard, useCustomBoards, type BoardsStatus } from './customBoardsStore';

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
