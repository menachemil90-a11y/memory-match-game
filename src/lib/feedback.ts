import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/features/settings/settingsStore';

import { playSound } from './sound';

function hapticsOn(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

function safe(promise: Promise<void>): void {
  // Haptics can be unavailable (emulators, some tablets) — never crash on it.
  promise.catch(() => undefined);
}

/**
 * Central place for game-feel feedback: sound effects + haptics.
 * Respects the user's sound and haptics toggles.
 */
export const feedback = {
  tap(): void {
    playSound('tap');
    if (hapticsOn()) safe(Haptics.selectionAsync());
  },
  deal(): void {
    playSound('deal');
  },
  flip(): void {
    playSound('flip');
    if (hapticsOn()) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  match(): void {
    playSound('match');
    if (hapticsOn()) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  miss(): void {
    playSound('miss');
    if (hapticsOn()) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
  },
  turn(): void {
    playSound('turn');
  },
  win(): void {
    playSound('win');
    if (hapticsOn()) safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
};
