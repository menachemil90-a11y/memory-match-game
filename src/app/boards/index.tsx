import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BUILTIN_BOARDS } from '@/features/boards/builtin';
import { BoardTile } from '@/features/boards/components/BoardTile';
import { CreateBoardTile } from '@/features/boards/components/CreateBoardTile';
import type { Board } from '@/features/boards/types';
import { BoardsLoadError } from '@/features/boards/components/BoardsLoadError';
import { useCustomBoardsStatus, useCustomGameBoards } from '@/features/boards/useBoard';
import { AppText, IconButton, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

type PickerMode = 'solo' | 'local' | 'online';

function parseMode(value: string | undefined): PickerMode {
  return value === 'local' || value === 'online' ? value : 'solo';
}

/** Tile width for a responsive grid: 2 columns on phones, more on tablets. */
function useTileWidth(): number {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const content = width - insets.left - insets.right - spacing.lg * 2;
  const columns = content >= 1000 ? 5 : content >= 760 ? 4 : content >= 520 ? 3 : 2;
  return Math.floor((content - spacing.md * (columns - 1)) / columns);
}

export default function BoardPickerScreen() {
  const { t } = useTranslation();
  const mode = parseMode(useLocalSearchParams<{ mode?: string }>().mode);
  const tileWidth = useTileWidth();
  const customBoards = useCustomGameBoards();
  const status = useCustomBoardsStatus();
  const allowCustom = mode !== 'online';

  const open = (board: Board) => {
    if (mode === 'online') {
      router.push({ pathname: '/online/new', params: { boardId: board.id } });
    } else {
      router.push({ pathname: '/levels', params: { mode, boardId: board.id } });
    }
  };

  const section = (title: string) => (
    <AppText variant="heading" color={colors.textOnDark} style={styles.sectionTitle}>
      {title}
    </AppText>
  );

  return (
    <Screen title={t('boards.title')} scroll>
      {allowCustom ? (
        <>
          {section(t('boards.customSection'))}
          {status === 'failed' ? <BoardsLoadError /> : null}
          <View style={styles.grid}>
            <Animated.View entering={FadeInDown.duration(300)}>
              <CreateBoardTile width={tileWidth} onPress={() => router.push('/my-boards/new')} />
            </Animated.View>
            {customBoards.map((board, i) => (
              <Animated.View key={board.id} entering={FadeInDown.delay((i + 1) * 40).duration(300)}>
                <BoardTile
                  board={board}
                  width={tileWidth}
                  onPress={() => open(board)}
                  onLongPress={() => router.push(`/my-boards/${board.id}`)}
                  actions={
                    <IconButton
                      icon="pencil"
                      size={40}
                      accessibilityLabel={t('myBoards.editBoardNamed', { name: board.name ?? '' })}
                      onPress={() => router.push(`/my-boards/${board.id}`)}
                    />
                  }
                />
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}
      {section(t('boards.builtinSection'))}
      <View style={styles.grid}>
        {BUILTIN_BOARDS.map((board, i) => (
          <Animated.View key={board.id} entering={FadeInDown.delay(i * 40).duration(300)}>
            <BoardTile board={board} width={tileWidth} onPress={() => open(board)} />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing.sm, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
});
