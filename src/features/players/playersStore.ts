import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { AVATAR_IDS, type AvatarId } from '@/features/boards/builtin';
import { MAX_PLAYERS, MIN_MULTIPLAYER } from '@/game';
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
  /**
   * The last group on one phone (MIN_MULTIPLAYER–MAX_PLAYERS players, index 0 =
   * Player 1). Solo games use Player 1's avatar.
   */
  local: PlayerProfile[];
  /** Tabletop mode (2 players only): phone flat between players, Player 2's side rotated 180°. */
  tabletop: boolean;
  /** Online nickname and avatar (no real names needed). */
  online: { name: string; avatar: AvatarId };
  setOnline: (profile: { name: string; avatar: AvatarId }) => void;
  /** Remembers the group for next time (names cleaned up). */
  setLocalPlayers: (players: readonly PlayerProfile[]) => void;
  setTabletop: (value: boolean) => void;
}

export const DEFAULT_LOCAL_PLAYERS: PlayerProfile[] = [
  { name: '', color: 'coral', avatar: 'fox' },
  { name: '', color: 'sky', avatar: 'panda' },
];

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * A new player for the group: the first color nobody has (there is one per
 * possible player) and the first avatar nobody has.
 */
export function newPlayerProfile(group: readonly PlayerProfile[]): PlayerProfile {
  const color = colors.players.find((c) => !group.some((p) => p.color === c.id))!.id;
  const avatar = AVATAR_IDS.find((a) => !group.some((p) => p.avatar === a)) ?? AVATAR_IDS[0]!;
  return { name: '', color, avatar };
}

/**
 * A valid group from whatever was stored: MIN_MULTIPLAYER–MAX_PLAYERS players,
 * every color known and used once (older versions stored exactly two players).
 */
export function normalizeGroup(stored: readonly PlayerProfile[] | undefined): PlayerProfile[] {
  const group: PlayerProfile[] = [];
  for (const p of (stored ?? []).slice(0, MAX_PLAYERS)) {
    const known = colors.players.some((c) => c.id === p.color);
    const taken = group.some((g) => g.color === p.color);
    const avatar = AVATAR_IDS.includes(p.avatar) ? p.avatar : newPlayerProfile(group).avatar;
    group.push({
      name: sanitizeName(p.name ?? ''),
      avatar,
      color: known && !taken ? p.color : newPlayerProfile(group).color,
    });
  }
  while (group.length < MIN_MULTIPLAYER) group.push(newPlayerProfile(group));
  return group;
}

export const usePlayersStore = create<PlayersState>()(
  persist(
    (set) => ({
      local: DEFAULT_LOCAL_PLAYERS,
      tabletop: false,
      online: { name: '', avatar: 'owl' },
      setOnline: (online) => set({ online: { ...online, name: sanitizeName(online.name) } }),
      setLocalPlayers: (players) => set({ local: normalizeGroup(players) }),
      setTabletop: (tabletop) => set({ tabletop }),
    }),
    {
      name: 'players',
      version: 1,
      storage: createJSONStorage(() => kvStateStorage),
      // Same stored shape as before (an array of profiles); only cleaned up on load.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PlayersState>;
        return { ...current, ...saved, local: normalizeGroup(saved.local ?? current.local) };
      },
    },
  ),
);

export function playerColor(id: PlayerColorId) {
  return colors.players.find((c) => c.id === id) ?? colors.players[0];
}
