import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function BoardPickerScreen() {
  const { t } = useTranslation();
  const { mode = 'solo' } = useLocalSearchParams<{ mode?: string }>();
  return (
    <PlaceholderScreen
      title={t('boards.title')}
      phase={3}
      links={[
        {
          label: t('levels.title'),
          href: { pathname: '/levels', params: { mode, boardId: 'animals' } },
          variant: 'primary',
        },
        { label: t('boards.create'), href: '/my-boards/crop' },
      ]}
    />
  );
}
