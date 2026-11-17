import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { feedback } from '@/lib/feedback';
import { colors, minTouchTarget, motion, radii, shadows } from '@/ui/theme';

import type { ButtonVariant, IconName } from './GameButton';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only buttons must still be announced by screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: number;
}

const DEPTH = motion.buttonPressDepth - 1;

/** Round 3D icon button (settings gear, back, close…). */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'secondary',
  size = 52,
}: IconButtonProps) {
  const scheme = colors.button[variant];
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const diameter = Math.max(size, minTouchTarget);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * (DEPTH - 1) }],
  }));

  const setPressed = (value: number) => {
    pressed.value = reduceMotion ? value : withTiming(value, { duration: 70 });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => setPressed(1)}
      onPressOut={() => setPressed(0)}
      onPress={() => {
        feedback.tap();
        onPress?.();
      }}
      hitSlop={8}
      style={[styles.wrapper, { width: diameter, height: diameter + DEPTH }]}
    >
      <View
        style={[
          styles.circle,
          { width: diameter, height: diameter, top: DEPTH, backgroundColor: scheme.edge },
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          styles.face,
          { width: diameter, height: diameter, backgroundColor: scheme.face },
          faceStyle,
        ]}
      >
        <Ionicons name={icon} size={diameter * 0.5} color={scheme.text} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.pill,
    boxShadow: shadows.sm,
  },
  circle: {
    position: 'absolute',
    left: 0,
    borderRadius: radii.pill,
  },
  face: {
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
