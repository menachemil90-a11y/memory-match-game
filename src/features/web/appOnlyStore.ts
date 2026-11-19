import { router, type Href } from 'expo-router';
import { create } from 'zustand';

import { capabilities } from '@/lib/platform/capabilities';

/**
 * The "Available in the app" popup of the web game. `feature` is the name of
 * the button that was tapped (e.g. "Solo"); null when the popup was opened by
 * a "Download the app" button (iPhone: explains the app is Android-only).
 */
interface AppOnlyState {
  visible: boolean;
  feature: string | null;
  open: (feature: string | null) => void;
  close: () => void;
}

export const useAppOnlyPrompt = create<AppOnlyState>()((set) => ({
  visible: false,
  feature: null,
  open: (feature) => set({ visible: true, feature }),
  close: () => set({ visible: false }),
}));

/**
 * For buttons of app-only features (Solo, 2 Players, My Boards, Create board):
 * opens the screen in the app; in the web game, explains it is in the app.
 */
export function openAppFeature(feature: string, href: Href): void {
  if (capabilities.appFeatures) router.push(href);
  else useAppOnlyPrompt.getState().open(feature);
}
