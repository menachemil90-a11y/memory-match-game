import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStateStorage } from '@/lib/kvStorage';

export type FlipBackSpeed = 'normal' | 'kids';

export interface SettingsState {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  flipBackSpeed: FlipBackSpeed;
  setSoundEnabled: (value: boolean) => void;
  setMusicEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setFlipBackSpeed: (value: FlipBackSpeed) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      musicEnabled: false,
      hapticsEnabled: true,
      flipBackSpeed: 'normal',
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setFlipBackSpeed: (flipBackSpeed) => set({ flipBackSpeed }),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => kvStateStorage),
    },
  ),
);
