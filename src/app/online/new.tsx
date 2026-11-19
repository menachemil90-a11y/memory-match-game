import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useBoard, useBoardName } from '@/features/boards/useBoard';
import { LevelTile } from '@/features/levels/LevelTile';
import { useOnline, type PhotoUploadProgress } from '@/features/online/onlineStore';
import { useOnlineError } from '@/features/online/useOnlineError';
import { usePlayersStore } from '@/features/players/playersStore';
import { getLevel, getLevelAvailability, type LevelId } from '@/game';
import { AppText, Dialog, GameButton, ProgressOverlay, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

/**
 * Host: choose the level for a new online game. Built-in boards open a room
 * right away; a photo board first asks for consent (its cards are sent to the
 * server for this one game) and then uploads them.
 */
export default function NewOnlineGameScreen() {
  const { t } = useTranslation();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const board = useBoard(boardId);
  const boardName = useBoardName(board);
  const createRoom = useOnline((s) => s.createRoom);
  const createPhotoRoom = useOnline((s) => s.createPhotoRoom);
  const profile = usePlayersStore((s) => s.online);
  const error = useOnlineError();
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<PhotoUploadProgress | null>(null);
  const [confirmLevel, setConfirmLevel] = useState<LevelId | null>(null);

  if (!board) {
    return (
      <Screen title={t('online.chooseLevel')}>
        <AppText variant="heading" color={colors.textOnDark} align="center">
          {t('boards.notFound')}
        </AppText>
      </Screen>
    );
  }
  const isPhotoBoard = board.kind === 'custom';

  const create = async (levelId: LevelId) => {
    if (busy) return;
    setConfirmLevel(null);
    setBusy(true);
    try {
      const room = isPhotoBoard
        ? await createPhotoRoom(board, levelId, profile.name, profile.avatar, setUpload)
        : await createRoom(board.id, levelId, profile.name, profile.avatar);
      router.replace(`/online/${room.code}`);
    } catch (e) {
      error.show(e);
    } finally {
      setBusy(false);
      setUpload(null);
    }
  };

  const choose = (levelId: LevelId) => {
    if (isPhotoBoard) setConfirmLevel(levelId);
    else void create(levelId);
  };

  return (
    <Screen title={t('online.chooseLevel')} scroll>
      <AppText variant="title" color={colors.textOnDark} style={styles.title}>
        {boardName}
      </AppText>
      <View style={styles.grid}>
        {getLevelAvailability(board.images.length).map((a) => (
          <LevelTile
            key={a.level.id}
            availability={a}
            showBest={false}
            onPress={() => choose(a.level.id)}
          />
        ))}
      </View>
      <ProgressOverlay
        visible={busy}
        label={
          upload
            ? t('online.sharingPhotos', { done: upload.done, total: upload.total })
            : t('online.connecting')
        }
        progress={upload && upload.total > 0 ? upload.done / upload.total : null}
      />
      <Dialog
        visible={confirmLevel !== null}
        title={t('online.shareTitle')}
        message={
          confirmLevel
            ? t('online.shareMessage', { count: getLevel(confirmLevel).pairs, name: boardName })
            : undefined
        }
        onRequestClose={() => setConfirmLevel(null)}
      >
        <GameButton
          label={t('online.shareConfirm')}
          icon="lock-closed"
          variant="success"
          size="md"
          onPress={() => confirmLevel && void create(confirmLevel)}
        />
        <GameButton
          label={t('common.cancel')}
          variant="secondary"
          size="md"
          onPress={() => setConfirmLevel(null)}
        />
      </Dialog>
      <Dialog
        visible={error.message !== null}
        title={error.message ?? ''}
        onRequestClose={error.clear}
      >
        <GameButton label={t('common.ok')} size="md" onPress={error.clear} />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
