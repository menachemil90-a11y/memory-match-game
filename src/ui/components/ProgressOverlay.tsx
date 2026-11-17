import { Modal, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { colors, palette, radii, shadows, spacing } from '@/ui/theme';

import { AppText } from './AppText';

export interface ProgressOverlayProps {
  visible: boolean;
  label: string;
  /** 0..1, or null for an indeterminate wait. */
  progress: number | null;
}

/** Blocking progress panel for longer work (e.g. preparing photos). */
export function ProgressOverlay({ visible, label, progress }: ProgressOverlayProps) {
  const barStyle = useAnimatedStyle(() => ({
    width: withTiming(`${Math.round((progress ?? 1) * 100)}%`, { duration: 200 }),
  }));
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={styles.panel}
          accessibilityLiveRegion="polite"
          accessible
          accessibilityLabel={label}
        >
          <AppText variant="heading" align="center">
            {label}
          </AppText>
          <View style={styles.track}>
            <Animated.View style={[styles.bar, barStyle]} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    boxShadow: shadows.lg,
  },
  track: {
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: palette.cloud,
    overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: radii.pill, backgroundColor: palette.mint },
});
