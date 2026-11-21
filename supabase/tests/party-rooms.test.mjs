// Online games for 2–8 players (migration 07): seats, the lobby, Start, leaving
// and disconnects mid-game, ranking, rematch for the group, photo access for
// every player, and the gate that keeps older apps out of rooms they can't show.
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  HOST,
  PHOTO_VERSION,
  STRANGER,
  VERSION,
  engine,
  errorOf,
  expect,
  secureRng,
  startTestServer,
} from './harness.mjs';

const { LEVELS, MAX_PLAYERS, createGame, gameReducer, getRanking, maxPlayersForLevel } = engine;

/** Eight players: seat order = join order (HOST first). */
const UIDS = [
  HOST,
  ...Array.from({ length: 7 }, (_, i) => `a0000000-0000-4000-8000-00000000000${i}`),
];
const NAMES = ['Noa', 'Avi', 'Dana', 'Eli', 'Mia', 'Tom', 'Yael', 'Gil'];
/** What the new app sends. */
const PROTOCOL = 2;

let server;
before(async () => {
  server = await startTestServer();
});
after(() => server.close());
beforeEach(async () => {
  await server.admin('delete from storage.objects');
  await server.admin('delete from public.rooms');
});

const create = (level = 'hard', protocol = PROTOCOL, board = 'animals') =>
  server.rpc(HOST, 'public.create_room', {
    p_board_id: board,
    p_level_id: level,
    p_name: 'Noa',
    p_avatar: 'fox',
    p_app_version: VERSION,
    ...(protocol === null ? {} : { p_protocol: protocol }),
  });
const join = (code, seat, protocol = PROTOCOL, version = VERSION) =>
  server.rpc(UIDS[seat], 'public.join_room', {
    p_code: code,
    p_name: NAMES[seat],
    p_avatar: 'owl',
    p_app_version: version,
    ...(protocol === null ? {} : { p_protocol: protocol }),
  });
const rpc = (seat, fn, args) => server.rpc(UIDS[seat], `public.${fn}`, args);
const deck = async (roomId) =>
  (await server.admin('select layout from private.room_decks where room_id = $1', [roomId]))[0]
    .layout;
const pastResolve = (id) =>
  server.admin("update public.rooms set resolve_at = now() - interval '1 second' where id = $1", [
    id,
  ]);
const pastDeadline = (id) =>
  server.admin(
    "update public.rooms set turn_deadline = now() - interval '1 second' where id = $1",
    [id],
  );
const silent = (id, seat) =>
  server.admin(
    "update public.room_seats set seen_at = now() - interval '61 seconds' where room_id = $1 and seat = $2",
    [id, seat],
  );
/** Seat a player sits in, as the server says (by their own user id). */
const seatOf = (room, uid) => room.players.findIndex((p) => p.uid === uid);

/** A started room with `n` players (seats 0..n-1 = UIDS[0..n-1]). */
async function partyGame(n, level = 'hard') {
  const room = await create(level);
  for (let s = 1; s < n; s++) await join(room.code, s);
  return rpc(0, 'start_room', { p_room_id: room.id });
}

/** The current player misses: two different face-down cards. */
async function miss(room) {
  const layout = await deck(room.id);
  const down = room.cards.flatMap((c, i) => (c.s === 'down' ? [i] : []));
  const a = down[0];
  const b = down.find((i) => layout[i] !== layout[a]);
  const me = room.current_player;
  await rpc(me, 'flip_card', { p_room_id: room.id, p_index: a });
  await rpc(me, 'flip_card', { p_room_id: room.id, p_index: b });
  return rpc(me, 'resolve_turn', { p_room_id: room.id, p_skip: true });
}

/** The current player takes a pair. */
async function take(room) {
  const layout = await deck(room.id);
  const down = room.cards.flatMap((c, i) => (c.s === 'down' ? [i] : []));
  const a = down[0];
  const b = down.find((i) => i !== a && layout[i] === layout[a]);
  const me = room.current_player;
  await rpc(me, 'flip_card', { p_room_id: room.id, p_index: a });
  await rpc(me, 'flip_card', { p_room_id: room.id, p_index: b });
  await pastResolve(room.id);
  return rpc(me, 'resolve_turn', { p_room_id: room.id });
}

