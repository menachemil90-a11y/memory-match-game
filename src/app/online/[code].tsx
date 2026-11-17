import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

/** Waiting room / online match. Also the target of `memorymatch://online/<CODE>` invite links. */
export default function OnlineRoomScreen() {
  const { t } = useTranslation();
  const { code = '' } = useLocalSearchParams<{ code?: string }>();
  return <PlaceholderScreen title={t('online.room', { code: code.toUpperCase() })} phase={5} />;
}
