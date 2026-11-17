import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function BoardEditorScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('myBoards.editorTitle')}
      phase={4}
      links={[{ label: t('myBoards.cropTitle'), href: '/my-boards/crop' }]}
    />
  );
}
