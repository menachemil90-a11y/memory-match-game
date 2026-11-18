import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog, GameButton } from '@/ui/components';

import { useCustomBoards } from './customBoardsStore';

export interface ConfirmDeleteBoardProps {
  /** The board to delete, or null when the dialog is closed. */
  board: { id: string; name: string } | null;
  onClose: () => void;
  /** Called after the board and its files were removed from the device. */
  onDeleted?: () => void;
}

/** "Delete <board>?" confirmation. Errors are shown in the dialog, never dropped. */
export function ConfirmDeleteBoard({ board, onClose, onDeleted }: ConfirmDeleteBoardProps) {
  const { t } = useTranslation();
  const deleteBoard = useCustomBoards((s) => s.deleteBoard);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    setFailed(false);
    onClose();
  };

  const confirm = async () => {
    if (!board || busy) return;
    setBusy(true);
    try {
      await deleteBoard(board.id);
      setFailed(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      console.error('Deleting a board failed', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={board !== null}
      title={board ? t('myBoards.deleteBoardTitle', { name: board.name }) : ''}
      message={failed ? t('myBoards.saveFailed') : t('myBoards.deleteBoardMessage')}
      onRequestClose={close}
    >
      <GameButton label={t('common.cancel')} variant="secondary" size="md" onPress={close} />
      <GameButton
        label={t('common.delete')}
        icon="trash"
        variant="danger"
        size="md"
        disabled={busy}
        onPress={() => void confirm()}
        testID="confirm-delete-board"
      />
    </Dialog>
  );
}