describe('shared rules', () => {
  it('uses the same maximum and minimum boards as the app', async () => {
    const [config] = await server.admin(
      "select value::int as max from public.app_config where key = 'max_players'",
    );
    expect(config.max).toBe(MAX_PLAYERS);
    for (const level of LEVELS) {
      const [row] = await server.admin('select private.max_players_for_level($1) as n', [level.id]);
      expect({ level: level.id, n: row.n }).toEqual({
        level: level.id,
        n: maxPlayersForLevel(level.id),
      });
    }
  });

  it('tells apps it speaks protocol 2', async () => {
    const rows = await server.asAnon(
      "select key, value from public.app_config where key in ('online_protocol', 'party_rooms_min_protocol') order by key",
    );
    expect(rows).toEqual([
      { key: 'online_protocol', value: 2 },
      { key: 'party_rooms_min_protocol', value: 2 },
    ]);
  });
});

describe('the lobby', () => {
  it('takes as many players as the level allows; everyone appears as they join', async () => {
    const room = await create('hard');
    expect(room).toMatchObject({ status: 'waiting', max_players: 8 });
    let latest = room;
    for (let s = 1; s < 8; s++) {
      latest = await join(room.code.toLowerCase(), s);
      expect(latest.status).toBe('waiting');
      expect(latest.players.map((p) => p.name)).toEqual(NAMES.slice(0, s + 1));
    }
    expect(latest.players.map((p) => p.uid)).toEqual(UIDS);
    expect(
      await errorOf(
        server.rpc(STRANGER, 'public.join_room', {
          p_code: room.code,
          p_name: 'Zed',
          p_avatar: 'owl',
          p_app_version: VERSION,
          p_protocol: 2,
        }),
      ),
    ).toMatch(/room_full/);
    expect((await create('medium')).max_players).toBe(4);
    expect((await create('tricky')).max_players).toBe(4);
    expect((await create('easy')).max_players).toBe(2);
  });

  it('every seated player can read the room; strangers cannot', async () => {
    const room = await create('medium');
    await join(room.code, 1);
    await join(room.code, 2);
    for (const s of [0, 1, 2]) {
      expect(
        await server.as(UIDS[s], 'select id from public.rooms where id = $1', [room.id]),
      ).toHaveLength(1);
    }
    expect(
      await server.as(STRANGER, 'select id from public.rooms where id = $1', [room.id]),
    ).toEqual([]);
    // Seats: each player sees only their own row (the room shows everyone's public info).
    expect(await server.as(UIDS[1], 'select seat from public.room_seats')).toEqual([{ seat: 1 }]);
  });

  it('only the host starts, with at least two players; who starts is random', async () => {
    const lonely = await create('medium');
    expect(await errorOf(rpc(0, 'start_room', { p_room_id: lonely.id }))).toMatch(
      /not_enough_players/,
    );
    const starters = new Set();
    for (let i = 0; i < 24; i++) {
      const room = await create('medium');
      await join(room.code, 1);
      await join(room.code, 2);
      if (i === 0) {
        expect(await errorOf(rpc(1, 'start_room', { p_room_id: room.id }))).toMatch(/not_host/);
      }
      const started = await rpc(0, 'start_room', { p_room_id: room.id });
      expect(started).toMatchObject({ status: 'playing', game_number: 1 });
      expect(started.collected).toEqual([[], [], []]);
      expect(started.moves).toEqual([0, 0, 0]);
      starters.add(started.starting_player);
    }
    expect([...starters].sort()).toEqual([0, 1, 2]);
  });

  it('joining after the start says the game already started', async () => {
    const room = await partyGame(3);
    expect(await errorOf(join(room.code, 3))).toMatch(/game_started/);
    // A seated player re-opening the link just gets the room back.
    expect((await join(room.code, 2)).id).toBe(room.id);
  });

  it('a player leaving the lobby frees their seat; the host leaving closes it', async () => {
    const room = await create('medium');
    await join(room.code, 1);
    await join(room.code, 2);
    const after = await rpc(1, 'leave_room', { p_room_id: room.id });
    expect(after.players.map((p) => p.name)).toEqual(['Noa', 'Dana']);
    expect(seatOf(after, UIDS[2])).toBe(1);
    expect(after.guest_id).toBe(UIDS[2]);
    // Dana now sits on seat 1 and can act as seat 1.
    expect(await errorOf(rpc(2, 'heartbeat', { p_room_id: room.id }))).toBe('ok');
    // The one who left can join again.
    expect((await join(room.code, 1)).players.map((p) => p.name)).toEqual(['Noa', 'Dana', 'Avi']);
    expect((await rpc(0, 'leave_room', { p_room_id: room.id })).status).toBe('closed');
  });
});

