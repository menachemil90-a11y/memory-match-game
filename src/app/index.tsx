import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, GameButton, IconButton, Screen } from '@/ui/components';
import { colors, radii, shadows, spacing } from '@/ui/theme';

/** Decorative logo: two tilted cards. Pure views, no external art. */
function Logo() {
  return (
    <View style={styles.logo} accessible={false}>
      <View style={[styles.logoCard, styles.logoCardLeft]}>
        <AppText variant="title" color={colors.textOnDark}>
          ?
        </AppText>
      </View>
      <View style={[styles.logoCard, styles.logoCardRight]}>
        <AppText variant="title" color={colors.textOnDark}>
          ?
        </AppText>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen
      showBack={false}
      headerRight={
        <IconButton
          icon="settings-sharp"
          accessibilityLabel={t('home.settings')}
          onPress={() => router.push('/settings')}
        />
      }
    >
      <View style={styles.hero}>
        <Logo />
        <AppText
          variant="display"
          color={colors.textOnDark}
          align="center"
          accessibilityRole="header"
        >
          {t('common.appName')}
        </AppText>
        <AppText variant="heading" color={colors.textOnDarkMuted} align="center">
          {t('home.tagline')}
        </AppText>
      </View>

      <View style={styles.buttons}>
        <GameButton
          label={t('home.solo')}
          icon="person"
          variant="primary"
          onPress={() => router.push({ pathname: '/boards', params: { mode: 'solo' } })}
        />
        <GameButton
          label={t('home.twoPlayers')}
          icon="people"
          variant="danger"
          onPress={() => router.push({ pathname: '/boards', params: { mode: 'local' } })}
        />
        <GameButton
          label={t('home.online')}
          icon="globe-outline"
          variant="info"
          onPress={() => router.push('/online')}
        />
        <GameButton
          label={t('home.myBoards')}
          icon="images"
          variant="success"
          onPress={() => router.push('/my-boards')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 200,
  },
  logo: {
    width: 150,
    height: 110,
    marginBottom: spacing.md,
  },
  logoCard: {
    position: 'absolute',
    width: 76,
    height: 96,
    borderRadius: radii.card,
    borderWidth: 4,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.lg,
  },
  logoCardLeft: {
    left: 6,
    top: 8,
    backgroundColor: colors.button.danger.face,
    transform: [{ rotate: '-12deg' }],
  },
  logoCardRight: {
    right: 6,
    top: 4,
    backgroundColor: colors.button.info.face,
    transform: [{ rotate: '10deg' }],
  },
  buttons: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
});
