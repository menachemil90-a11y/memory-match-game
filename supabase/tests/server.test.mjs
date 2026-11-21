import { after, before, describe, it } from 'node:test';

import {
  GUEST,
  HOST,
  STRANGER,
  VERSION,
  engine,
  errorOf,
  expect,
  secureRng,
  startTestServer,
} from './harness.mjs';

const { createGame, gameReducer, getLevel } = engine;

let server;
before(async () => {
  server = await startTestServer();
});
after(() => server.close());

async function newGame(levelId = 'tiny', board = 'animals') {
  const created = await server.rpc(HOST, 'public.create_room', {
    p_board_id: board,
    p_level_id: levelId,
    p_name: 'Noa',
    p_avatar: 'fox',
    p_app_version: VERSION,
  });
  return server.rpc(GUEST, 'public.join_room', {
    p_code: created.code.toLowerCase(),
    p_name: 'Avi',
    p_avatar: 'panda',
    p_app_version: VERSION,
  });
}

async function deck(roomId) {
  const rows = await server.admin('select layout from private.room_decks where room_id = $1', [
    roomId,
  ]);
  return rows[0].layout;
}

const uidFor = (seat) => (seat === 0 ? HOST : GUEST);
const pastResolve = (id) =>
  server.admin("update public.rooms set resolve_at = now() - interval '1 second' where id = $1", [
    id,
  ]);
const pastDeadline = (id) =>
  server.admin(
    "update public.rooms set turn_deadline = now() - interval '1 second' where id = $1",
    [id],
  );

