import type { RealtimeChannel } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { create } from 'zustand';

import type { Board } from '@/features/boards/types';
import type { LevelId } from '@/game';

import {
  ensureSignedIn,
  fetchMinSupportedVersion,
  fetchRoom,
  onlineApi,
  removeRoomPhotos,
  signRoomPhotos,
  uploadRoomPhoto,
} from './api';
import { APP_VERSION, HEARTBEAT_MS } from './config';
import { OnlineError, toOnlineError } from './errors';
import { pickRoomPhotos, roomCardJpeg } from './hostPhotoRoom';
import { isNewer, seatOf, type RoomRow, type Seat } from './room';
import {
  RESIGN_AFTER_MS,
  isPhotoRoom,
  photoRoomBoard,
  roomPhotoPath,
  roomPhotoPaths,
} from './roomPhotos';
import { getSupabase } from './supabaseClient';
import { versionGte } from './version';

export type Connection = 'offline' | 'connecting' | 'online';

/** Photo room cards on this device: `failed` → the screen offers "Try again". */
export type PhotoBoardStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface PhotoUploadProgress {
  done: number;
  total: number;
}

interface OnlineState {
  userId: string | null;
  room: RoomRow | null;
  seat: Seat | null;
  /** server time − device time (ms), so timers use the server clock. */
  clockOffsetMs: number;
  /**
   * How far off clockOffsetMs can be: half the round trip of the sync request
   * (the server read its clock somewhere in between). Conservative until synced.
   */
  clockErrorMs: number;
  connection: Connection;
  /** Realtime presence: is the opponent's app connected right now? */
  opponentPresent: boolean;
  /** Prepare: sign in, check the minimum supported version. */
  prepare: () => Promise<void>;
  createRoom: (boardId: string, levelId: LevelId, name: string, avatar: string) => Promise<RoomRow>;
  /**
   * Host only: opens a room on one of their photo boards. Uploads one small
   * card per pair (picked at random), then opens the room for the friend.
   * On failure the room is closed and anything uploaded is deleted.
   */
  createPhotoRoom: (
    board: Board,
    levelId: LevelId,
    name: string,
    avatar: string,
    onProgress?: (p: PhotoUploadProgress) => void,
  ) => Promise<RoomRow>;
  /** The current photo room's board (signed URLs), for both players. */
  photoBoard: Board | null;
  photoBoardStatus: PhotoBoardStatus;
  /** Loads (or re-signs, when old) the cards of the current photo room. */
  loadPhotoBoard: () => Promise<void>;
  joinRoom: (code: string, name: string, avatar: string) => Promise<RoomRow>;
  /** A join is in progress (the room screen shows "Connecting…"). */
  joining: boolean;
  /** Re-attach to a room this user is already in (e.g. after the app restarted). */
  attach: (room: RoomRow) => void;
  applyRoom: (room: RoomRow | null) => void;
  /** Runs a game action; the returned row is applied immediately. */
  act: (fn: (roomId: string) => Promise<RoomRow>) => Promise<RoomRow | null>;
  leave: () => Promise<void>;
  detach: () => void;
}

/** Clock-sync error assumed before the first sync (ms). */
const UNSYNCED_CLOCK_ERROR_MS = 1000;

let channel: RealtimeChannel | null = null;
/** When the current photo board's URLs were signed (device clock). */
let photoBoardSignedAt = 0;
let photoBoardLoad: Promise<void> | null = null;

