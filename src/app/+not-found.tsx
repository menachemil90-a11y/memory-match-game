import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, GameButton, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Screen showBack={false}>
      <View style={styles.center}>
        <AppText variant="display" color={colors.textOnDark} align="center">
          {t('notFound.title')}
        </AppText>
        <AppText variant="heading" color={colors.textOnDarkMuted} align="center">
          {t('notFound.message')}
        </AppText>
        <GameButton label={t('notFound.goHome')} icon="home" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: spacing.xl },
});
