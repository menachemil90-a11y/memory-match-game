import { Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

/** Opens the phone's share sheet with the invite message. */
export async function shareInvite(message: string): Promise<ShareOutcome> {
  const result = await Share.share({ message });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
