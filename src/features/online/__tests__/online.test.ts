/** @jest-environment node */
import { OnlineError, toOnlineError } from '../errors';
import { checkNickname } from '../nickname';
import {
  SERVER_TIME_MARGIN_MS,
  isNewer,
  msUntil,
  msUntilServerPassed,
  opponentSilenceSeconds,
  seatOf,
  type RoomRow,
} from '../room';
import {
  androidOpenInAppLink,
  appRoomLink,
  codeFromText,
  inviteLink,
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
    expect(codeFromText('Tap: https://someone.github.io/memory-match-game/join/?c=xkcd42')).toBe(
      'XKCD42',
    );
    // The current invite text: the link wins over other 6-letter words.
    expect(
      codeFromText(
        "Let's play Memory Match! 🃏 Tap to play with me right in your browser — no download needed: https://menachemil90-a11y.github.io/memory-match-game/join/?c=ABC234 (Room code: ABC234)",
      ),
    ).toBe('ABC234');
    // Without a link: words like "Memory" (contains O) are skipped, the code is found.
    expect(codeFromText('Memory Match, Room code: hjkm23')).toBe('HJKM23');
  });

  it('invites open the web game straight in the room (the old link format still works)', () => {
    expect(inviteLink('XKCD42')).toBe(
      'https://menachemil90-a11y.github.io/memory-match-game/join/?c=XKCD42',
    );
    expect(codeFromText(inviteLink('XKCD42'))).toBe('XKCD42');
    expect(appRoomLink('memorymatch', 'XKCD42')).toBe('memorymatch://online/XKCD42');
  });

  it('"Open in app" on Android uses an intent that falls back to the web game', () => {
    const link = androidOpenInAppLink(
      'memorymatch',
      'com.example.app',
      'XKCD42',
      'https://x.github.io/g/join/?c=XKCD42',
    );
    expect(link).toBe(
      'intent://online/XKCD42#Intent;scheme=memorymatch;package=com.example.app;' +
        'S.browser_fallback_url=https%3A%2F%2Fx.github.io%2Fg%2Fjoin%2F%3Fc%3DXKCD42;end',
    );
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

describe('server deadlines', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');

  it('waits until the server clock has surely passed a deadline (clock-sync error included)', () => {
    const deadline = '2026-01-01T00:00:01.000Z'; // 1 s from now (server time = device time)
    expect(msUntilServerPassed(deadline, 0, 0, now)).toBe(1000 + SERVER_TIME_MARGIN_MS);
    // The offset estimate may be off by up to 120 ms: wait that much longer.
    expect(msUntilServerPassed(deadline, 0, 120, now)).toBe(1120 + SERVER_TIME_MARGIN_MS);
    // Server clock 300 ms ahead of the device.
    expect(msUntilServerPassed(deadline, 300, 0, now)).toBe(700 + SERVER_TIME_MARGIN_MS);
  });

  it('never negative; no deadline means no wait', () => {
    expect(msUntilServerPassed('2025-12-31T23:59:00.000Z', 0, 100, now)).toBe(0);
    expect(msUntilServerPassed(null, 0, 100, now)).toBe(0);
  });
});
