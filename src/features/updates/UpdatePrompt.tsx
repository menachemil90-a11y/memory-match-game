import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Dialog, GameButton } from '@/ui/components';
import { palette } from '@/ui/theme';

import { useUpdatesStore } from './updatesStore';

/**
 * Screens where the "new version" dialog must not pop up: a running game
 * (local or online). It appears as soon as the player leaves them.
 */
export function isBusyScreen(pathname: string): boolean {
  if (pathname === '/game') return true;
  // Online room (lobby + game): /online/<code>; /online and /online/new are menus.
  return pathname.startsWith('/online/') && pathname !== '/online/new';
}

/**
 * Checks for updates when the app starts and when it comes back to the
 * foreground (at most hourly), and asks the player before updating.
 * Mounted once, in the root layout.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const available = useUpdatesStore((s) => s.available);
  const promptOpen = useUpdatesStore((s) => s.promptOpen);
  const status = useUpdatesStore((s) => s.status);
  const progress = useUpdatesStore((s) => s.progress);
  const autoCheck = useUpdatesStore((s) => s.autoCheck);
  const install = useUpdatesStore((s) => s.install);
  const dismiss = useUpdatesStore((s) => s.dismiss);

  useEffect(() => {
    void autoCheck();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void autoCheck();
    });
    return () => sub.remove();
  }, [autoCheck]);

  if (!available || !promptOpen || isBusyScreen(pathname)) return null;

  const installing = status === 'installing';
  const isOta = available.kind === 'ota';
  const title = isOta ? t('updates.otaTitle') : t('updates.apkTitle');
  const message = isOta
    ? t('updates.otaMessage')
    : t('updates.apkMessage', { version: available.version, build: available.build });
  const actionLabel =
    installing && progress !== null
      ? t('updates.downloading', { percent: Math.floor(progress * 100) })
      : installing
        ? t('updates.updating')
        : isOta
          ? t('updates.updateNow')
          : t('updates.installApk');

  return (
    <Dialog
      visible
      title={title}
      message={message}
      onRequestClose={() => {
        if (!installing) dismiss();
      }}
    >
      {status === 'installFailed' ? (
        <AppText
          variant="caption"
          color={palette.coralDark}
          align="center"
          accessibilityRole="alert"
        >
          {t('updates.installFailed')}
        </AppText>
      ) : null}
      <GameButton
        label={actionLabel}
        icon={isOta ? 'refresh' : 'download'}
        size="md"
        disabled={installing}
        onPress={() => void install()}
        testID="update-install"
      />
      <GameButton
        label={t('updates.later')}
        variant="secondary"
        size="md"
        disabled={installing}
        onPress={dismiss}
        testID="update-later"
      />
    </Dialog>
  );
}
