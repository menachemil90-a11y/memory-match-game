import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { feedback } from '@/lib/feedback';
import { motion } from '@/ui/theme';

export interface Pressable3DProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Color of the darker "3D" edge under the face. */
  edgeColor: string;
  radius: number;
  depth?: number;
  /** Style of the outer wrapper (size, flex, margins). */
  style?: StyleProp<ViewStyle>;
  /** Style of the pressable face (background, padding, border). */
  faceStyle?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  accessibilityRole?: 'button' | 'link' | 'radio';
  testID?: string;
}

/**
 * The game's chunky "pressed-down" surface: a face resting on a darker edge
 * that sinks into it while pressed. Used by tiles and cards across the app.
 */
export function Pressable3D({
  children,
  onPress,
  onLongPress,
  disabled = false,
  edgeColor,
  radius,
  depth = motion.buttonPressDepth,
  style,
  faceStyle,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  accessibilityRole = 'button',
  testID,
}: Pressable3DProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * (depth - 1) }],
  }));
  const setPressed = (v: number) => pressed.set(reduceMotion ? v : withTiming(v, { duration: 70 }));

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPressIn={() => setPressed(1)}
      onPressOut={() => setPressed(0)}
      onPress={() => {
        feedback.tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={[styles.wrapper, { paddingBottom: depth }, style]}
    >
      <View
        style={[styles.edge, { top: depth, borderRadius: radius, backgroundColor: edgeColor }]}
      />
      <Animated.View style={[styles.face, { borderRadius: radius }, faceStyle, animated]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face: { flex: 1, overflow: 'hidden' },
});
