import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { palette } from '@/ui/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface TurnTimerRingProps {
  /** Size of the ring (it surrounds the avatar). */
  size: number;
  /** Local timestamp (ms, already corrected to server time) when the turn ends. */
  deadline: number;
  totalMs: number;
}

/** Shrinking ring around the active player's avatar; turns red near the end. */
export function TurnTimerRing({ size, deadline, totalMs }: TurnTimerRingProps) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(1);

  useEffect(() => {
    const remaining = Math.max(0, deadline - Date.now());
    progress.set(Math.min(1, remaining / totalMs));
    progress.set(withTiming(0, { duration: remaining, easing: Easing.linear }));
    return () => cancelAnimation(progress);
  }, [deadline, totalMs, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
    stroke: interpolateColor(
      progress.value,
      [0, 0.25, 0.5, 1],
      [palette.coral, palette.coral, palette.sun, palette.mint],
    ),
  }));

  return (
    <Svg width={size} height={size} style={styles.ring} pointerEvents="none">
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={stroke}
        fill="none"
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
});
