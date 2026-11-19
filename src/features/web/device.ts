import { Platform } from 'react-native';

export type DeviceKind = 'android' | 'ios' | 'other';

/** What kind of device a browser runs on, from its user agent. */
export function kindFromUserAgent(userAgent: string, maxTouchPoints = 0): DeviceKind {
  if (/Android/i.test(userAgent)) return 'android';
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) {
    return 'ios';
  }
  return 'other';
}

/** What kind of device is showing the game (for the web game's download offers). */
export function deviceKind(): DeviceKind {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  if (typeof navigator === 'undefined') return 'other';
  return kindFromUserAgent(navigator.userAgent, navigator.maxTouchPoints);
}
