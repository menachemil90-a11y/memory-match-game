import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LICENSE_URLS } from '@/lib/appInfo';
import { AppText, GameButton, Screen } from '@/ui/components';
import { colors, radii, shadows, spacing } from '@/ui/theme';

function Credit({ title, body, url }: { title: string; body: string; url?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color={colors.textMuted}>
        {body}
      </AppText>
      {url ? (
        <GameButton
          label={t('credits.openLicense')}
          variant="secondary"
          size="md"
          onPress={() => void Linking.openURL(url)}
        />
      ) : null}
    </View>
  );
}

export default function CreditsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('settings.credits')} scroll>
      <AppText variant="bodyStrong" color={colors.textOnDark} style={styles.intro}>
        {t('credits.intro')}
      </AppText>
      <Credit title={t('credits.art')} body={t('credits.artBody')} url={LICENSE_URLS.twemoji} />
      <Credit title={t('credits.font')} body={t('credits.fontBody')} url={LICENSE_URLS.fredoka} />
      <Credit
        title={t('credits.icons')}
        body={t('credits.iconsBody')}
        url={LICENSE_URLS.ionicons}
      />
      <Credit title={t('credits.sounds')} body={t('credits.soundsBody')} />
      <Credit title={t('credits.software')} body={t('credits.softwareBody')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    boxShadow: shadows.md,
  },
});