describe('two-player rooms (as before)', () => {
  it('small levels start as soon as the friend joins, for new and old apps alike', async () => {
    const fresh = await create('tiny');
    expect(fresh.max_players).toBe(2);
    expect((await join(fresh.code, 1)).status).toBe('playing');
    const old = await create('hard', null); // an app ≤ 0.4: two seats, whatever the level
    expect(old.max_players).toBe(2);
    expect((await join(old.code, 1, null)).status).toBe('playing');
    expect(await errorOf(join(old.code, 2, null))).toMatch(/room_full/);
    expect(await errorOf(join(old.code, 2))).toMatch(/game_started/);
  });

  it('older apps are asked to update instead of joining a room for more players', async () => {
    const room = await create('hard');
    expect(await errorOf(join(room.code, 1, null))).toMatch(/update_required/);
    expect(await errorOf(join(room.code, 1, 1))).toMatch(/update_required/);
    expect((await join(room.code, 1, 2)).players).toHaveLength(2);
  });

  it('writes the legacy heartbeat columns only for two-seat rooms', async () => {
    const duo = await create('tiny');
    await join(duo.code, 1);
    await server.admin("update public.rooms set guest_seen_at = now() - interval '1 hour'");
    await rpc(1, 'heartbeat', { p_room_id: duo.id });
    const [row] = await server.admin(
      "select guest_seen_at > now() - interval '1 minute' as fresh from public.rooms where id = $1",
      [duo.id],
    );
    expect(row.fresh).toBe(true);
    const party = await partyGame(3);
    const before = (
      await server.admin('select version, updated_at from public.rooms where id = $1', [party.id])
    )[0];
    await rpc(2, 'heartbeat', { p_room_id: party.id });
    const afterBeat = (
      await server.admin('select version, updated_at from public.rooms where id = $1', [party.id])
    )[0];
    expect(afterBeat).toEqual(before);
  });
});

describe('turns with many players', () => {
  it('a miss passes the turn round the table; a timeout too', async () => {
    let room = await partyGame(4);
    const order = [room.current_player];
    for (let i = 0; i < 4; i++) {
      room = await miss(room);
      order.push(room.current_player);
    }
    const s = order[0];
    expect(order).toEqual([s, (s + 1) % 4, (s + 2) % 4, (s + 3) % 4, s]);
    room = await take(room);
    expect(room.current_player).toBe(s);
    expect(room.collected[s]).toHaveLength(1);
    await pastDeadline(room.id);
    room = await rpc((s + 2) % 4, 'claim_timeout', { p_room_id: room.id });
    expect(room.current_player).toBe((s + 1) % 4);
  });

  it('a player who leaves mid-game is skipped; the others play on', async () => {
    let room = await partyGame(4);
    const s = room.current_player;
    const next = (s + 1) % 4;
    room = await rpc(next, 'leave_room', { p_room_id: room.id });
    expect(room.status).toBe('playing');
    expect(room.players[next].left).toBe(true);
    room = await miss(room);
    expect(room.current_player).toBe((s + 2) % 4);
    // They can't act any more.
    expect(await errorOf(rpc(next, 'flip_card', { p_room_id: room.id, p_index: 0 }))).toMatch(
      /not_in_room/,
    );
  });

  it('when the current player leaves, their open cards flip back and the turn passes', async () => {
    let room = await partyGame(3, 'medium');
    const s = room.current_player;
    await rpc(s, 'flip_card', { p_room_id: room.id, p_index: 0 });
    room = await rpc(s, 'leave_room', { p_room_id: room.id });
    expect(room.cards[0]).toEqual({ s: 'down', i: null, m: null });
    expect(room).toMatchObject({
      phase: 'awaitingFirst',
      flipped: [],
      current_player: (s + 1) % 3,
    });
  });

  it('any player may take out someone silent for over a minute; not before', async () => {
    let room = await partyGame(3, 'medium');
    const s = room.current_player;
    const quiet = (s + 1) % 3;
    const watcher = (s + 2) % 3;
    await rpc(quiet, 'heartbeat', { p_room_id: room.id });
    expect(
      await errorOf(rpc(watcher, 'claim_disconnect', { p_room_id: room.id, p_seat: quiet })),
    ).toMatch(/player_still_connected/);
    expect(
      await errorOf(rpc(watcher, 'claim_disconnect', { p_room_id: room.id, p_seat: watcher })),
    ).toMatch(/not_now/);
    await silent(room.id, quiet);
    room = await rpc(watcher, 'claim_disconnect', { p_room_id: room.id, p_seat: quiet });
    expect(room.players[quiet].left).toBe(true);
    expect(room.status).toBe('playing');
    // Claiming again is a harmless no-op.
    expect((await rpc(s, 'claim_disconnect', { p_room_id: room.id, p_seat: quiet })).version).toBe(
      room.version,
    );
  });

  it('with one player left the game ends and everyone is ranked', async () => {
    let room = await partyGame(4);
    const s = room.current_player;
    room = await take(room);
    room = await take(room); // s: 2 pairs
    room = await miss(room);
    room = await take(room); // s+1: 1 pair
    room = await rpc((s + 2) % 4, 'leave_room', { p_room_id: room.id });
    await silent(room.id, (s + 3) % 4);
    room = await rpc(s, 'claim_disconnect', { p_room_id: room.id, p_seat: (s + 3) % 4 });
    expect(room.status).toBe('playing');
    room = await rpc(s, 'leave_room', { p_room_id: room.id });
    expect(room).toMatchObject({ status: 'finished', phase: 'finished', winner: (s + 1) % 4 });
    expect(room.end_reason).toBe('forfeit');
    const ranks = room.players.map((p) => p.rank);
    expect(ranks[(s + 1) % 4]).toBe(1); // stayed to the end
    expect(ranks[s]).toBe(2); // left with 2 pairs
    expect([ranks[(s + 2) % 4], ranks[(s + 3) % 4]]).toEqual([3, 3]); // left with none
  });
});

