import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/features/settings/settingsStore';

function hapticsOn(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

function safe(promise: Promise<void>): void {
  // Haptics can be unavailable (emulators, some tablets) — never crash on it.
  promise.catch(() => undefined);
}

/**
 * Central place for game-feel feedback (haptics now, sound effects in Phase 2).
 * Respects the user's settings toggles.
 */
export const feedback = {
  tap(): void {
    if (hapticsOn()) safe(Haptics.selectionAsync());
  },
  flip(): void {
    if (hapticsOn()) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  match(): void {
    if (hapticsOn()) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  win(): void {
    if (hapticsOn()) safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
};
