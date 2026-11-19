import type { Capabilities } from './types';

export type { Capabilities } from './types';

/**
 * The web game (GitHub Pages): online play only. App-only buttons stay visible
 * and open the "Available in the app" popup (see src/features/web).
 */
export const capabilities: Capabilities = {
  appFeatures: false,
  haptics: false,
  appUpdates: false,
  webShell: true,
};
