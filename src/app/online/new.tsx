import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getBuiltinBoard } from '@/features/boards/builtin';
import { useBoardName } from '@/features/boards/useBoard';
import { LevelTile } from '@/features/levels/LevelTile';
import { useOnline } from '@/features/online/onlineStore';
import { useOnlineError } from '@/features/online/useOnlineError';
import { usePlayersStore } from '@/features/players/playersStore';
import { getLevelAvailability, type LevelId } from '@/game';
import { AppText, Dialog, GameButton, ProgressOverlay, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

/** Host: choose the level for a new online game (built-in boards only). */
export default function NewOnlineGameScreen() {
  const { t } = useTranslation();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const board = boardId ? (getBuiltinBoard(boardId) ?? null) : null;
  const boardName = useBoardName(board);
  const createRoom = useOnline((s) => s.createRoom);
  const profile = usePlayersStore((s) => s.online);
  const error = useOnlineError();
  const [busy, setBusy] = useState(false);

  if (!board) {
    return (
      <Screen title={t('online.chooseLevel')}>
        <AppText variant="heading" color={colors.textOnDark} align="center">
          {t('boards.notFound')}
        </AppText>
      </Screen>
    );
  }

  const create = async (levelId: LevelId) => {
    if (busy) return;
    setBusy(true);
    try {
      const room = await createRoom(board.id, levelId, profile.name, profile.avatar);
      router.replace(`/online/${room.code}`);
    } catch (e) {
      error.show(e);
    } finally {
      setBusy(false);
    }
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
            onPress={() => void create(a.level.id)}
          />
        ))}
      </View>
      <ProgressOverlay visible={busy} label={t('online.connecting')} progress={null} />
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