describe('server rules = TypeScript engine with many players (parity)', () => {
  const engineCards = (g) =>
    g.cards.map((c) => ({
      s: c.status,
      i: c.status === 'down' ? null : c.imageId,
      m: c.matchedBy,
    }));

  for (const [n, levelId] of [
    [3, 'medium'],
    [4, 'tricky'],
    [6, 'hard'],
    [8, 'hard'],
  ]) {
    it(`random ${n}-player games on ${levelId} (with leaving and disconnects) end identically`, async () => {
      const rng = secureRng();
      for (let game = 0; game < 2; game++) {
        let r = await partyGame(n, levelId);
        const layout = await deck(r.id);
        let g = createGame({
          levelId,
          layout,
          players: NAMES.slice(0, n).map((name, i) => ({ id: `p${i}`, name })),
          startingPlayer: r.starting_player,
        });
        const present = () => g.players.flatMap((p, i) => (p.left ? [] : [i]));
        const total = layout.length;
        for (let step = 0; step < 900 && g.phase !== 'finished'; step++) {
          const forced = step >= 500;
          const roll = forced ? 99 : rng.nextInt(100);
          let action;
          let call;
          if (g.phase === 'resolving' && (forced || roll < 70)) {
            action = { type: 'resolve' };
            await pastResolve(r.id);
            const caller = present()[rng.nextInt(present().length)];
            call = () => rpc(caller, 'resolve_turn', { p_room_id: r.id });
          } else if (!forced && roll < 4) {
            action = { type: 'timeout' };
            await pastDeadline(r.id);
            const caller = present()[rng.nextInt(present().length)];
            call = () => rpc(caller, 'claim_timeout', { p_room_id: r.id });
          } else if (!forced && roll < 6 && present().length > 1) {
            const who = present()[rng.nextInt(present().length)];
            action = { type: 'leave', player: who };
            if (rng.nextInt(2) === 0) {
              call = () => rpc(who, 'leave_room', { p_room_id: r.id });
            } else {
              await silent(r.id, who);
              const claimer = present().find((p) => p !== who);
              call = () => rpc(claimer, 'claim_disconnect', { p_room_id: r.id, p_seat: who });
            }
          } else if (g.phase !== 'resolving') {
            const down = g.cards.filter((c) => c.status === 'down');
            const first = g.phase === 'awaitingSecond' ? g.cards[g.flipped[0]] : null;
            const target =
              forced && first
                ? down.find((c) => c.imageId === first.imageId)
                : forced
                  ? down[0]
                  : down[rng.nextInt(down.length)];
            const player = g.currentPlayer;
            action = { type: 'flip', index: target.index, player };
            call = () => rpc(player, 'flip_card', { p_room_id: r.id, p_index: target.index });
          } else {
            continue;
          }
          const next = gameReducer(g, action);
          expect(await errorOf(call().then((row) => (r = row)))).toBe('ok');
          g = next;
          expect(r.cards).toEqual(engineCards(g));
          expect(r.phase).toBe(g.phase);
          expect(r.flipped).toEqual(g.flipped);
          expect(r.pending_result).toBe(g.pendingResult);
          expect(r.collected).toEqual(g.players.map((p) => p.collected));
          expect(r.moves).toEqual(g.players.map((p) => p.moves));
          expect(r.players.map((p) => p.left)).toEqual(g.players.map((p) => p.left));
          if (g.phase !== 'finished') expect(r.current_player).toBe(g.currentPlayer);
        }
        expect(g.phase).toBe('finished');
        expect(r.status).toBe('finished');
        const ranks = Array(n).fill(null);
        for (const s of getRanking(g)) ranks[s.player] = s.rank;
        expect(r.players.map((p) => p.rank)).toEqual(ranks);
        expect(r.end_reason).toBe(g.endReason === 'complete' ? 'complete' : r.end_reason);
        expect(total).toBe(getLevelPairs(levelId) * 2);
      }
    });
  }

  function getLevelPairs(id) {
    return LEVELS.find((l) => l.id === id).pairs;
  }
});

