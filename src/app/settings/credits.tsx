import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function CreditsScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('settings.credits')} phase={6} />;
}
