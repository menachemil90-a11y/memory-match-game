import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { feedback } from '@/lib/feedback';
import { colors, minTouchTarget, palette, radii, spacing } from '@/ui/theme';

import { AppText } from './AppText';

export interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Text color for label/description (on dark or light backgrounds). */
  tone?: 'dark' | 'light';
}

const TRACK_W = 60;
const TRACK_H = 34;
const KNOB = 26;

/** Big, friendly on/off switch with a label (role "switch" for screen readers). */
export function Toggle({ label, description, value, onValueChange, tone = 'dark' }: ToggleProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.set(
      reduceMotion ? (value ? 1 : 0) : withSpring(value ? 1 : 0, { damping: 15, stiffness: 220 }),
    );
  }, [value, reduceMotion, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [palette.mist, palette.mint]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 4 + progress.value * (TRACK_W - KNOB - 8) }],
  }));
  const textColor = tone === 'dark' ? colors.text : colors.textOnDark;
  const subColor = tone === 'dark' ? colors.textMuted : colors.textOnDarkMuted;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      onPress={() => {
        feedback.tap();
        onValueChange(!value);
      }}
      style={styles.row}
    >
      <View style={styles.text}>
        <AppText variant="bodyStrong" color={textColor}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" color={subColor}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  text: { flex: 1, gap: 2 },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radii.pill,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.surface,
    boxShadow: '0px 2px 3px rgba(30,18,80,0.3)',
  },
});