describe('rematch for the group', () => {
  it('starts once everyone still here asks; departed players are gone; the next player starts', async () => {
    let room = await partyGame(4);
    const first = room.starting_player;
    await server.admin(
      "update public.rooms set status = 'finished', phase = 'finished' where id = $1",
      [room.id],
    );
    // One player goes back to the menu: the other three can still rematch.
    const gone = (first + 2) % 4;
    room = await rpc(gone, 'leave_room', { p_room_id: room.id });
    expect(room.status).toBe('finished');
    const stay = [0, 1, 2, 3].filter((s) => s !== gone);
    room = await rpc(stay[0], 'request_rematch', { p_room_id: room.id });
    room = await rpc(stay[1], 'request_rematch', { p_room_id: room.id });
    expect(room.status).toBe('finished');
    expect(room.rematch).toEqual(stay.slice(0, 2));
    room = await rpc(stay[2], 'request_rematch', { p_room_id: room.id });
    expect(room).toMatchObject({ status: 'playing', game_number: 2 });
    expect(room.players.map((p) => p.uid)).toEqual(stay.map((s) => UIDS[s]));
    expect(room.collected).toEqual([[], [], []]);
    // The player after the last starter (skipping the one who left) starts.
    const nextOld = (first + 1) % 4 === gone ? (first + 2) % 4 : (first + 1) % 4;
    expect(room.players[room.starting_player].uid).toBe(UIDS[nextOld]);
    // The player who left no longer sees the room.
    expect(
      await server.as(UIDS[gone], 'select id from public.rooms where id = $1', [room.id]),
    ).toEqual([]);
  });

  it('the room closes when fewer than two remain after the game', async () => {
    let room = await partyGame(3, 'medium');
    await server.admin(
      "update public.rooms set status = 'finished', phase = 'finished' where id = $1",
      [room.id],
    );
    room = await rpc(0, 'leave_room', { p_room_id: room.id });
    expect(room.status).toBe('finished');
    room = await rpc(1, 'leave_room', { p_room_id: room.id });
    expect(room.status).toBe('closed');
  });
});

