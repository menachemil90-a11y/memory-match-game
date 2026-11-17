import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('settings.title')}
      phase={6}
      links={[{ label: t('settings.credits'), href: '/settings/credits' }]}
    />
  );
}
