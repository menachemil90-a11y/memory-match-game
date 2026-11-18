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
  const match =
    /online\/([A-Za-z0-9]{6})\b/.exec(text) ??
    /[?&#]c=([A-Za-z0-9]{6})\b/.exec(text) ??
    /\b([A-Za-z0-9]{6})\b/.exec(text);
  const code = match ? normalizeRoomCode(match[1]!) : '';
  return isValidRoomCode(code) ? code : null;
}

const REPO = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;

/**
 * Web page that opens an invite (see site/join/index.html, published with GitHub Pages
 * next to the test APKs). Chat apps like WhatsApp only make https:// links tappable,
 * never custom schemes like memorymatch://, so invites must point here.
 */
export function invitePageUrl(releasesRepo: string | null | undefined): string | null {
  const match = releasesRepo ? REPO.exec(releasesRepo) : null;
  if (!match || match[2] === '.' || match[2] === '..') return null;
  return `https://${match[1]!.toLowerCase()}.github.io/${match[2]!}/join/`;
}

/**
 * Link to send in an invite. A tappable https:// page when the app knows where it is
 * published; otherwise (local builds) the in-app deep link.
 */
export function inviteLink(scheme: string, code: string, releasesRepo?: string | null): string {
  const page = invitePageUrl(releasesRepo);
  return page ? `${page}?c=${code}` : `${scheme}://online/${code}`;
}
