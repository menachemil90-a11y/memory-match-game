import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function ResultsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('results.title')}
      phase={2}
      links={[{ label: t('notFound.goHome'), href: '/', variant: 'primary' }]}
    />
  );
}
