import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AvatarId } from '@/features/boards/builtin';
import { kvStateStorage } from '@/lib/kvStorage';
import { colors } from '@/ui/theme';

export type PlayerColorId = (typeof colors.players)[number]['id'];

export interface PlayerProfile {
  name: string;
  color: PlayerColorId;
  avatar: AvatarId;
}

export const MAX_NAME_LENGTH = 14;

interface PlayersState {
  /** Remembered 2-player setup (index 0 = Player 1). */
  local: [PlayerProfile, PlayerProfile];
  /** Tabletop mode: phone flat between players, Player 2's side rotated 180°. */
  tabletop: boolean;
  setLocalPlayer: (index: 0 | 1, profile: PlayerProfile) => void;
  setTabletop: (value: boolean) => void;
}

export const DEFAULT_LOCAL_PLAYERS: [PlayerProfile, PlayerProfile] = [
  { name: '', color: 'coral', avatar: 'fox' },
  { name: '', color: 'sky', avatar: 'panda' },
];

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export const usePlayersStore = create<PlayersState>()(
  persist(
    (set) => ({
      local: DEFAULT_LOCAL_PLAYERS,
      tabletop: false,
      setLocalPlayer: (index, profile) =>
        set((s) => {
          const local: [PlayerProfile, PlayerProfile] = [...s.local];
          local[index] = { ...profile, name: sanitizeName(profile.name) };
          return { local };
        }),
      setTabletop: (tabletop) => set({ tabletop }),
    }),
    { name: 'players', version: 1, storage: createJSONStorage(() => kvStateStorage) },
  ),
);

export function playerColor(id: PlayerColorId) {
  return colors.players.find((c) => c.id === id) ?? colors.players[0];
}
