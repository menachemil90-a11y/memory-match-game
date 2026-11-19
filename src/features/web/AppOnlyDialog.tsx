import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Dialog, GameButton } from '@/ui/components';

import { useAppOnlyPrompt } from './appOnlyStore';
import { deviceKind } from './device';
import { DownloadAppButton } from './DownloadAppButton';

/** "Available in the app" — shown by app-only buttons in the web game. */
export function AppOnlyDialog() {
  const { t } = useTranslation();
  const visible = useAppOnlyPrompt((s) => s.visible);
  const feature = useAppOnlyPrompt((s) => s.feature);
  const close = useAppOnlyPrompt((s) => s.close);
  const device = deviceKind();

  const parts = [
    feature ? t('web.appOnlyFeature', { feature }) : null,
    device === 'ios' ? t('web.iosMessage') : t('web.appOnlyMessage'),
    device === 'other' ? t('web.desktopHint') : null,
    device === 'android' ? t('web.installHint') : null,
  ];

  return (
    <Dialog
      visible={visible}
      title={t('web.appOnlyTitle')}
      message={parts.filter(Boolean).join('\n\n')}
      onRequestClose={close}
    >
      {device === 'ios' ? null : <DownloadAppButton label={t('web.downloadAndroid')} size="md" />}
      <GameButton
        label={t('web.playOnline')}
        icon="globe-outline"
        variant="info"
        size="md"
        onPress={() => {
          close();
          router.push('/online');
        }}
      />
      <GameButton label={t('web.notNow')} variant="secondary" size="md" onPress={close} />
    </Dialog>
  );
}
