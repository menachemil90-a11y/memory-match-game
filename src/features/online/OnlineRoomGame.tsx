import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getBuiltinBoard } from '@/features/boards/builtin';
import { AppText, GameButton, Screen } from '@/ui/components';
import { colors, palette, radii, shadows, spacing } from '@/ui/theme';

import { OnlineGameView } from './OnlineGameView';
import { useOnline } from './onlineStore';
import type { RoomRow, Seat } from './room';
import { isPhotoRoom } from './roomPhotos';

/**
 * Picks the board for an online game: a built-in board, or — in a photo
 * room — the host's cards, loaded through signed URLs (the same for the host,
 * the friend in the app, and later a friend in a web browser).
 */
export function OnlineRoomGame({ room, seat }: { room: RoomRow; seat: Seat }) {
  const { t } = useTranslation();
  const photoRoom = isPhotoRoom(room);
  const photoBoard = useOnline((s) => s.photoBoard);
  const status = useOnline((s) => s.photoBoardStatus);
  const loadPhotoBoard = useOnline((s) => s.loadPhotoBoard);
  const leave = useOnline((s) => s.leave);

  // Every new game (rematch) re-signs the URLs if they are getting old.
  useEffect(() => {
    if (photoRoom) void loadPhotoBoard();
  }, [photoRoom, loadPhotoBoard, room.id, room.game_number]);

  const board = photoRoom
    ? photoBoard?.id === `room:${room.id}`
      ? photoBoard
      : null
    : (getBuiltinBoard(room.board_id) ?? null);

  if (board) {
    return <OnlineGameView key={room.game_number} room={room} seat={seat} board={board} />;
  }

  const failed = !photoRoom || status === 'failed';
  return (
    <Screen title={t('online.room', { code: room.code })} showBack={false}>
      <View style={styles.center}>
        <View style={styles.card}>
          {failed ? null : <ActivityIndicator size="large" color={palette.grape} />}
          <AppText variant="heading" align="center">
            {failed
              ? photoRoom
                ? t('online.photosFailed')
                : t('boards.notFound')
              : t('online.loadingPhotos')}
          </AppText>
        </View>
        {failed && photoRoom ? (
          <GameButton
            label={t('common.retry')}
            icon="refresh"
            onPress={() => void loadPhotoBoard()}
          />
        ) : null}
        <GameButton
          label={t('online.leave')}
          variant="secondary"
          size="md"
          onPress={() => {
            void leave();
            router.dismissTo('/');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    boxShadow: shadows.lg,
  },
});
