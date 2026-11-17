import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function OnlineLobbyScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('online.title')}
      phase={5}
      links={[{ label: t('online.room', { code: 'ABC234' }), href: '/online/ABC234' }]}
    />
  );
}
