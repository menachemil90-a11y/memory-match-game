import type { AvatarId } from '@/features/boards/builtin';
import type { GamePhase, LevelId, TurnResult } from '@/game';

/** A row of public.rooms as the server sends it (see supabase/migrations). */
export interface RoomRow {
  id: string;
  code: string;
  board_id: string;
  level_id: LevelId;
  /** 'preparing' = photo room whose host is still uploading the cards. */
  status: 'preparing' | 'waiting' | 'playing' | 'finished' | 'closed';
  host_id: string;
  guest_id: string | null;
  players: { name: string; avatar: AvatarId }[];
  game_number: number;
  starting_player: 0 | 1 | null;
  current_player: 0 | 1 | null;
  phase: GamePhase | null;
  cards: { s: 'down' | 'up' | 'matched'; i: string | null; m: 0 | 1 | null }[];
  flipped: number[];
  pending_result: TurnResult | null;
  collected: [string[], string[]];
  moves: [number, number];
  pairs_total: number;
  pairs_found: number;
  winner: 0 | 1 | -1 | null;
  end_reason: 'complete' | 'forfeit' | 'disconnect' | null;
  turn_deadline: string | null;
  resolve_at: string | null;
  rematch: number[];
  host_seen_at: string;
  guest_seen_at: string | null;
  version: number;
  updated_at: string;
  /** Photo room: the card image ids ('p1' …); null for built-in boards. */
  photo_ids: string[] | null;
  /** Photo room: the host board's card back (may be unknown to this app). */
  card_back: string | null;
}

export type Seat = 0 | 1;

export function seatOf(room: RoomRow, userId: string): Seat | null {
  if (room.host_id === userId) return 0;
  if (room.guest_id === userId) return 1;
  return null;
}

/** Realtime and RPC replies can arrive out of order — keep only the newest. */
export function isNewer(next: RoomRow, current: RoomRow | null): boolean {
  if (!current || current.id !== next.id) return true;
  if (next.game_number !== current.game_number) return next.game_number > current.game_number;
  return next.version > current.version;
}

/** Milliseconds left on the turn clock, using the server-clock offset. */
export function msUntil(
  iso: string | null,
  clockOffsetMs: number,
  now: number = Date.now(),
): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Date.parse(iso) - (now + clockOffsetMs);
}

/**
 * How long to wait until the server's clock has surely passed `iso`: the
 * clock-offset estimate can be off by up to half a round trip (`clockErrorMs`),
 * so waiting only for the estimate would sometimes ask the server too early.
 */
export function msUntilServerPassed(
  iso: string | null,
  clockOffsetMs: number,
  clockErrorMs: number,
  now: number = Date.now(),
): number {
  if (!iso) return 0;
  return Math.max(0, msUntil(iso, clockOffsetMs, now) + clockErrorMs + SERVER_TIME_MARGIN_MS);
}

/** Extra wait on top of the clock-sync error (timer jitter). */
export const SERVER_TIME_MARGIN_MS = 50;

/** Seconds since the opponent's last heartbeat (server clock). */
export function opponentSilenceSeconds(
  room: RoomRow,
  seat: Seat,
  clockOffsetMs: number,
  now: number = Date.now(),
): number {
  const seen = seat === 0 ? room.guest_seen_at : room.host_seen_at;
  if (!seen) return 0;
  return Math.max(0, (now + clockOffsetMs - Date.parse(seen)) / 1000);
}
