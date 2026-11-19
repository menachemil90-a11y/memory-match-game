import * as Clipboard from 'expo-clipboard';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

/**
 * Web: the browser's share sheet where there is one (phones), otherwise the
 * invite is copied so it can be pasted into any chat (most desktop browsers).
 */
export async function shareInvite(message: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'dismissed';
      throw error;
    }
  }
  await Clipboard.setStringAsync(message);
  return 'copied';
}
