import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, PressableLink } from '@/ui/components';
import { colors, minTouchTarget, palette, radii, spacing } from '@/ui/theme';

import { useDownloadAction } from './useDownloadAction';

/**
 * The web game's top bar: the game's name and a "Download the app" button on
 * every screen. It sits above the screen (in the layout, not over it), so it
 * never covers the cards.
 */
export function DownloadBar({ onLayout }: { onLayout?: (e: LayoutChangeEvent) => void }) {
  const { t } = useTranslation();
  const { href, onPress } = useDownloadAction();
  const label = t('web.download');
  return (
    <View style={styles.bar} onLayout={onLayout}>
      <View style={styles.titles}>
        <AppText variant="bodyStrong" color={colors.textOnDark} numberOfLines={1}>
          {t('common.appName')}
        </AppText>
        <AppText variant="caption" color={colors.textOnDarkMuted} numberOfLines={1}>
          {t('web.downloadHint')}
        </AppText>
      </View>
      <PressableLink
        href={href}
        onPress={onPress}
        accessibilityRole={href ? 'link' : 'button'}
        accessibilityLabel={label}
        testID="download-bar"
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      >
        <Ionicons name="download" size={20} color={colors.button.accent.text} />
        <AppText variant="bodyStrong" color={colors.button.accent.text} numberOfLines={1}>
          {label}
        </AppText>
      </PressableLink>
    </View>
  );
}

const EDGE = 4;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.grapeDark,
  },
  titles: { flex: 1, minWidth: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.button.accent.face,
    borderBottomWidth: EDGE,
    borderBottomColor: colors.button.accent.edge,
  },
  pillPressed: { borderBottomWidth: 1, marginTop: EDGE - 1 },
});
