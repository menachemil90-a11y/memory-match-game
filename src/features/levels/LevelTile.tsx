import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LevelAvailability, SoloScore } from '@/game';
import { AppText, Pressable3D } from '@/ui/components';
import { colors, motion, palette, radii, spacing } from '@/ui/theme';

export const LEVEL_COLORS = {
  tiny: { face: palette.mint, edge: palette.mintDark },
  easy: { face: palette.sky, edge: palette.skyDark },
  medium: { face: palette.sun, edge: palette.sunDark },
  tricky: { face: palette.tangerine, edge: palette.tangerineDark },
  hard: { face: palette.coral, edge: palette.coralDark },
  expert: { face: palette.grapeLight, edge: palette.grape },
} as const;

function MiniGrid({ cols, rows, color }: { cols: number; rows: number; color: string }) {
  const dot = Math.min(10, Math.floor(46 / Math.max(cols, rows)));
  return (
    <View style={{ gap: 2 }}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: cols }, (__, c) => (
            <View
              key={c}
              style={{ width: dot, height: dot, borderRadius: dot / 4, backgroundColor: color }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export interface LevelTileProps {
  availability: LevelAvailability;
  best?: SoloScore;
  showBest: boolean;
  /**
   * Too small for the group on this phone: the most players this level allows
   * (the tile is shown disabled, like a locked level). Null when the group fits.
   */
  tooSmallFor?: number | null;
  /** Also called for locked levels: the screen explains how to unlock them. */
  onPress: () => void;
}

export function LevelTile({
  availability,
  best,
  showBest,
  tooSmallFor = null,
  onPress,
}: LevelTileProps) {
  const { t } = useTranslation();
  const { level, missingImages } = availability;
  const tooSmall = tooSmallFor !== null;
  const locked = availability.locked || tooSmall;
  const name = t(`levels.names.${level.id}`);
  const scheme = locked ? { face: palette.mist, edge: palette.slate } : LEVEL_COLORS[level.id];
  const ink = locked
    ? colors.textMuted
    : level.id === 'medium'
      ? palette.sunInk
      : colors.textOnDark;
  const hint = availability.locked
    ? t('levels.unlockHint', { count: missingImages, level: name })
    : tooSmall
      ? t('levels.tooSmallHint', { max: tooSmallFor })
      : '';

  return (
    <Pressable3D
      onPress={onPress}
      edgeColor={scheme.edge}
      radius={radii.xl}
      style={styles.wrapper}
      faceStyle={[styles.face, { backgroundColor: scheme.face }]}
      accessibilityLabel={
        availability.locked
          ? t('levels.a11yLocked', { level: name, hint })
          : tooSmall
            ? t('levels.a11yTooSmall', { level: name, max: tooSmallFor })
            : t('levels.a11yLevel', { level: name, pairs: level.pairs })
      }
    >
      {/* The name gets the full width so it never truncates on 360 dp phones. */}
      <AppText
        variant="heading"
        color={ink}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {name}
      </AppText>
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="bodyStrong" color={ink}>
            {t('common.pairs', { count: level.pairs })}
          </AppText>
          <AppText variant="caption" color={ink}>
            {t('levels.grid', { cols: level.cols, rows: level.rows })}
          </AppText>
        </View>
        {locked ? (
          <Ionicons
            name={availability.locked ? 'lock-closed' : 'people'}
            size={28}
            color={colors.textMuted}
          />
        ) : (
          <MiniGrid cols={level.cols} rows={level.rows} color="rgba(255,255,255,0.75)" />
        )}
      </View>
      {locked ? (
        <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
          {hint}
        </AppText>
      ) : showBest ? (
        <View style={styles.best}>
          {[1, 2, 3].map((i) => (
            <Ionicons
              key={i}
              name={best && best.stars >= i ? 'star' : 'star-outline'}
              size={20}
              color={ink}
              style={{ opacity: best && best.stars >= i ? 1 : 0.55 }}
            />
          ))}
          {best ? (
            <AppText variant="caption" color={ink} style={styles.bestText}>
              {t('levels.best', { moves: best.moves })}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </Pressable3D>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexBasis: '47%', flexGrow: 1, minHeight: 124 + motion.buttonPressDepth },
  face: {
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: 'space-between',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titles: { flex: 1 },
  best: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bestText: { marginLeft: spacing.xs },
});
