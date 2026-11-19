import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Linking, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { feedback } from '@/lib/feedback';
import { colors, minTouchTarget, motion, radii, shadows, spacing } from '@/ui/theme';

import { AppText } from './AppText';
import { PressableLink } from './PressableLink';

export type ButtonVariant = keyof typeof colors.button;
export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface GameButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Makes the button a link. On the web it is a real `<a href>` (so a download
   * starts like any link, and it works with long-press/middle-click); in the
   * app the URL opens in the browser.
   */
  href?: string;
}

const DEPTH = motion.buttonPressDepth;

/**
 * Big pill-shaped button with a "pressed-down" 3D effect: the face sits on a
 * darker edge and sinks into it while pressed.
 */
export function GameButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled = false,
  accessibilityHint,
  style,
  testID,
  href,
}: GameButtonProps) {
  const scheme = colors.button[variant];
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const height = size === 'lg' ? 68 : Math.max(52, minTouchTarget);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * (DEPTH - 1) }],
  }));

  const setPressed = (value: number) => {
    pressed.set(reduceMotion ? value : withTiming(value, { duration: 70 }));
  };

  return (
    <PressableLink
      href={Platform.OS === 'web' ? href : undefined}
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPressIn={() => setPressed(1)}
      onPressOut={() => setPressed(0)}
      onPress={() => {
        feedback.tap();
        if (href && Platform.OS !== 'web') void Linking.openURL(href);
        onPress?.();
      }}
      style={[styles.wrapper, { height: height + DEPTH, opacity: disabled ? 0.55 : 1 }, style]}
    >
      <View style={[styles.edge, { height, top: DEPTH, backgroundColor: scheme.edge }]} />
      <Animated.View style={[styles.face, { height, backgroundColor: scheme.face }, faceStyle]}>
        <View style={styles.shine} pointerEvents="none" />
        {icon ? <Ionicons name={icon} size={size === 'lg' ? 28 : 22} color={scheme.text} /> : null}
        <AppText variant="button" color={scheme.text} numberOfLines={1}>
          {label}
        </AppText>
      </Animated.View>
    </PressableLink>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    borderRadius: radii.pill,
    boxShadow: shadows.md,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radii.pill,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: 4,
    left: 18,
    right: 18,
    height: '38%',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
