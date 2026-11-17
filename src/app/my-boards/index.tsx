import { router } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BoardTile } from '@/features/boards/components/BoardTile';
import { CreateBoardTile } from '@/features/boards/components/CreateBoardTile';
import { useCustomGameBoards } from '@/features/boards/useBoard';
import { AppText, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export default function MyBoardsScreen() {
  const { t } = useTranslation();
  const boards = useCustomGameBoards();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const content = width - insets.left - insets.right - spacing.lg * 2;
  const columns = content >= 760 ? 4 : content >= 520 ? 3 : 2;
  const tile = Math.floor((content - spacing.md * (columns - 1)) / columns);

  return (
    <Screen title={t('myBoards.title')} scroll>
      {boards.length === 0 ? (
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
              onPress={() => router.push(`/my-boards/${board.id}`)}
            />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { marginBottom: spacing.xl, marginHorizontal: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
