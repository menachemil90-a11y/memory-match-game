import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';

import { GameButton } from '@/ui/components';

import { useDownloadAction } from './useDownloadAction';

export interface DownloadAppButtonProps {
  label?: string;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/** Big "Download the app" button (see useDownloadAction for what it does). */
export function DownloadAppButton({ label, size = 'lg', style }: DownloadAppButtonProps) {
  const { t } = useTranslation();
  const action = useDownloadAction();
  return (
    <GameButton
      label={label ?? t('web.download')}
      icon="download"
      variant="accent"
      size={size}
      style={style}
      testID="download-app"
      {...action}
    />
  );
}
