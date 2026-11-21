import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DownloadAppButton } from '@/features/web/DownloadAppButton';
import { openAppFeature } from '@/features/web/appOnlyStore';
import { capabilities } from '@/lib/platform/capabilities';
import { AppText, GameButton, IconButton, Screen } from '@/ui/components';
import { useScreenSize } from '@/ui/layout/useScreenSize';
import { colors, radii, shadows, spacing } from '@/ui/theme';

/** Screens shorter than this (in dp) get the compact home layout. */
const COMPACT_HEIGHT = 720;
/** Height of the web game's extra home button and its gap. */
const WEB_EXTRA_HEIGHT = 90;

/** Decorative logo: two tilted cards. Pure views, no external art. */
function Logo({ scale = 1 }: { scale?: number }) {
  const card = { width: 76 * scale, height: 96 * scale };
  return (
    <View style={[styles.logo, { width: 150 * scale, height: 110 * scale }]} accessible={false}>
      <View style={[styles.logoCard, card, styles.logoCardLeft]}>
        <AppText variant="title" color={colors.textOnDark}>
          ?
        </AppText>
      </View>
      <View style={[styles.logoCard, card, styles.logoCardRight]}>
        <AppText variant="title" color={colors.textOnDark}>
          ?
        </AppText>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  // Short screens (e.g. 360×640 dp, or tall system bars) get a smaller hero, and
  // the screen scrolls as a last resort so the tagline never hides behind a button.
  // The web game has one more button (Download the app).
  const compact =
    useScreenSize().height < COMPACT_HEIGHT + (capabilities.webShell ? WEB_EXTRA_HEIGHT : 0);

  return (
    <Screen
      scroll
      showBack={false}
      headerRight={
        <IconButton
          icon="settings-sharp"
          accessibilityLabel={t('home.settings')}
          onPress={() => router.push('/settings')}
        />
      }
    >
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <Logo scale={compact ? 0.75 : 1} />
        <AppText
          variant={compact ? 'title' : 'display'}
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

      <View style={[styles.buttons, compact && styles.buttonsCompact]}>
        <GameButton
          label={t('home.solo')}
          icon="person"
          variant="primary"
          onPress={() =>
            openAppFeature(t('home.solo'), { pathname: '/boards', params: { mode: 'solo' } })
          }
        />
        <GameButton
          label={t('home.together')}
          icon="people"
          variant="danger"
          onPress={() => openAppFeature(t('home.together'), '/setup')}
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
          onPress={() => openAppFeature(t('home.myBoards'), '/my-boards')}
        />
        {/* Web game: the way to the full game, impossible to miss. */}
        {capabilities.webShell ? <DownloadAppButton style={styles.download} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    // Takes the free space, but never less than its content: squeezed, the
    // centered title would spill upward over the header.
    flexGrow: 1,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  heroCompact: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  logo: {
    marginBottom: spacing.md,
  },
  logoCard: {
    position: 'absolute',
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
  buttonsCompact: {
    gap: spacing.md,
  },
  download: {
    marginTop: spacing.sm,
  },
});
