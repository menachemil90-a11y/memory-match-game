import type { Capabilities } from './types';

export type { Capabilities } from './types';

/** The Android/iOS app: everything. */
export const capabilities: Capabilities = {
  appFeatures: true,
  haptics: true,
  appUpdates: true,
  webShell: false,
};
