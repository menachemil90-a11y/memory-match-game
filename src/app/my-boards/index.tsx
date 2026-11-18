import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BoardTile } from '@/features/boards/components/BoardTile';
import { BoardsLoadError } from '@/features/boards/components/BoardsLoadError';
import { CreateBoardTile } from '@/features/boards/components/CreateBoardTile';
import { ConfirmDeleteBoard } from '@/features/boards/custom/ConfirmDeleteBoard';
import type { Board } from '@/features/boards/types';
import { useCustomBoardsStatus, useCustomGameBoards } from '@/features/boards/useBoard';
import { AppText, IconButton, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export default function MyBoardsScreen() {
  const { t } = useTranslation();
  const status = useCustomBoardsStatus();
  const boards = useCustomGameBoards();
  const [toDelete, setToDelete] = useState<Board | null>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const content = width - insets.left - insets.right - spacing.lg * 2;
  const columns = content >= 760 ? 4 : content >= 520 ? 3 : 2;
  const tile = Math.floor((content - spacing.md * (columns - 1)) / columns);
  const edit = (board: Board) => router.push(`/my-boards/${board.id}`);

  return (
    <Screen title={t('myBoards.title')} scroll>
      {status === 'failed' ? <BoardsLoadError /> : null}
      {status === 'ready' && boards.length === 0 ? (
        <AppText
          variant="heading"
          color={colors.textOnDarkMuted}
          align="center"
          style={styles.empty}
        >
          {t('myBoards.empty')}
        </AppText>
      ) : null}
      <View style={styles.grid}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <CreateBoardTile width={tile} onPress={() => router.push('/my-boards/new')} />
        </Animated.View>
        {boards.map((board, i) => (
          <Animated.View key={board.id} entering={FadeInDown.delay((i + 1) * 40).duration(300)}>
            <BoardTile
              board={board}
              width={tile}
              onPress={() => edit(board)}
              actions={
                <>
                  <IconButton
                    icon="pencil"
                    size={40}
                    accessibilityLabel={t('myBoards.editBoardNamed', { name: board.name ?? '' })}
                    onPress={() => edit(board)}
                  />
                  <IconButton
                    icon="trash"
                    size={40}
                    variant="danger"
                    accessibilityLabel={t('myBoards.deleteBoardNamed', { name: board.name ?? '' })}
                    onPress={() => setToDelete(board)}
                  />
                </>
              }
            />
          </Animated.View>
        ))}
      </View>
      <ConfirmDeleteBoard
        board={toDelete ? { id: toDelete.id, name: toDelete.name ?? '' } : null}
        onClose={() => setToDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { marginBottom: spacing.xl, marginHorizontal: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
