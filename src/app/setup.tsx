import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function PlayerSetupScreen() {
  const { t } = useTranslation();
  const { boardId = 'animals' } = useLocalSearchParams<{ boardId?: string }>();
  return (
    <PlaceholderScreen
      title={t('setup.title')}
      phase={2}
      links={[
        {
          label: t('game.title'),
          href: { pathname: '/game', params: { mode: 'local', boardId } },
          variant: 'primary',
        },
      ]}
    />
  );
}
