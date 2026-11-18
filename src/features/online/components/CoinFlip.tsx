import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { AVATAR_SOURCES, type AvatarId } from '@/features/boards/builtin';
import { feedback } from '@/lib/feedback';
import { springs } from '@/ui/animation/motion';
import { AppText } from '@/ui/components';
import { colors, palette, shadows, spacing } from '@/ui/theme';

export interface CoinFlipProps {
  avatars: [AvatarId, AvatarId];
  names: [string, string];
  /** Seat that starts (decided by the server). */
  winner: 0 | 1;
  onDone: () => void;
}

const COIN = 150;

/** Coin with both avatars spins and lands on the player who starts. */
export function CoinFlip({ avatars, names, winner, onDone }: CoinFlipProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const lift = useSharedValue(0);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    // Whole half-turns: an even count shows side 0 (host), odd shows side 1.
    const halfTurns = 9 + winner;
    const land = () => {
      setLanded(true);
      feedback.match();
      setTimeout(onDone, 1300);
    };
    if (reduceMotion) {
      spin.set(halfTurns * 180);
      land();
      return;
    }
    lift.set(
      withSequence(
        withTiming(-90, { duration: 700, easing: Easing.out(Easing.quad) }),
        withSpring(0, springs.settle),
      ),
    );
    spin.set(
      withTiming(
        halfTurns * 180,
        { duration: 1500, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) scheduleOnRN(land);
        },
      ),
    );
    // Run once per coin flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const front = useAnimatedStyle(() => {
    const angle = spin.value % 360;
    return {
      opacity: angle < 90 || angle >= 270 ? 1 : 0,
      transform: [
        { translateY: lift.value },
        { perspective: 800 },
        { rotateX: `${spin.value}deg` },
      ],
    };
  });
  const back = useAnimatedStyle(() => {
    const angle = spin.value % 360;
    return {
      opacity: angle < 90 || angle >= 270 ? 0 : 1,
      transform: [
        { translateY: lift.value },
        { perspective: 800 },
        { rotateX: `${spin.value + 180}deg` },
      ],
    };
  });

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={styles.backdrop}
      accessibilityLiveRegion="polite"
    >
      <AppText variant="title" color={colors.textOnDark} align="center">
        {t('online.coinFlip')}
      </AppText>
      <View style={styles.coinArea}>
        {([0, 1] as const).map((side) => (
          <Animated.View
            key={side}
            style={[
              styles.coin,
              { backgroundColor: side === 0 ? palette.sun : palette.sky },
              side === 0 ? front : back,
            ]}
          >
            <Image source={AVATAR_SOURCES[avatars[side]]} style={styles.avatar} />
          </Animated.View>
        ))}
      </View>
      {landed ? (
        <Animated.View entering={FadeIn}>
          <AppText variant="display" color={colors.textOnDark} align="center">
            {t('online.starts', { name: names[winner] })}
          </AppText>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 18, 80, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    zIndex: 100,
    elevation: 100,
    padding: spacing.xl,
  },
  coinArea: { width: COIN, height: COIN },
  coin: {
    position: 'absolute',
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    borderWidth: 8,
    borderColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.lg,
  },
  avatar: { width: COIN * 0.6, height: COIN * 0.6 },
});