describe('photo rooms for a group', () => {
  const BUCKET = 'room-photos';
  const visible = async (uid, roomId) =>
    (
      await server.as(
        uid,
        'select name from storage.objects where bucket_id = $1 and name like $2',
        [BUCKET, `${roomId}/%`],
      )
    ).length;

  async function photoParty(n) {
    const room = await server.rpc(HOST, 'public.create_photo_room', {
      p_level_id: 'hard',
      p_card_back: 'grape',
      p_name: 'Noa',
      p_avatar: 'fox',
      p_app_version: PHOTO_VERSION,
      p_protocol: PROTOCOL,
    });
    expect(room).toMatchObject({ status: 'preparing', max_players: 8 });
    for (const id of room.photo_ids) {
      await server.as(
        HOST,
        'insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)',
        [BUCKET, `${room.id}/${id}.jpg`, HOST],
      );
    }
    await server.rpc(HOST, 'public.photo_room_ready', { p_room_id: room.id });
    for (let s = 1; s < n; s++) await join(room.code, s, PROTOCOL, PHOTO_VERSION);
    return rpc(0, 'start_room', { p_room_id: room.id });
  }

  it('every player in the room sees the cards; strangers and players who left do not', async () => {
    const room = await photoParty(5);
    for (let s = 0; s < 5; s++) expect(await visible(UIDS[s], room.id)).toBe(12);
    expect(await visible(STRANGER, room.id)).toBe(0);
    await rpc(3, 'leave_room', { p_room_id: room.id });
    expect(await visible(UIDS[3], room.id)).toBe(0);
    expect(await visible(UIDS[4], room.id)).toBe(12);
  });

  it('closing the room: only the host keeps access (to delete); cleanup takes every card', async () => {
    const room = await photoParty(3);
    await server.admin("update public.rooms set status = 'closed' where id = $1", [room.id]);
    expect(await visible(UIDS[1], room.id)).toBe(0);
    expect(await visible(UIDS[2], room.id)).toBe(0);
    expect(await visible(HOST, room.id)).toBe(12);
    const due = await server.asRole(
      'service_role',
      'select n from public.expired_room_photos(100) as n',
    );
    expect(due).toHaveLength(12);
  });

  it('older apps cannot join a photo room for more players', async () => {
    const room = await server.rpc(HOST, 'public.create_photo_room', {
      p_level_id: 'hard',
      p_card_back: 'grape',
      p_name: 'Noa',
      p_avatar: 'fox',
      p_app_version: PHOTO_VERSION,
      p_protocol: PROTOCOL,
    });
    for (const id of room.photo_ids) {
      await server.as(
        HOST,
        'insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)',
        [BUCKET, `${room.id}/${id}.jpg`, HOST],
      );
    }
    await server.rpc(HOST, 'public.photo_room_ready', { p_room_id: room.id });
    expect(await errorOf(join(room.code, 1, null, PHOTO_VERSION))).toMatch(/update_required/);
  });
});

describe('applying the migration to a live database', () => {
  it('turns existing two-player rooms into seats; games in progress play on', async () => {
    const SEATS = '20261121000007_multiplayer_seats.sql';
    const old = await startTestServer({ until: SEATS });
    try {
      const created = await old.rpc(HOST, 'public.create_room', {
        p_board_id: 'animals',
        p_level_id: 'tiny',
        p_name: 'Noa',
        p_avatar: 'fox',
        p_app_version: VERSION,
      });
      const playing = await old.rpc(UIDS[1], 'public.join_room', {
        p_code: created.code,
        p_name: 'Avi',
        p_avatar: 'panda',
        p_app_version: VERSION,
      });
      const waiting = await old.rpc(UIDS[2], 'public.create_room', {
        p_board_id: 'space',
        p_level_id: 'easy',
        p_name: 'Dana',
        p_avatar: 'owl',
        p_app_version: VERSION,
      });
      await old.migrate(SEATS);

      const seats = await old.admin(
        'select room_id, seat, user_id, name, avatar from public.room_seats order by room_id, seat',
      );
      expect(seats.filter((s) => s.room_id === playing.id)).toEqual([
        { room_id: playing.id, seat: 0, user_id: HOST, name: 'Noa', avatar: 'fox' },
        { room_id: playing.id, seat: 1, user_id: UIDS[1], name: 'Avi', avatar: 'panda' },
      ]);
      expect(seats.filter((s) => s.room_id === waiting.id)).toHaveLength(1);
      const [row] = await old.admin('select players, max_players from public.rooms where id = $1', [
        playing.id,
      ]);
      expect(row.max_players).toBe(2);
      expect(row.players.map((p) => [p.name, p.uid, p.left])).toEqual([
        ['Noa', HOST, false],
        ['Avi', UIDS[1], false],
      ]);
      // The game in progress goes on: both players still read and play it.
      const me = playing.current_player === 0 ? HOST : UIDS[1];
      const flipped = await old.rpc(me, 'public.flip_card', { p_room_id: playing.id, p_index: 0 });
      expect(flipped.phase).toBe('awaitingSecond');
      // The waiting room still takes its friend (and starts, as before).
      const joined = await old.rpc(UIDS[3], 'public.join_room', {
        p_code: waiting.code,
        p_name: 'Eli',
        p_avatar: 'tiger',
        p_app_version: VERSION,
      });
      expect(joined.status).toBe('playing');
    } finally {
      await old.close();
    }
  });
});
