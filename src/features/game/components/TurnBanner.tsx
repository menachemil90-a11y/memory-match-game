import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AVATAR_SOURCES } from '@/features/boards/builtin';
import { playerColor, type PlayerProfile } from '@/features/players/playersStore';
import { AppText } from '@/ui/components';
import { colors, radii, shadows, spacing } from '@/ui/theme';

export interface TurnBannerProps {
  /** The banner plays whenever this changes while `enabled`. */
  playerIndex: number;
  enabled: boolean;
  profile: PlayerProfile;
  text: string;
  rotated: boolean;
  reduceMotion: boolean;
}

/** "Noa's turn!" pop-up shown when the turn passes (pointer-transparent). */
export function TurnBanner({
  playerIndex,
  enabled,
  profile,
  text,
  rotated,
  reduceMotion,
}: TurnBannerProps) {
  const color = playerColor(profile.color);
  const show = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;
    show.set(
      withSequence(
        reduceMotion
          ? withTiming(1, { duration: 1 })
          : withSpring(1, { damping: 12, stiffness: 200 }),
        withDelay(950, withTiming(0, { duration: 220 })),
      ),
    );
  }, [playerIndex, enabled, reduceMotion, show]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, show.value * 1.5),
    transform: [{ rotate: rotated ? '180deg' : '0deg' }, { scale: 0.6 + show.value * 0.4 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, style]}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.pill, { backgroundColor: color.main }]}>
        <Image source={AVATAR_SOURCES[profile.avatar]} style={styles.avatar} />
        <AppText variant="title" color={colors.textOnDark} numberOfLines={1}>
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
});
