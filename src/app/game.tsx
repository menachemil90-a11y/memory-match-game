import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function GameScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('game.title')}
      phase={2}
      links={[{ label: t('results.title'), href: '/results', variant: 'primary' }]}
    />
  );
}