describe('rooms', () => {
  it('creates a room with a 6-character code without O/0/I/1', async () => {
    const room = await server.rpc(HOST, 'public.create_room', {
      p_board_id: 'space',
      p_level_id: 'easy',
      p_name: '  Noa  ',
      p_avatar: 'not-an-avatar',
      p_app_version: VERSION,
    });
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(room.status).toBe('waiting');
    expect(room.players).toEqual([
      { name: 'Noa', avatar: 'fox', uid: HOST, left: false, rank: null },
    ]);
  });

  it('starts the game when a friend joins, with a random first player', async () => {
    const starters = new Set();
    for (let i = 0; i < 14; i++) {
      const room = await newGame();
      expect(room.status).toBe('playing');
      expect(room.players.map((p) => p.name)).toEqual(['Noa', 'Avi']);
      expect(room.cards).toHaveLength(6);
      expect(room.cards.every((c) => c.s === 'down' && c.i === null)).toBe(true);
      starters.add(room.starting_player);
    }
    expect([...starters].sort()).toEqual([0, 1]);
  });

  it('keeps cards secret: RLS hides rooms from strangers and the deck from everyone', async () => {
    const room = await newGame();
    expect(
      await server.as(STRANGER, 'select id from public.rooms where id = $1', [room.id]),
    ).toEqual([]);
    expect(
      await server.as(GUEST, 'select id from public.rooms where id = $1', [room.id]),
    ).toHaveLength(1);
    expect(await errorOf(server.as(HOST, 'select * from private.room_decks'))).toMatch(
      /permission denied/,
    );
    expect(
      await errorOf(server.as(HOST, `update public.rooms set winner = 0 where id = '${room.id}'`)),
    ).toMatch(/permission denied/);
    expect(await errorOf(server.as(STRANGER, `select public.flip_card('${room.id}', 0)`))).toMatch(
      /not_in_room/,
    );
    expect(await errorOf(server.as(HOST, `select private.deal_layout('animals', 'tiny')`))).toMatch(
      /permission denied/,
    );
  });

  it('rejects a third player and unknown codes; rejoining your own room works', async () => {
    const room = await newGame();
    const join = (uid, code) =>
      server.rpc(uid, 'public.join_room', {
        p_code: code,
        p_name: 'Zed',
        p_avatar: 'owl',
        p_app_version: VERSION,
      });
    expect(await errorOf(join(STRANGER, room.code))).toMatch(/room_full/);
    expect(await errorOf(join(STRANGER, 'ZZZZZZ'))).toMatch(/room_not_found/);
    expect((await join(GUEST, room.code)).id).toBe(room.id);
  });

  it('requires a supported app version', async () => {
    await server.admin(
      `update public.app_config set value = '"1.2.0"' where key = 'min_supported_version'`,
    );
    const attempt = await errorOf(
      server.rpc(HOST, 'public.create_room', {
        p_board_id: 'animals',
        p_level_id: 'tiny',
        p_name: 'Noa',
        p_avatar: 'fox',
        p_app_version: '1.1.9',
      }),
    );
    expect(attempt).toMatch(/update_required/);
    await server.admin(
      `update public.app_config set value = '"0.1.0"' where key = 'min_supported_version'`,
    );
  });

  it('only accepts built-in boards, known levels and clean nicknames', async () => {
    const make = (board, level, name = 'Noa') =>
      errorOf(
        server.rpc(HOST, 'public.create_room', {
          p_board_id: board,
          p_level_id: level,
          p_name: name,
          p_avatar: 'fox',
          p_app_version: VERSION,
        }),
      );
    expect(await make('custom-123', 'tiny')).toMatch(/unknown_board/);
    expect(await make('animals', 'impossible')).toMatch(/unknown_level/);
    expect(await make('animals', 'tiny', 'Sh1t')).toMatch(/nickname_not_allowed/);
    expect(await make('animals', 'tiny', '<script>')).toMatch(/invalid_nickname/);
  });

  it('anonymous (not signed in) callers cannot use the API', async () => {
    expect(await errorOf(server.asAnon(`select public.server_time()`))).toMatch(
      /permission denied/,
    );
    expect(await errorOf(server.asAnon(`select * from public.rooms`))).toMatch(/permission denied/);
    expect(
      (await server.asAnon(`select key from public.app_config order by key`)).map((r) => r.key),
    ).toEqual([
      'disconnect_grace_seconds',
      'max_players',
      'min_supported_version',
      'online_protocol',
      'party_rooms_min_protocol',
      'photo_rooms_min_version',
      'turn_seconds',
    ]);
  });

  it('API roles can only read tables: no write grants despite Supabase default privileges', async () => {
    const grants = await server.admin(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'authenticated')
       order by 1, 2, 3`,
    );
    expect(grants.map((g) => `${g.table_name} ${g.grantee} ${g.privilege_type}`)).toEqual([
      'app_config anon SELECT',
      'app_config authenticated SELECT',
      'room_seats authenticated SELECT',
      'rooms authenticated SELECT',
    ]);
    for (const sql of [
      `insert into public.app_config (key, value) values ('x', '1')`,
      `update public.app_config set value = '"9.9.9"'`,
      `delete from public.app_config`,
      `truncate public.rooms`,
      `insert into public.room_seats (room_id, seat, user_id, name, avatar)
         select id, 5, '${STRANGER}', 'Zed', 'owl' from public.rooms limit 1`,
      `update public.room_seats set has_left = true`,
      `delete from public.room_seats`,
    ]) {
      expect(await errorOf(server.as(HOST, sql))).toMatch(/permission denied/);
    }
  });
});

describe('dealing on the server', () => {
  it('deals valid, never-repeating layouts from the board images', async () => {
    const hashes = new Set();
    for (let i = 0; i < 25; i++) {
      const room = await newGame('easy', 'ocean');
      const layout = await deck(room.id);
      expect(layout).toHaveLength(12);
      const counts = new Map();
      layout.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
      expect([...counts.values()].every((c) => c === 2)).toBe(true);
      expect(layout.every((id) => id.startsWith('ocean/'))).toBe(true);
      hashes.add(layout.join(','));
    }
    expect(hashes.size).toBe(25);
    const history = await server.admin(
      "select count(*)::int as n from private.layout_history where board_id = 'ocean' and level_id = 'easy'",
    );
    expect(history[0].n).toBe(25);
  });

  it('draws unbiased random integers', async () => {
    const rows = await server.admin(
      'select private.random_int(3) as v, count(*)::int as n from generate_series(1, 3000) group by 1 order by 1',
    );
    expect(rows.map((r) => r.v)).toEqual([0, 1, 2]);
    for (const r of rows) expect(r.n).toBeGreaterThanOrEqual(850);
  });
});

describe('turn rules', () => {
  it('enforces turns, reveals only flipped cards and keeps the turn on a match', async () => {
    const room = await newGame();
    const layout = await deck(room.id);
    const me = uidFor(room.current_player);
    const other = uidFor(1 - room.current_player);
    expect(
      await errorOf(server.rpc(other, 'public.flip_card', { p_room_id: room.id, p_index: 0 })),
    ).toMatch(/not_your_turn/);
    const a = 0;
    const b = layout.indexOf(layout[0], 1);
    const one = await server.rpc(me, 'public.flip_card', { p_room_id: room.id, p_index: a });
    expect(one.cards.map((c) => c.i)).toEqual(layout.map((id, i) => (i === a ? id : null)));
    expect(
      await errorOf(server.rpc(me, 'public.flip_card', { p_room_id: room.id, p_index: a })),
    ).toMatch(/invalid_card/);
    const two = await server.rpc(me, 'public.flip_card', { p_room_id: room.id, p_index: b });
    expect(two.phase).toBe('resolving');
    expect(two.pending_result).toBe('match');
    const c = [0, 1, 2, 3, 4, 5].find((i) => i !== a && i !== b);
    expect(
      await errorOf(server.rpc(me, 'public.flip_card', { p_room_id: room.id, p_index: c })),
    ).toMatch(/not_now/);
    expect(await errorOf(server.rpc(me, 'public.resolve_turn', { p_room_id: room.id }))).toMatch(
      /too_early/,
    );
    await pastResolve(room.id);
    const done = await server.rpc(other, 'public.resolve_turn', { p_room_id: room.id });
    expect(done.current_player).toBe(room.current_player);
    expect(done.collected[room.current_player]).toEqual([layout[0]]);
    expect(done.cards[a]).toEqual({ s: 'matched', i: layout[0], m: room.current_player });
    // The other phone resolving too is a harmless no-op.
    expect((await server.rpc(me, 'public.resolve_turn', { p_room_id: room.id })).version).toBe(
      done.version,
    );
  });

  it('lets the player who missed skip the mismatch delay; nobody else', async () => {
    const room = await newGame('easy');
    const layout = await deck(room.id);
    const me = uidFor(room.current_player);
    const other = uidFor(1 - room.current_player);
    const b = layout.findIndex((id) => id !== layout[0]);
    await server.rpc(me, 'public.flip_card', { p_room_id: room.id, p_index: 0 });
    await server.rpc(me, 'public.flip_card', { p_room_id: room.id, p_index: b });
    expect(
      await errorOf(server.rpc(other, 'public.resolve_turn', { p_room_id: room.id, p_skip: true })),
    ).toMatch(/too_early/);
    const after = await server.rpc(me, 'public.resolve_turn', { p_room_id: room.id, p_skip: true });
    expect(after.current_player).toBe(1 - room.current_player);
    expect(after.cards[0]).toEqual({ s: 'down', i: null, m: null });
  });

  it('passes the turn on timeout, judged by the server clock only', async () => {
    const room = await newGame();
    const me = uidFor(room.current_player);
    await server.rpc(me, 'public.flip_card', { p_room_id: room.id, p_index: 0 });
    expect(
      await errorOf(server.rpc(GUEST, 'public.claim_timeout', { p_room_id: room.id })),
    ).toMatch(/not_expired/);
    await pastDeadline(room.id);
    const after = await server.rpc(GUEST, 'public.claim_timeout', { p_room_id: room.id });
    expect(after.current_player).toBe(1 - room.current_player);
    expect(after.cards[0]).toEqual({ s: 'down', i: null, m: null });
    expect(after.flipped).toEqual([]);
  });
});

describe('server rules = TypeScript engine (parity)', () => {
  const engineCards = (g) =>
    g.cards.map((c) => ({
      s: c.status,
      i: c.status === 'down' ? null : c.imageId,
      m: c.matchedBy,
    }));

  function expectSame(g, r) {
    expect(r.cards).toEqual(engineCards(g));
    expect(r.current_player).toBe(g.currentPlayer);
    expect(r.phase).toBe(g.phase);
    expect(r.pending_result).toBe(g.pendingResult);
    expect(r.flipped).toEqual(g.flipped);
    expect(r.pairs_found).toBe(g.pairsFound);
    expect(r.collected).toEqual(g.players.map((p) => p.collected));
    expect(r.moves).toEqual(g.players.map((p) => p.moves));
    if (g.phase === 'finished') expect(r.status).toBe('finished');
  }

  for (const levelId of ['tiny', 'easy', 'medium']) {
    it(`random games on ${levelId} end in identical states`, async () => {
      const rng = secureRng();
      for (let game = 0; game < 3; game++) {
        const room = await newGame(levelId);
        const layout = await deck(room.id);
        let g = createGame({
          levelId,
          layout,
          players: [
            { id: 'h', name: 'Noa' },
            { id: 'g', name: 'Avi' },
          ],
          startingPlayer: room.starting_player,
        });
        let r = room;
        const n = getLevel(levelId).pairs * 2;
        // Random play first; after RANDOM_STEPS the game is played out with valid,
        // matching moves so it always finishes (a random walk alone sometimes ran past
        // the step limit on bigger boards and failed the build with 'resolving').
        const RANDOM_STEPS = 400;
        for (let step = 0; step < RANDOM_STEPS + 4 * n && g.phase !== 'finished'; step++) {
          const forced = step >= RANDOM_STEPS;
          const roll = forced ? -1 : rng.nextInt(100);
          let action;
          let call;
          if (forced) {
            if (g.phase === 'resolving') {
              action = { type: 'resolve' };
              await pastResolve(room.id);
              call = () =>
                server.rpc(uidFor(g.currentPlayer), 'public.resolve_turn', { p_room_id: room.id });
            } else {
              const down = g.cards.filter((c) => c.status === 'down');
              const first = g.phase === 'awaitingSecond' ? g.cards[g.flipped[0]] : null;
              const target = first ? down.find((c) => c.imageId === first.imageId) : down[0];
              const index = target.index;
              const player = g.currentPlayer;
              action = { type: 'flip', index, player };
              call = () =>
                server.rpc(uidFor(player), 'public.flip_card', {
                  p_room_id: room.id,
                  p_index: index,
                });
            }
          } else if (g.phase === 'resolving' && roll < 70) {
            action = { type: 'resolve' };
            await pastResolve(room.id);
            call = () =>
              server.rpc(uidFor(rng.nextInt(2)), 'public.resolve_turn', { p_room_id: room.id });
          } else if (roll < 6) {
            action = { type: 'timeout' };
            await pastDeadline(room.id);
            call = () =>
              server.rpc(uidFor(rng.nextInt(2)), 'public.claim_timeout', { p_room_id: room.id });
          } else {
            // Mostly the right player and a face-down card; sometimes not, to test rejections.
            const player = roll < 90 ? g.currentPlayer : 1 - g.currentPlayer;
            const down = g.cards.filter((c) => c.status === 'down').map((c) => c.index);
            const index =
              roll % 7 === 0
                ? rng.nextInt(n + 2) - 1
                : (down[rng.nextInt(Math.max(1, down.length))] ?? 0);
            action = { type: 'flip', index, player };
            call = () =>
              server.rpc(uidFor(player), 'public.flip_card', {
                p_room_id: room.id,
                p_index: index,
              });
          }
          const next = gameReducer(g, action);
          const result = await errorOf(call().then((row) => (r = row)));
          if (next === g && action.type === 'flip') {
            expect(result).not.toBe('ok'); // engine says "not allowed" ⇔ server rejects
          } else {
            expect(result).toBe('ok');
          }
          g = next;
          expectSame(g, r);
        }
        expect(g.phase).toBe('finished');
        const scores = g.players.map((p) => p.collected.length);
        const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
        expect(r.winner).toBe(winner);
        expect(r.end_reason).toBe('complete');
      }
    });
  }
});

describe('end of game, rematch and disconnects', () => {
  it('rematch needs both players, deals a new layout and alternates the starter', async () => {
    const room = await newGame();
    await server.admin(
      "update public.rooms set status = 'finished', phase = 'finished' where id = $1",
      [room.id],
    );
    const before = await deck(room.id);
    const once = await server.rpc(HOST, 'public.request_rematch', { p_room_id: room.id });
    expect(once.rematch).toEqual([0]);
    expect(once.status).toBe('finished');
    const twice = await server.rpc(GUEST, 'public.request_rematch', { p_room_id: room.id });
    expect(twice.status).toBe('playing');
    expect(twice.game_number).toBe(room.game_number + 1);
    expect(twice.starting_player).toBe(1 - room.starting_player);
    expect(await deck(room.id)).not.toEqual(before);
  });

  it('awards the win after the 60 s grace period without heartbeats', async () => {
    const room = await newGame();
    await server.rpc(GUEST, 'public.heartbeat', { p_room_id: room.id });
    expect(
      await errorOf(server.rpc(HOST, 'public.claim_disconnect_win', { p_room_id: room.id })),
    ).toMatch(/opponent_still_connected/);
    // Silence is judged by the seat's last heartbeat (room_seats.seen_at).
    await server.admin(
      "update public.room_seats set seen_at = now() - interval '61 seconds' where room_id = $1 and seat = 1",
      [room.id],
    );
    const won = await server.rpc(HOST, 'public.claim_disconnect_win', { p_room_id: room.id });
    expect(won).toMatchObject({ status: 'finished', winner: 0, end_reason: 'disconnect' });
  });

  it('leaving forfeits a running game and closes a waiting room', async () => {
    const room = await newGame();
    const left = await server.rpc(GUEST, 'public.leave_room', { p_room_id: room.id });
    expect(left).toMatchObject({ status: 'finished', winner: 0, end_reason: 'forfeit' });
    const waiting = await server.rpc(HOST, 'public.create_room', {
      p_board_id: 'food',
      p_level_id: 'tiny',
      p_name: 'Noa',
      p_avatar: 'fox',
      p_app_version: VERSION,
    });
    expect((await server.rpc(HOST, 'public.leave_room', { p_room_id: waiting.id })).status).toBe(
      'closed',
    );
  });

  it('cleans up stale rooms and their secret decks', async () => {
    const room = await newGame();
    await server.admin(
      "update public.rooms set updated_at = now() - interval '4 hours' where id = $1",
      [room.id],
    );
    const removed = await server.admin('select private.cleanup_stale_rooms() as n');
    expect(removed[0].n).toBeGreaterThanOrEqual(1);
    expect(
      await server.admin('select 1 from private.room_decks where room_id = $1', [room.id]),
    ).toEqual([]);
  });
});

describe('data minimisation', () => {
  it('anonymous-user cleanup is a safe no-op where Supabase Auth is absent', async () => {
    const rows = await server.admin('select private.cleanup_anonymous_users() as n');
    expect(rows[0].n).toBe(0);
  });
});
