import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, GameButton } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';

import { useCustomBoards } from '../custom/customBoardsStore';

/** Shown when the photo boards couldn't be read from the device, with a retry. */
export function BoardsLoadError() {
  const { t } = useTranslation();
  const load = useCustomBoards((s) => s.load);
  return (
    <View style={styles.box} accessibilityRole="alert">
      <AppText variant="bodyStrong" align="center">
        {t('myBoards.loadFailed')}
      </AppText>
      <GameButton label={t('common.retry')} icon="refresh" size="md" onPress={() => void load()} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
});
