/** Error codes raised by the server functions (see the migration). */
export const SERVER_ERRORS = [
  'not_signed_in',
  'update_required',
  'unknown_board',
  'unknown_level',
  'invalid_nickname',
  'nickname_not_allowed',
  'room_not_found',
  'room_full',
  'not_in_room',
  'game_not_active',
  'not_now',
  'not_your_turn',
  'invalid_card',
  'too_early',
  'not_expired',
  'opponent_still_connected',
  'game_not_finished',
] as const;

export type ServerErrorCode = (typeof SERVER_ERRORS)[number] | 'network' | 'unknown';

export class OnlineError extends Error {
  constructor(
    public readonly code: ServerErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OnlineError';
  }
}

export function toOnlineError(error: unknown): OnlineError {
  if (error instanceof OnlineError) return error;
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const code = SERVER_ERRORS.find((c) => message.includes(c));
  if (code) return new OnlineError(code, message);
  if (/network|fetch|timeout|failed to fetch|connection/i.test(message)) {
    return new OnlineError('network', message);
  }
  return new OnlineError('unknown', message);
}
