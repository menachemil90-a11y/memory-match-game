import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/components';

export default function MyBoardsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('myBoards.title')}
      phase={4}
      links={[
        { label: t('boards.create'), href: '/my-boards/crop', variant: 'success' },
        { label: t('myBoards.editorTitle'), href: '/my-boards/sample' },
      ]}
    />
  );
}
