import { WEB_GAME_URL } from '@/lib/links';

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
  const linked = /online\/([A-Za-z0-9]{6})\b/.exec(text) ?? /[?&#]c=([A-Za-z0-9]{6})\b/.exec(text);
  const candidates = linked
    ? [linked[1]!]
    : [...text.matchAll(/\b([A-Za-z0-9]{6})\b/g)].map((m) => m[1]!);
  for (const candidate of candidates) {
    const code = normalizeRoomCode(candidate);
    if (isValidRoomCode(code) && code === candidate.toUpperCase()) return code;
  }
  return null;
}

/**
 * The invite link: the web game's join page (WEB_GAME_URL/join/?c=CODE). A
 * friend taps it and plays right in the browser; chat apps make https links
 * tappable (never custom schemes like memorymatch://), and the page is a real
 * file, so link previews work. Links sent before the web game existed use the
 * same address, so they keep working.
 */
export function inviteLink(code: string): string {
  return `${WEB_GAME_URL}/join/?c=${code}`;
}

/** The app's own deep link to a room (memorymatch://online/CODE). */
export function appRoomLink(scheme: string, code: string): string {
  return `${scheme}://online/${code}`;
}

/**
 * "Open in app" from Android's browser: an intent link that opens the app when
 * it is installed and otherwise brings the browser back to `fallbackUrl`.
 */
export function androidOpenInAppLink(
  scheme: string,
  androidPackage: string,
  code: string,
  fallbackUrl: string,
): string {
  return (
    `intent://online/${code}#Intent;scheme=${scheme};package=${androidPackage};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
  );
}
