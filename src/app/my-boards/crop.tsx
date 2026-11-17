import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function CropperScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('myBoards.cropTitle')} phase={4} />;
}
