import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { bestScoresRepo } from '@/features/game/bestScoresRepo';
import { layoutHistoryRepo } from '@/features/game/layoutHistoryRepo';
import { useSettingsStore, type FlipBackSpeed } from '@/features/settings/settingsStore';
import { APP_VERSION_LABEL } from '@/lib/appInfo';
import { getDb } from '@/lib/db';
import { feedback } from '@/lib/feedback';
import { AppText, Dialog, GameButton, Screen, SegmentedControl, Toggle } from '@/ui/components';
import { colors, minTouchTarget, palette, radii, shadows, spacing } from '@/ui/theme';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" color={colors.textMuted} accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

function LinkRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: 'document-text' | 'shield-checkmark';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        feedback.tap();
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={styles.linkRow}
    >
      <Ionicons name={icon} size={22} color={palette.grape} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const s = useSettingsStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const reset = async () => {
    const db = await getDb();
    await bestScoresRepo.clearAll(db);
    await layoutHistoryRepo.clearAll(db);
    setResetDone(true);
  };

  return (
    <Screen title={t('settings.title')} scroll>
      <Section title={t('settings.soundSection')}>
        <Toggle
          label={t('settings.sound')}
          value={s.soundEnabled}
          onValueChange={s.setSoundEnabled}
        />
        <Toggle
          label={t('settings.music')}
          value={s.musicEnabled}
          onValueChange={s.setMusicEnabled}
        />
        <Toggle
          label={t('settings.haptics')}
          value={s.hapticsEnabled}
          onValueChange={s.setHapticsEnabled}
        />
      </Section>

      <Section title={t('settings.gameSection')}>
        <AppText variant="bodyStrong">{t('settings.flipBack')}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {t('settings.flipBackHint')}
        </AppText>
        <SegmentedControl<FlipBackSpeed>
          value={s.flipBackSpeed}
          onChange={s.setFlipBackSpeed}
          accessibilityLabel={t('settings.flipBack')}
          options={[
            { value: 'normal', label: t('settings.flipNormal') },
            { value: 'kids', label: t('settings.flipKids') },
          ]}
        />
      </Section>

      <Section title={t('settings.dataSection')}>
        <AppText variant="caption" color={colors.textMuted}>
          {t('settings.resetStatsHint')}
        </AppText>
        <GameButton
          label={resetDone ? t('settings.resetDone') : t('settings.resetStats')}
          icon="refresh"
          variant="secondary"
          size="md"
          disabled={resetDone}
          onPress={() => setConfirmReset(true)}
        />
      </Section>

      <Section title={t('settings.aboutSection')}>
        <LinkRow
          label={t('settings.credits')}
          icon="document-text"
          onPress={() => router.push('/settings/credits')}
        />
        <LinkRow
          label={t('settings.privacy')}
          icon="shield-checkmark"
          onPress={() => router.push('/settings/privacy')}
        />
        <AppText variant="caption" color={colors.textMuted} align="center">
          {t('common.appName')} · {t('settings.version', { version: APP_VERSION_LABEL })}
        </AppText>
      </Section>

      <Dialog
        visible={confirmReset}
        title={t('settings.resetTitle')}
        message={t('settings.resetMessage')}
        onRequestClose={() => setConfirmReset(false)}
      >
        <GameButton
          label={t('common.cancel')}
          variant="secondary"
          size="md"
          onPress={() => setConfirmReset(false)}
        />
        <GameButton
          label={t('settings.resetStats')}
          variant="danger"
          size="md"
          onPress={() => {
            setConfirmReset(false);
            void reset();
          }}
        />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
    boxShadow: shadows.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
});
