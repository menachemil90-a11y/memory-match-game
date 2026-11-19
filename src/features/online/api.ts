import type { LevelId } from '@/game';

import { APP_VERSION } from './config';
import { OnlineError, toOnlineError } from './errors';
import type { RoomRow } from './room';
import { ROOM_PHOTOS_BUCKET, SIGNED_URL_SECONDS } from './roomPhotos';
import { getSupabase } from './supabaseClient';

function supabase() {
  const client = getSupabase();
  if (!client) throw new OnlineError('network', 'Online play is not configured');
  return client;
}

/** Signs in anonymously once; the session is kept on the device. Returns the user id. */
export async function ensureSignedIn(): Promise<string> {
  const auth = supabase().auth;
  const { data } = await auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signedIn, error } = await auth.signInAnonymously();
  if (error || !signedIn.user) throw toOnlineError(error ?? 'not_signed_in');
  return signedIn.user.id;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase().rpc(fn, args);
    if (error) throw error;
    return data as T;
  } catch (error) {
    throw toOnlineError(error);
  }
}

export async function fetchMinSupportedVersion(): Promise<string | null> {
  try {
    const { data, error } = await supabase()
      .from('app_config')
      .select('value')
      .eq('key', 'min_supported_version')
      .maybeSingle();
    if (error) throw error;
    return typeof data?.value === 'string' ? data.value : null;
  } catch (error) {
    throw toOnlineError(error);
  }
}

export async function fetchRoom(roomId: string): Promise<RoomRow | null> {
  const { data, error } = await supabase().from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) throw toOnlineError(error);
  return (data as RoomRow | null) ?? null;
}

/**
 * This player's own open room with this code, if they are already in it
 * (row-level security only shows a player their own rooms). Used after a reload.
 * Does not sign in: a visitor without a session simply isn't in any room.
 */
export async function fetchMyRoomByCode(code: string): Promise<RoomRow | null> {
  const auth = supabase().auth;
  const { data } = await auth.getSession();
  if (!data.session) return null;
  const { data: room, error } = await supabase()
    .from('rooms')
    .select('*')
    .eq('code', code)
    .neq('status', 'closed')
    .maybeSingle();
  if (error) throw toOnlineError(error);
  return (room as RoomRow | null) ?? null;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}

export const onlineApi = {
  createPhotoRoom: (levelId: LevelId, cardBack: string, name: string, avatar: string) =>
    rpc<RoomRow>('create_photo_room', {
      p_level_id: levelId,
      p_card_back: cardBack,
      p_name: name,
      p_avatar: avatar,
      p_app_version: APP_VERSION,
    }),
  photoRoomReady: (roomId: string) => rpc<RoomRow>('photo_room_ready', { p_room_id: roomId }),
  createRoom: (boardId: string, levelId: LevelId, name: string, avatar: string) =>
    rpc<RoomRow>('create_room', {
      p_board_id: boardId,
      p_level_id: levelId,
      p_name: name,
      p_avatar: avatar,
      p_app_version: APP_VERSION,
    }),
  joinRoom: (code: string, name: string, avatar: string) =>
    rpc<RoomRow>('join_room', {
      p_code: code,
      p_name: name,
      p_avatar: avatar,
      p_app_version: APP_VERSION,
    }),
  flipCard: (roomId: string, index: number) =>
    rpc<RoomRow>('flip_card', { p_room_id: roomId, p_index: index }),
  resolveTurn: (roomId: string, skip = false) =>
    rpc<RoomRow>('resolve_turn', { p_room_id: roomId, p_skip: skip }),
  claimTimeout: (roomId: string) => rpc<RoomRow>('claim_timeout', { p_room_id: roomId }),
  heartbeat: (roomId: string) => rpc<string>('heartbeat', { p_room_id: roomId }),
  claimDisconnectWin: (roomId: string) =>
    rpc<RoomRow>('claim_disconnect_win', { p_room_id: roomId }),
  leaveRoom: (roomId: string) => rpc<RoomRow>('leave_room', { p_room_id: roomId }),
  requestRematch: (roomId: string) => rpc<RoomRow>('request_rematch', { p_room_id: roomId }),
  serverTime: () => rpc<string>('server_time', {}),
};

/** Host: uploads one card (JPEG bytes) of a photo room being prepared. */
export async function uploadRoomPhoto(path: string, jpeg: ArrayBuffer): Promise<void> {
  const { error } = await supabase()
    .storage.from(ROOM_PHOTOS_BUCKET)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
  if (error) throw toOnlineError(error);
}

/** Both players: short-lived signed URLs of the room's cards (path → URL). */
export async function signRoomPhotos(paths: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase()
    .storage.from(ROOM_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw toOnlineError(error);
  const urls = new Map<string, string>();
  for (const entry of data) {
    if (entry.error || !entry.path || !entry.signedUrl) {
      throw new OnlineError('unknown', `Could not sign ${entry.path ?? '?'}: ${entry.error}`);
    }
    urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

/** Host: deletes the room's cards right away (the server also does it on its own). */
export async function removeRoomPhotos(paths: string[]): Promise<void> {
  const { error } = await supabase().storage.from(ROOM_PHOTOS_BUCKET).remove(paths);
  if (error) throw toOnlineError(error);
}
