import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/ui/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface ScreenProps {
  children: ReactNode;
  /** Optional title shown in the header row. */
  title?: string;
  /** Show a back button (defaults to true when a title is given). */
  showBack?: boolean;
  /** Extra element on the right side of the header. */
  headerRight?: ReactNode;
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
}

/** Full-screen gradient background with safe-area padding and an optional header. */
export function Screen({ children, title, showBack, headerRight, scroll = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const hasBack = showBack ?? title !== undefined;
  const hasHeader = title !== undefined || hasBack || headerRight !== undefined;

  const header = hasHeader ? (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {hasBack ? (
          <IconButton
            icon="arrow-back"
            accessibilityLabel={t('common.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        ) : null}
      </View>
      {title ? (
        <AppText
          variant="title"
          color={colors.textOnDark}
          align="center"
          numberOfLines={1}
          accessibilityRole="header"
          style={styles.title}
        >
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}
      <View style={[styles.headerSide, styles.headerRight]}>{headerRight}</View>
    </View>
  ) : null;

  // A scrolling screen scrolls its header too. The header has no background of
  // its own, so content scrolling under a fixed header would be cut off at an
  // invisible line in the middle of the gradient.
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <>
      {header}
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        {children}
      </View>
    </>
  );

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.root}>
      <View
        style={[
          styles.inner,
          {
            paddingTop: insets.top + spacing.sm,
            paddingLeft: insets.left + spacing.lg,
            paddingRight: insets.right + spacing.lg,
          },
        ]}
      >
        {body}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    marginBottom: spacing.md,
  },
  headerSide: { width: 56, alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end' },
  title: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
