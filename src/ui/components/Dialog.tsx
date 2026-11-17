import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { colors, radii, shadows, spacing } from '@/ui/theme';

import { AppText } from './AppText';

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  onRequestClose: () => void;
  children?: ReactNode;
}

/** Friendly modal dialog in the game's style (used for confirmations). */
export function Dialog({ visible, title, message, onRequestClose, children }: DialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
          accessibilityLabel={title}
          accessibilityRole="button"
        />
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={styles.panel}
          accessibilityViewIsModal
        >
          <AppText variant="heading" align="center" accessibilityRole="header">
            {title}
          </AppText>
          {message ? (
            <AppText variant="body" color={colors.textMuted} align="center">
              {message}
            </AppText>
          ) : null}
          <View style={styles.actions}>{children}</View>
        </Animated.View>
      </Animated.View>
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
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    boxShadow: shadows.lg,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
});
