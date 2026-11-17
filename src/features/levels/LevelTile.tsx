import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { LevelAvailability, SoloScore } from '@/game';
import { feedback } from '@/lib/feedback';
import { AppText } from '@/ui/components';
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
  onPress: () => void;
}

export function LevelTile({ availability, best, showBest, onPress }: LevelTileProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const { level, locked, missingImages } = availability;
  const name = t(`levels.names.${level.id}`);
  const scheme = locked ? { face: palette.mist, edge: palette.slate } : LEVEL_COLORS[level.id];
  const ink = locked
    ? colors.textMuted
    : level.id === 'medium'
      ? palette.sunInk
      : colors.textOnDark;
  const hint = locked ? t('levels.unlockHint', { count: missingImages, level: name }) : '';

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * (motion.buttonPressDepth - 1) }],
  }));
  const setPressed = (v: number) => pressed.set(reduceMotion ? v : withTiming(v, { duration: 70 }));

  return (
    <Pressable
      onPressIn={() => !locked && setPressed(1)}
      onPressOut={() => setPressed(0)}
      onPress={() => {
        if (locked) return;
        feedback.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={
        locked
          ? t('levels.a11yLocked', { level: name, hint })
          : t('levels.a11yLevel', { level: name, pairs: level.pairs })
      }
      style={styles.wrapper}
    >
      <View style={[styles.edge, { backgroundColor: scheme.edge }]} />
      <Animated.View style={[styles.face, { backgroundColor: scheme.face }, faceStyle]}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <AppText variant="heading" color={ink} numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" color={ink}>
              {t('common.pairs', { count: level.pairs })} ·{' '}
              {t('levels.grid', { cols: level.cols, rows: level.rows })}
            </AppText>
          </View>
          {locked ? (
            <Ionicons name="lock-closed" size={28} color={colors.textMuted} />
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
                color={best && best.stars >= i ? palette.white : 'rgba(255,255,255,0.6)'}
              />
            ))}
            {best ? (
              <AppText variant="caption" color={ink} style={styles.bestText}>
                {t('levels.best', { moves: best.moves })}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const DEPTH = motion.buttonPressDepth;
const styles = StyleSheet.create({
  wrapper: { flexBasis: '47%', flexGrow: 1, minHeight: 124 + DEPTH },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: DEPTH,
    bottom: 0,
    borderRadius: radii.xl,
  },
  face: {
    flex: 1,
    marginBottom: DEPTH,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'space-between',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titles: { flex: 1 },
  best: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bestText: { marginLeft: spacing.xs },
});
