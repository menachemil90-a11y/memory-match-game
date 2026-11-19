import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { BoardImage, ImageSource } from '@/features/boards/types';
import { springs } from '@/ui/animation/motion';
import { popTo } from '@/ui/animation/pop';
import { colors, motion } from '@/ui/theme';

export type CardEffect = 'none' | 'match' | 'mismatch';

export interface FlyTarget {
  dx: number;
  dy: number;
}

export interface DealIn {
  dx: number;
  dy: number;
  delay: number;
}

export interface GameCardProps {
  index: number;
  x: number;
  y: number;
  size: number;
  image: BoardImage;
  cardBack: ImageSource;
  faceUp: boolean;
  effect: CardEffect;
  /** Color of the match glow (the collecting player's color). */
  glowColor: string;
  /** When set, the card flies by this offset (to the player's pile) and fades. */
  flyTo: FlyTarget | null;
  /** Deal-in animation start (relative offset + delay). Null = already on the table. */
  dealIn: DealIn | null;
  reduceMotion: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: (index: number) => void;
  onFlyEnd: (index: number) => void;
}

const FLY_MS = 480;

function GameCardImpl({
  index,
  x,
  y,
  size,
  image,
  cardBack,
  faceUp,
  effect,
  glowColor,
  flyTo,
  dealIn,
  reduceMotion,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  onFlyEnd,
}: GameCardProps) {
  const rotation = useSharedValue(faceUp ? 180 : 0);
  const lift = useSharedValue(1);
  const shake = useSharedValue(0);
  const glow = useSharedValue(0);
  const flyX = useSharedValue(dealIn ? dealIn.dx : 0);
  const flyY = useSharedValue(dealIn ? dealIn.dy : 0);
  const flyScale = useSharedValue(dealIn ? 0.4 : 1);
  const flyRotate = useSharedValue(dealIn ? -14 : 0);
  const opacity = useSharedValue(dealIn ? 0 : 1);

  // Deal-in: from the deck to the card's slot, staggered.
  useEffect(() => {
    if (!dealIn) return;
    const spring = springs.deal;
    const d = dealIn.delay;
    if (reduceMotion) {
      flyX.set(0);
      flyY.set(0);
      flyScale.set(1);
      flyRotate.set(0);
      opacity.set(withDelay(d / 4, withTiming(1, { duration: 150 })));
      return;
    }
    opacity.set(withDelay(d, withTiming(1, { duration: 120 })));
    flyX.set(withDelay(d, withSpring(0, spring)));
    flyY.set(withDelay(d, withSpring(0, spring)));
    flyScale.set(withDelay(d, withSpring(1, spring)));
    flyRotate.set(withDelay(d, withSpring(0, spring)));
    // Mount-only: the deal plays once per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3D flip (rotateY with perspective) on the UI thread.
  useEffect(() => {
    const target = faceUp ? 180 : 0;
    if (reduceMotion) {
      rotation.set(withTiming(target, { duration: 1 }));
      return;
    }
    rotation.set(
      withTiming(target, {
        duration: motion.flip,
        easing: Easing.out(Easing.cubic),
      }),
    );
    lift.set(
      withSequence(
        withTiming(1.07, { duration: motion.flip / 2 }),
        withTiming(1, { duration: motion.flip / 2 }),
      ),
    );
  }, [faceUp, reduceMotion, rotation, lift]);

  // Match pop + glow, or a gentle "no" shake.
  useEffect(() => {
    if (effect === 'match') {
      glow.set(withTiming(1, { duration: 180 }));
      if (!reduceMotion) {
        lift.set(
          withSequence(popTo(1.16, motion.pop), withTiming(1.08, { duration: motion.pop * 0.6 })),
        );
      }
    } else if (effect === 'mismatch') {
      if (!reduceMotion) {
        const d = size * 0.06;
        shake.set(
          withSequence(
            withTiming(-d, { duration: 50 }),
            withTiming(d, { duration: 90 }),
            withTiming(-d * 0.7, { duration: 90 }),
            withTiming(d * 0.4, { duration: 80 }),
            withTiming(0, { duration: 60 }),
          ),
        );
      }
    } else {
      glow.set(withTiming(0, { duration: 150 }));
    }
  }, [effect, reduceMotion, size, glow, lift, shake]);

  // Fly into the player's pile, then report back so the pair can be collected.
  useEffect(() => {
    if (!flyTo) return;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onFlyEnd, index);
    };
    if (reduceMotion) {
      opacity.set(withTiming(0, { duration: 200 }, done));
      return;
    }
    const easing = Easing.inOut(Easing.cubic);
    flyX.set(withTiming(flyTo.dx, { duration: FLY_MS, easing }));
    flyY.set(withTiming(flyTo.dy, { duration: FLY_MS, easing }));
    flyScale.set(withTiming(0.32, { duration: FLY_MS, easing }));
    flyRotate.set(withTiming(index % 2 ? 14 : -14, { duration: FLY_MS, easing }));
    opacity.set(withDelay(FLY_MS * 0.7, withTiming(0, { duration: FLY_MS * 0.3 }, done)));
  }, [flyTo, index, onFlyEnd, reduceMotion, flyX, flyY, flyScale, flyRotate, opacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: flyX.value + shake.value },
      { translateY: flyY.value },
      { rotate: `${flyRotate.value}deg` },
      { scale: flyScale.value * lift.value },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${rotation.value}deg` }],
  }));

  const frontStyle = useAnimatedStyle(() => ({
    opacity: rotation.value >= 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${rotation.value - 180}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1]) }],
  }));

  const radius = Math.round(size * 0.16);
  const border = Math.max(3, Math.round(size * 0.055));
  const depth = Math.max(2, Math.round(size * 0.045));
  const faceSize = { width: size, height: size, borderRadius: radius, borderWidth: border };

  return (
    <Animated.View
      style={[
        styles.slot,
        { left: x, top: y, width: size, height: size + depth },
        effect !== 'none' || flyTo ? styles.raised : null,
        containerStyle,
      ]}
    >
      <Pressable
        onPress={() => onPress(index)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected: faceUp }}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              borderRadius: radius + border * 2,
              borderColor: glowColor,
              shadowColor: glowColor,
              margin: -border * 1.6,
              borderWidth: border * 1.2,
            },
            glowStyle,
          ]}
        />
        {/* Chunky "3D" edge under the card. */}
        <View
          style={[styles.edge, { top: depth, width: size, height: size, borderRadius: radius }]}
        />
        <Animated.View style={[styles.face, faceSize, backStyle]}>
          <Image source={cardBack} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
        <Animated.View
          style={[
            styles.face,
            faceSize,
            { backgroundColor: image.kind === 'art' ? image.background : colors.card.face },
            frontStyle,
          ]}
        >
          {image.kind === 'photo' ? (
            <Image
              source={image.source}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy={image.ephemeral ? 'memory' : undefined}
            />
          ) : (
            <Image
              source={image.source}
              style={{ width: size * 0.66, height: size * 0.66 }}
              contentFit="contain"
            />
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const GameCard = memo(GameCardImpl);

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
  },
  raised: {
    zIndex: 20,
    elevation: 20,
  },
  edge: {
    position: 'absolute',
    left: 0,
    backgroundColor: 'rgba(40, 24, 110, 0.35)',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: colors.card.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
