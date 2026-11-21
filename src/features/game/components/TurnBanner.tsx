import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import { playerColor, type PlayerProfile } from '@/features/players/playersStore';
import { AppText } from '@/ui/components';
import { popTo } from '@/ui/animation/pop';
import { colors, motion, radii, shadows, spacing, typography } from '@/ui/theme';

export interface TurnBannerProps {
  /** The banner plays whenever this changes while `enabled`. */
  playerIndex: number;
  enabled: boolean;
  profile: PlayerProfile;
  text: string;
  rotated: boolean;
  reduceMotion: boolean;
  /** 3+ players on one phone: bigger, so everyone sees who gets the phone next. */
  big?: boolean;
}

/** Total time the banner is on screen (ms) — shown, then gone by itself. */
export const TURN_BANNER_MS = motion.turnBanner.in + motion.turnBanner.hold + motion.turnBanner.out;

/**
 * "Noa's turn!" pop-up shown when the turn passes: pops in, stays briefly, then
 * fades out and drifts up by itself. Every step is timed (no spring), so it is
 * always gone after TURN_BANNER_MS. Pointer-transparent: taps reach the cards.
 */
export function TurnBanner({
  playerIndex,
  enabled,
  profile,
  text,
  rotated,
  reduceMotion,
  big = false,
}: TurnBannerProps) {
  const color = playerColor(profile.color);
  const show = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;
    const { in: enter, hold, out } = motion.turnBanner;
    show.set(
      withSequence(
        reduceMotion ? withTiming(1, { duration: 1 }) : popTo(1, enter),
        withDelay(
          reduceMotion ? enter + hold : hold,
          withTiming(0, { duration: reduceMotion ? 1 : out, easing: Easing.in(Easing.quad) }),
        ),
      ),
    );
  }, [playerIndex, enabled, reduceMotion, show]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, show.value * 1.5),
    transform: [
      { rotate: rotated ? '180deg' : '0deg' },
      { translateY: (1 - Math.min(1, show.value)) * -24 },
      { scale: 0.6 + show.value * 0.4 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, style]}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.pill, big && styles.pillBig, { backgroundColor: color.main }]}>
        <Image
          source={AVATAR_SOURCES[profile.avatar]}
          style={big ? styles.avatarBig : styles.avatar}
        />
        <AppText
          variant="title"
          color={colors.textOnDark}
          numberOfLines={1}
          adjustsFontSizeToFit={big}
          minimumFontScale={0.7}
          style={big ? styles.textBig : null}
        >
          {text}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 50,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    borderWidth: 4,
    borderColor: colors.card.border,
    boxShadow: shadows.lg,
    maxWidth: '92%',
  },
  avatar: { width: 40, height: 40 },
  pillBig: {
    flexDirection: 'column',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 5,
  },
  avatarBig: { width: 72, height: 72 },
  textBig: { fontSize: typography.display.fontSize, lineHeight: typography.display.lineHeight },
});
