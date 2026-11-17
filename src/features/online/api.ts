import type { LevelId } from '@/game';

import { APP_VERSION } from './config';
import { OnlineError, toOnlineError } from './errors';
import type { RoomRow } from './room';
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

export const onlineApi = {
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
