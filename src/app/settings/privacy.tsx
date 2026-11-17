import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PRIVACY_POLICY_URL } from '@/lib/appInfo';
import { AppText, GameButton, Screen } from '@/ui/components';
import { radii, shadows, spacing, colors } from '@/ui/theme';

/** Short, kid-friendly privacy summary (works offline) + link to the full policy. */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('privacy.title')} scroll>
      <View style={styles.card}>
        <AppText variant="body">{t('privacy.body')}</AppText>
      </View>
      {PRIVACY_POLICY_URL ? (
        <GameButton
          label={t('privacy.full')}
          variant="secondary"
          size="md"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    boxShadow: shadows.md,
  },
});
