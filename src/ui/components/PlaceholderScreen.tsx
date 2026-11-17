import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radii, shadows, spacing } from '@/ui/theme';

import { AppText } from './AppText';
import { GameButton, type ButtonVariant } from './GameButton';
import { Screen } from './Screen';

export interface PlaceholderLink {
  label: string;
  href: Href;
  variant?: ButtonVariant;
}

export interface PlaceholderScreenProps {
  title: string;
  phase: number;
  links?: PlaceholderLink[];
}

/** Temporary screen used by the Phase 0 navigation skeleton. */
export function PlaceholderScreen({ title, phase, links = [] }: PlaceholderScreenProps) {
  const { t } = useTranslation();
  return (
    <Screen title={title} scroll>
      <View style={styles.panel}>
        <AppText variant="heading" align="center">
          {t('common.comingSoon')}
        </AppText>
        <AppText variant="body" color={colors.textMuted} align="center">
          {t('common.comingInPhase', { phase })}
        </AppText>
      </View>
      <View style={styles.links}>
        {links.map((link) => (
          <GameButton
            key={String(link.href)}
            label={link.label}
            variant={link.variant ?? 'secondary'}
            size="md"
            onPress={() => router.push(link.href)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    boxShadow: shadows.lg,
  },
  links: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
});
