/** @jest-environment node */
import { OnlineError, toOnlineError } from '../errors';
import { checkNickname } from '../nickname';
import { isNewer, msUntil, opponentSilenceSeconds, seatOf, type RoomRow } from '../room';
import {
  codeFromText,
  inviteLink,
  invitePageUrl,
  isValidRoomCode,
  normalizeRoomCode,
} from '../roomCode';
import { versionGte } from '../version';

const room = (patch: Partial<RoomRow> = {}) =>
  ({
    id: 'r1',
    host_id: 'h',
    guest_id: 'g',
    game_number: 1,
    version: 5,
    host_seen_at: '2026-01-01T00:00:00.000Z',
    guest_seen_at: '2026-01-01T00:00:50.000Z',
    ...patch,
  }) as RoomRow;

describe('room codes', () => {
  it('normalizes user input to the unambiguous alphabet', () => {
    expect(normalizeRoomCode(' abc-234 ')).toBe('ABC234');
    expect(normalizeRoomCode('O0I1abcdefgh')).toBe('ABCDEF');
    expect(isValidRoomCode('ABC234')).toBe(true);
    expect(isValidRoomCode('ABC23')).toBe(false);
    expect(isValidRoomCode('ABC231')).toBe(false);
  });

  it('finds codes in invite messages and links', () => {
    expect(codeFromText('Join me! memorymatch://online/XKCD42')).toBe('XKCD42');
    expect(codeFromText('code: hjkm23 see you')).toBe('HJKM23');
    expect(codeFromText('nothing here')).toBeNull();
    expect(inviteLink('memorymatch', 'XKCD42')).toBe('memorymatch://online/XKCD42');
    expect(codeFromText('Tap: https://someone.github.io/memory-match-game/join/?c=xkcd42')).toBe(
      'XKCD42',
    );
  });

  it('invites with a tappable https link when the publish repo is known', () => {
    // WhatsApp and most chat apps never make custom schemes (memorymatch://) tappable.
    expect(inviteLink('memorymatch', 'XKCD42', 'Some-Owner/memory-match-game')).toBe(
      'https://some-owner.github.io/memory-match-game/join/?c=XKCD42',
    );
    expect(inviteLink('memorymatch', 'XKCD42', null)).toBe('memorymatch://online/XKCD42');
    expect(invitePageUrl('../etc')).toBeNull();
    expect(invitePageUrl('owner/..')).toBeNull();
    expect(invitePageUrl('owner')).toBeNull();
  });
});

describe('versions', () => {
  it('compares dotted versions numerically', () => {
    expect(versionGte('1.2.10', '1.2.9')).toBe(true);
    expect(versionGte('1.2', '1.2.0')).toBe(true);
    expect(versionGte('0.9.9', '1.0.0')).toBe(false);
  });
});

describe('room helpers', () => {
  it('finds my seat', () => {
    expect(seatOf(room(), 'h')).toBe(0);
    expect(seatOf(room(), 'g')).toBe(1);
    expect(seatOf(room(), 'x')).toBeNull();
  });

  it('keeps only newer room versions (out-of-order realtime events)', () => {
    expect(isNewer(room({ version: 6 }), room())).toBe(true);
    expect(isNewer(room({ version: 4 }), room())).toBe(false);
    expect(isNewer(room({ version: 1, game_number: 2 }), room())).toBe(true);
    expect(isNewer(room({ id: 'r2', version: 1 }), room())).toBe(true);
    expect(isNewer(room(), null)).toBe(true);
  });

  it('uses the server clock offset for timers and disconnects', () => {
    const now = Date.parse('2026-01-01T00:01:00.000Z');
    expect(msUntil('2026-01-01T00:01:10.000Z', 0, now)).toBe(10_000);
    expect(msUntil('2026-01-01T00:01:10.000Z', 4_000, now)).toBe(6_000);
    expect(msUntil(null, 0, now)).toBe(Infinity);
    expect(opponentSilenceSeconds(room(), 0, 0, now)).toBe(10);
    expect(opponentSilenceSeconds(room(), 1, 0, now)).toBe(60);
  });
});

describe('errors', () => {
  it('maps server messages to codes', () => {
    expect(toOnlineError({ message: 'room_full' }).code).toBe('room_full');
    expect(toOnlineError(new Error('TypeError: Network request failed')).code).toBe('network');
    expect(toOnlineError('weird').code).toBe('unknown');
    const e = new OnlineError('too_early');
    expect(toOnlineError(e)).toBe(e);
  });
});

describe('nicknames (client side)', () => {
  it.each([
    ['Noa', true],
    ['Michelle', true],
    ['שירה', true],
    ['Sh1t', false],
    ['  ', false],
    ['abcdefghijklmno', false],
  ])('%j → %s', (name, ok) => {
    expect(checkNickname(name).ok).toBe(ok);
  });
});
