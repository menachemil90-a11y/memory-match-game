/** Room codes: 6 characters, no ambiguous O/0/I/1. Must match the server's alphabet. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

/** Cleans user input: upper-case, only valid characters, at most 6. */
export function normalizeRoomCode(input: string): string {
  return [...input.toUpperCase()]
    .filter((c) => ROOM_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && normalizeRoomCode(code) === code;
}

/** Extracts a code from a pasted invite message or link. */
export function codeFromText(text: string): string | null {
  const match = /online\/([A-Za-z0-9]{6})\b/.exec(text) ?? /\b([A-Za-z0-9]{6})\b/.exec(text);
  const code = match ? normalizeRoomCode(match[1]!) : '';
  return isValidRoomCode(code) ? code : null;
}

export function inviteLink(scheme: string, code: string): string {
  return `${scheme}://online/${code}`;
}