/** Host: deletes the room's cards now. The server deletes them anyway — this is just sooner. */
async function deleteRoomPhotos(room: RoomRow): Promise<void> {
  if (!isPhotoRoom(room)) return;
  try {
    await removeRoomPhotos(roomPhotoPaths(room));
  } catch (error) {
    console.warn('Could not delete the room photos now; the server will delete them.', error);
  }
}
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function syncClock(set: (s: Partial<OnlineState>) => void) {
  const t0 = Date.now();
  const server = await onlineApi.serverTime();
  const t1 = Date.now();
  set({ clockOffsetMs: Date.parse(server) - (t0 + t1) / 2, clockErrorMs: (t1 - t0) / 2 });
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
    clockErrorMs: UNSYNCED_CLOCK_ERROR_MS,
    connection: 'offline',
    opponentPresent: false,
    photoBoard: null,
    photoBoardStatus: 'idle',
    joining: false,

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

    async createPhotoRoom(board, levelId, name, avatar, onProgress) {
      await get().prepare();
      const room = await onlineApi.createPhotoRoom(levelId, board.cardBack, name, avatar);
      if (!isPhotoRoom(room)) throw new OnlineError('unknown', 'Server did not open a photo room');
      try {
        const photos = pickRoomPhotos(board, room.photo_ids.length);
        const total = photos.length;
        onProgress?.({ done: 0, total });
        for (let i = 0; i < total; i++) {
          const jpeg = await roomCardJpeg(photos[i]!);
          await uploadRoomPhoto(roomPhotoPath(room.id, room.photo_ids[i]!), jpeg);
          onProgress?.({ done: i + 1, total });
        }
        const open = await onlineApi.photoRoomReady(room.id);
        get().attach(open);
        return open;
      } catch (error) {
        await deleteRoomPhotos(room);
        await onlineApi
          .leaveRoom(room.id)
          .catch((e: unknown) => console.warn('Could not close the photo room', e));
        throw toOnlineError(error);
      }
    },

    async loadPhotoBoard() {
      const room = get().room;
      if (!room || !isPhotoRoom(room)) return;
      const current = get().photoBoard;
      const fresh =
        current?.id === `room:${room.id}` && Date.now() - photoBoardSignedAt < RESIGN_AFTER_MS;
      if (fresh) return;
      if (photoBoardLoad) return photoBoardLoad;
      // Keep showing the current cards while re-signing; show loading only the first time.
      if (current?.id !== `room:${room.id}`) set({ photoBoard: null, photoBoardStatus: 'loading' });
      photoBoardLoad = (async () => {
        try {
          const byPath = await signRoomPhotos(roomPhotoPaths(room));
          const byId = new Map(
            room.photo_ids.map((id) => [id, byPath.get(roomPhotoPath(room.id, id)) ?? '']),
          );
          const board = photoRoomBoard(room, byId);
          const loaded = await Image.prefetch([...byId.values()], 'memory');
          if (!loaded) throw new OnlineError('network', 'Could not download the photo cards');
          if (get().room?.id !== room.id) return;
          photoBoardSignedAt = Date.now();
          set({ photoBoard: board, photoBoardStatus: 'ready' });
        } catch (error) {
          console.warn('Could not load the photo cards', error);
          if (get().room?.id === room.id && get().photoBoard?.id !== `room:${room.id}`) {
            set({ photoBoardStatus: 'failed' });
          }
        } finally {
          photoBoardLoad = null;
        }
      })();
      return photoBoardLoad;
    },

    async joinRoom(code, name, avatar) {
      set({ joining: true });
      try {
        await get().prepare();
        const room = await onlineApi.joinRoom(code, name, avatar);
        get().attach(room);
        return room;
      } finally {
        set({ joining: false });
      }
    },

    attach(room) {
      const userId = get().userId;
      const seat = userId ? seatOf(room, userId) : null;
      if (get().room?.id !== room.id) {
        photoBoardSignedAt = 0;
        set({ photoBoard: null, photoBoardStatus: 'idle' });
      }
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
      const isHost = get().seat === 0;
      let after: RoomRow | null = room;
      if (room && room.status !== 'closed') {
        after = await onlineApi.leaveRoom(room.id).catch(() => null);
      }
      // The host deletes their cards as soon as the room is closed. (A forfeit
      // leaves the room 'finished' for the friend's results screen; the server
      // deletes the cards once the friend leaves too.)
      if (room && isHost && after?.status === 'closed') await deleteRoomPhotos(room);
      get().detach();
    },

    detach() {
      stopRealtime();
      photoBoardSignedAt = 0;
      set({
        room: null,
        seat: null,
        connection: 'offline',
        opponentPresent: false,
        photoBoard: null,
        photoBoardStatus: 'idle',
      });
    },
  };
});
