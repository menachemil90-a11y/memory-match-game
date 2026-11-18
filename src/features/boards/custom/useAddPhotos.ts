import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MAX_BOARD_IMAGES } from '@/game';

import { useCustomBoards, type ImportProgress } from './customBoardsStore';
import { pickFromGallery, takePhoto } from './photoPicker';
import { LowStorageError } from './photoStorage';

/**
 * "Add photos" to an existing board: pick (gallery or camera) → import with
 * progress → crop queue for the new photos, which returns to this screen.
 * (New boards are created with their photos in one step: my-boards/new.)
 */
export function useAddPhotos() {
  const { t } = useTranslation();
  const importPhotos = useCustomBoards((s) => s.importPhotos);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (boardId: string, existing: number, source: 'gallery' | 'camera') => {
    const room = MAX_BOARD_IMAGES - existing;
    if (room <= 0) {
      setMessage(t('myBoards.maxReached', { max: MAX_BOARD_IMAGES }));
      return false;
    }
    const picked = source === 'camera' ? await takePhoto() : await pickFromGallery(room);
    if (picked.status === 'denied') {
      setMessage(t('myBoards.cameraDenied'));
      return false;
    }
    if (picked.status !== 'picked') return false;
    try {
      setProgress({ done: 0, total: picked.uris.length });
      const { addedIds, failed } = await importPhotos(boardId, picked.uris, setProgress);
      setProgress(null);
      if (failed > 0) setMessage(t('myBoards.importFailed', { count: failed }));
      if (addedIds.length > 0) {
        router.push({
          pathname: '/my-boards/crop',
          params: { boardId, ids: addedIds.join(','), returnTo: 'back' },
        });
      }
      return addedIds.length > 0;
    } catch (error) {
      setProgress(null);
      if (!(error instanceof LowStorageError)) console.error('Adding photos failed', error);
      setMessage(
        error instanceof LowStorageError ? t('myBoards.lowStorage') : t('myBoards.saveFailed'),
      );
      return false;
    }
  };

  return {
    run,
    progress,
    message,
    clearMessage: () => setMessage(null),
    progressLabel: progress
      ? t('myBoards.preparing', { done: progress.done, total: progress.total })
      : '',
  };
}
