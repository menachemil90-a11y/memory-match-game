import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';

import { APP_VERSION_LABEL } from '@/lib/appInfo';
import { AppText, GameButton } from '@/ui/components';
import { colors, palette } from '@/ui/theme';

import { currentBuild, useUpdatesStore, type UpdateStatus } from './updatesStore';

const STATUS_TEXT = {
  checking: 'updates.checking',
  upToDate: 'updates.upToDate',
  available: 'updates.available',
  checkFailed: 'updates.checkFailed',
  unsupported: 'updates.unsupported',
} as const satisfies Partial<Record<UpdateStatus, string>>;

/** Settings → Updates: current version and a manual "Check for updates". */
export function UpdatesSection() {
  const { t, i18n } = useTranslation();
  const status = useUpdatesStore((s) => s.status);
  const check = useUpdatesStore((s) => s.check);

  const build = currentBuild();
  const statusKey = status in STATUS_TEXT ? STATUS_TEXT[status as keyof typeof STATUS_TEXT] : null;
  const runningUpdateDate =
    Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt
      ? Updates.createdAt.toLocaleDateString(i18n.language, { dateStyle: 'medium' })
      : null;
  const busy = status === 'checking' || status === 'installing';

  return (
    <>
      <AppText variant="bodyStrong">
        {build !== null
          ? t('settings.versionBuild', { version: APP_VERSION_LABEL, build })
          : t('settings.version', { version: APP_VERSION_LABEL })}
      </AppText>
      {runningUpdateDate ? (
        <AppText variant="caption" color={colors.textMuted}>
          {t('settings.updateFrom', { date: runningUpdateDate })}
        </AppText>
      ) : null}
      {statusKey ? (
        <AppText
          variant="caption"
          color={status === 'checkFailed' ? palette.coralDark : colors.textMuted}
          accessibilityLiveRegion="polite"
          testID="updates-status"
        >
          {t(statusKey)}
        </AppText>
      ) : null}
      <GameButton
        label={
          status === 'checking'
            ? t('updates.checking')
            : status === 'available'
              ? t('updates.show')
              : t('updates.check')
        }
        icon="cloud-download"
        variant="secondary"
        size="md"
        disabled={busy}
        onPress={() => void check({ manual: true })}
        testID="updates-check"
      />
    </>
  );
}
