import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { LevelId } from '@/game';

import { ensureSignedIn, fetchMinSupportedVersion, fetchRoom, onlineApi } from './api';
import { APP_VERSION, HEARTBEAT_MS } from './config';
import { OnlineError, toOnlineError } from './errors';
import { isNewer, seatOf, type RoomRow, type Seat } from './room';
import { getSupabase } from './supabaseClient';
import { versionGte } from './version';

export type Connection = 'offline' | 'connecting' | 'online';

interface OnlineState {
  userId: string | null;
  room: RoomRow | null;
  seat: Seat | null;
  /** server time − device time (ms), so timers use the server clock. */
  clockOffsetMs: number;
  connection: Connection;
  /** Realtime presence: is the opponent's app connected right now? */
  opponentPresent: boolean;
  /** Prepare: sign in, check the minimum supported version. */
  prepare: () => Promise<void>;
  createRoom: (boardId: string, levelId: LevelId, name: string, avatar: string) => Promise<RoomRow>;
  joinRoom: (code: string, name: string, avatar: string) => Promise<RoomRow>;
  /** Re-attach to a room this user is already in (e.g. after the app restarted). */
  attach: (room: RoomRow) => void;
  applyRoom: (room: RoomRow | null) => void;
  /** Runs a game action; the returned row is applied immediately. */
  act: (fn: (roomId: string) => Promise<RoomRow>) => Promise<RoomRow | null>;
  leave: () => Promise<void>;
  detach: () => void;
}

let channel: RealtimeChannel | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function syncClock(set: (s: Partial<OnlineState>) => void) {
  const t0 = Date.now();
  const server = await onlineApi.serverTime();
  const t1 = Date.now();
  set({ clockOffsetMs: Date.parse(server) - (t0 + t1) / 2 });
}

export const useOnline = create<OnlineState>()((set, get) => {
  const stopRealtime = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (channel) void getSupabase()?.removeChannel(channel);
    channel = null;
  };

  const startRealtime = (room: RoomRow) => {
    const supabase = getSupabase();
    if (!supabase) return;
    stopRealtime();
    set({ connection: 'connecting' });
    const mySeat = get().seat;
    channel = supabase
      .channel(`room:${room.id}`, { config: { presence: { key: String(mySeat) } } })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => get().applyRoom(payload.new as RoomRow),
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel?.presenceState() ?? {};
        const other = String(1 - (get().seat ?? 0));
        set({ opponentPresent: Object.keys(state).includes(other) });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          set({ connection: 'online' });
          void channel?.track({ seat: mySeat, at: Date.now() });
          // Catch up on anything missed while (re)connecting.
          void fetchRoom(room.id)
            .then((r) => get().applyRoom(r))
            .catch(() => undefined);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          set({ connection: 'offline' });
        }
      });

    const beat = () => {
      const id = get().room?.id;
      if (!id) return;
      void onlineApi
        .heartbeat(id)
        .then(() => set({ connection: channel ? get().connection : 'online' }))
        .catch(() => set({ connection: 'offline' }));
    };
    beat();
    heartbeatTimer = setInterval(beat, HEARTBEAT_MS);
    void syncClock(set).catch(() => undefined);
  };

  return {
    userId: null,
    room: null,
    seat: null,
    clockOffsetMs: 0,
    connection: 'offline',
    opponentPresent: false,

    async prepare() {
      const userId = await ensureSignedIn();
      set({ userId });
      const min = await fetchMinSupportedVersion();
      if (min && !versionGte(APP_VERSION, min)) throw new OnlineError('update_required');
    },

    async createRoom(boardId, levelId, name, avatar) {
      await get().prepare();
      const room = await onlineApi.createRoom(boardId, levelId, name, avatar);
      get().attach(room);
      return room;
    },

    async joinRoom(code, name, avatar) {
      await get().prepare();
      const room = await onlineApi.joinRoom(code, name, avatar);
      get().attach(room);
      return room;
    },

    attach(room) {
      const userId = get().userId;
      const seat = userId ? seatOf(room, userId) : null;
      set({ room, seat, opponentPresent: false });
      startRealtime(room);
    },

    applyRoom(room) {
      if (!room) return;
      const current = get().room;
      if (current && current.id !== room.id) return;
      if (isNewer(room, current)) set({ room });
    },

    async act(fn) {
      const room = get().room;
      if (!room) return null;
      try {
        const next = await fn(room.id);
        get().applyRoom(next);
        return next;
      } catch (error) {
        throw toOnlineError(error);
      }
    },

    async leave() {
      const room = get().room;
      if (room && room.status !== 'closed') {
        await onlineApi.leaveRoom(room.id).catch(() => undefined);
      }
      get().detach();
    },

    detach() {
      stopRealtime();
      set({ room: null, seat: null, connection: 'offline', opponentPresent: false });
    },
  };
});
