import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function LevelPickerScreen() {
  const { t } = useTranslation();
  const { mode = 'solo', boardId = 'animals' } = useLocalSearchParams<{
    mode?: string;
    boardId?: string;
  }>();
  const next =
    mode === 'local'
      ? { pathname: '/setup' as const, params: { boardId } }
      : { pathname: '/game' as const, params: { mode, boardId } };
  return (
    <PlaceholderScreen
      title={t('levels.title')}
      phase={3}
      links={[
        {
          label: mode === 'local' ? t('setup.title') : t('game.title'),
          href: next,
          variant: 'primary',
        },
      ]}
    />
  );
}
