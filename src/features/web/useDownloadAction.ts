import { APP_DOWNLOAD_URL } from '@/lib/links';

import { useAppOnlyPrompt } from './appOnlyStore';
import { deviceKind } from './device';

/**
 * What a "Download the app" button does: a real link to the newest Android
 * app (APP_DOWNLOAD_URL), or — on an iPhone, where there is nothing to
 * download yet — the popup explaining the app is Android-only for now.
 */
export function useDownloadAction(): { href?: string; onPress?: () => void } {
  const open = useAppOnlyPrompt((s) => s.open);
  return deviceKind() === 'ios' ? { onPress: () => open(null) } : { href: APP_DOWNLOAD_URL };
}
