import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { springs } from '@/ui/animation/motion';
import { palette, spacing } from '@/ui/theme';

function Star({ filled, delay, size }: { filled: boolean; delay: number; size: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) scale.set(withDelay(delay, withSpring(1, springs.settle)));
  }, [delay, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Ionicons
        name={filled ? 'star' : 'star-outline'}
        size={size}
        color={filled ? palette.sun : 'rgba(255,255,255,0.55)'}
      />
    </Animated.View>
  );
}

export interface StarRowProps {
  stars: number;
  max?: number;
  size?: number;
  /** Delay before the first star pops in (ms). */
  delay?: number;
  accessibilityLabel?: string;
}

export function StarRow({
  stars,
  max = 3,
  size = 48,
  delay = 0,
  accessibilityLabel,
}: StarRowProps) {
  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={i === 1 && max === 3 ? styles.middle : null}>
          <Star
            filled={i < stars}
            delay={delay + i * 220}
            size={i === 1 && max === 3 ? size * 1.25 : size}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.sm },
  middle: { marginBottom: spacing.sm },
});
