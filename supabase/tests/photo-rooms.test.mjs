// Online games on the host's own photo board: who may upload, who may see the
// cards, and that they are deleted when the room closes (or after 24 hours).
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  GUEST,
  HOST,
  PHOTO_VERSION,
  STRANGER,
  VERSION,
  errorOf,
  expect,
  startTestServer,
} from './harness.mjs';

let server;
before(async () => {
  server = await startTestServer();
});
after(() => server.close());
beforeEach(async () => {
  await server.admin('delete from storage.objects');
  await server.admin('delete from public.rooms');
});

const BUCKET = 'room-photos';

const createPhotoRoom = (uid = HOST, level = 'tiny', version = PHOTO_VERSION) =>
  server.rpc(uid, 'public.create_photo_room', {
    p_level_id: level,
    p_card_back: 'grape',
    p_name: 'Noa',
    p_avatar: 'fox',
    p_app_version: version,
  });

/** What the Storage API does for an upload: an insert as the caller, through RLS. */
const upload = (uid, name, bucket = BUCKET) =>
  server.as(uid, 'insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)', [
    bucket,
    name,
    uid,
  ]);
/** Signing a URL needs the row to be visible to the caller (select policy). */
const visible = async (uid, roomId) =>
  (
    await server.as(uid, 'select name from storage.objects where bucket_id = $1 and name like $2', [
      BUCKET,
      `${roomId}/%`,
    ])
  ).map((r) => r.name);
const removeAs = async (uid, roomId) =>
  (
    await server.as(
      uid,
      'delete from storage.objects where bucket_id = $1 and name like $2 returning name',
      [BUCKET, `${roomId}/%`],
    )
  ).length;

const uploadAll = async (room) => {
  for (const id of room.photo_ids) await upload(HOST, `${room.id}/${id}.jpg`);
};
const ready = (room, uid = HOST) =>
  server.rpc(uid, 'public.photo_room_ready', { p_room_id: room.id });
const join = (code, uid = GUEST, version = PHOTO_VERSION) =>
  server.rpc(uid, 'public.join_room', {
    p_code: code,
    p_name: 'Avi',
    p_avatar: 'panda',
    p_app_version: version,
  });
const expired = () =>
  server.asRole('service_role', 'select n from public.expired_room_photos(100) as n order by n');

async function openPhotoRoom(level = 'tiny') {
  const room = await createPhotoRoom(HOST, level);
  await uploadAll(room);
  return ready(room);
}

describe('photo rooms: creating', () => {
  it('opens a private bucket for JPEG cards only', async () => {
    const [bucket] = await server.admin('select * from storage.buckets where id = $1', [BUCKET]);
    expect(bucket).toMatchObject({
      public: false,
      allowed_mime_types: ['image/jpeg'],
    });
    expect(Number(bucket.file_size_limit) <= 262144).toBe(true);
  });

  it('starts in "preparing" with one card per pair of the level', async () => {
    const room = await createPhotoRoom(HOST, 'easy');
    expect(room).toMatchObject({ status: 'preparing', board_id: 'photos', card_back: 'grape' });
    expect(room.photo_ids).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });

  it('needs an app that can show photo rooms, and a known level', async () => {
    expect(await errorOf(createPhotoRoom(HOST, 'tiny', VERSION))).toMatch(/update_required/);
    expect(await errorOf(createPhotoRoom(HOST, 'impossible'))).toMatch(/unknown_level/);
  });

  it('ignores a card back that is not a plain id', async () => {
    const room = await server.rpc(HOST, 'public.create_photo_room', {
      p_level_id: 'tiny',
      p_card_back: '../../etc',
      p_name: 'Noa',
      p_avatar: 'fox',
      p_app_version: PHOTO_VERSION,
    });
    expect(room.card_back).toBe(null);
  });

  it('nobody can join while the host is still uploading', async () => {
    const room = await createPhotoRoom();
    expect(await errorOf(join(room.code))).toMatch(/room_not_found/);
  });

  it('opens only when every card is uploaded, and only by the host', async () => {
    const room = await createPhotoRoom();
    await upload(HOST, `${room.id}/p1.jpg`);
    expect(await errorOf(ready(room))).toMatch(/photos_missing/);
    await upload(HOST, `${room.id}/p2.jpg`);
    await upload(HOST, `${room.id}/p3.jpg`);
    expect(await errorOf(ready(room, STRANGER))).toMatch(/not_in_room/);
    const opened = await ready(room);
    expect(opened.status).toBe('waiting');
    expect(await errorOf(ready(room))).toMatch(/not_now/);
  });

  it('one open room per host: a new room closes the one being prepared', async () => {
    const first = await createPhotoRoom();
    await createPhotoRoom();
    const [row] = await server.admin('select status from public.rooms where id = $1', [first.id]);
    expect(row.status).toBe('closed');
  });

  it('limits how many photo rooms a player can open per hour', async () => {
    await server.admin(
      `insert into public.rooms (code, board_id, level_id, host_id, status, photo_ids)
       select 'ABCD' || substr('ABCDEFGHJKLMNPQRSTUVWXYZ', g, 1) || 'A', 'photos', 'tiny', $1, 'closed', '{p1,p2,p3}'
       from generate_series(1, 20) as g`,
      [HOST],
    );
    expect(await errorOf(createPhotoRoom())).toMatch(/too_many_rooms/);
  });
});

describe('photo rooms: who may upload and see the cards', () => {
  it('only the host uploads, only expected names, only while preparing', async () => {
    const room = await createPhotoRoom();
    expect(await errorOf(upload(GUEST, `${room.id}/p1.jpg`))).toMatch(/row-level security/);
    expect(await errorOf(upload(STRANGER, `${room.id}/p1.jpg`))).toMatch(/row-level security/);
    expect(await errorOf(upload(HOST, `${room.id}/p9.jpg`))).toMatch(/row-level security/);
    expect(await errorOf(upload(HOST, `${room.id}/p1.png`))).toMatch(/row-level security/);
    expect(await errorOf(upload(HOST, `${room.id}/x/p1.jpg`))).toMatch(/row-level security/);
    expect(await errorOf(upload(HOST, `${room.id}/p1.jpg`, 'other'))).not.toBe('ok');
    await uploadAll(room);
    await ready(room);
    // The room is open: no more uploads, not even by the host.
    await server.admin('delete from storage.objects where name = $1', [`${room.id}/p1.jpg`]);
    expect(await errorOf(upload(HOST, `${room.id}/p1.jpg`))).toMatch(/row-level security/);
  });

  it('the friend who joins can see the cards; strangers never can', async () => {
    const room = await openPhotoRoom();
    expect(await visible(STRANGER, room.id)).toEqual([]);
    expect(await visible(GUEST, room.id)).toEqual([]); // not joined yet
    const playing = await join(room.code.toLowerCase());
    expect(playing.status).toBe('playing');
    expect((await visible(GUEST, room.id)).sort()).toEqual(
      ['p1', 'p2', 'p3'].map((p) => `${room.id}/${p}.jpg`),
    );
    expect(await visible(HOST, room.id)).toHaveLength(3);
    expect(await visible(STRANGER, room.id)).toEqual([]);
  });

  it('a guest on an older app is asked to update instead of seeing an empty board', async () => {
    const room = await openPhotoRoom();
    expect(await errorOf(join(room.code, GUEST, VERSION))).toMatch(/update_required/);
    expect((await join(room.code)).status).toBe('playing');
  });

  it('deals from the room photos without repeating a layout', async () => {
    const room = await openPhotoRoom('tiny');
    await join(room.code);
    const [{ layout }] = await server.admin(
      'select layout from private.room_decks where room_id = $1',
      [room.id],
    );
    expect([...layout].sort()).toEqual(['p1', 'p1', 'p2', 'p2', 'p3', 'p3']);
    await server.admin(
      "update public.rooms set status = 'finished', phase = 'finished' where id = $1",
      [room.id],
    );
    await server.rpc(HOST, 'public.request_rematch', { p_room_id: room.id });
    const again = await server.rpc(GUEST, 'public.request_rematch', { p_room_id: room.id });
    expect(again.status).toBe('playing');
    const history = await server.admin(
      'select count(distinct hash)::int as n from private.layout_history where board_id = $1',
      [`room:${room.id}`],
    );
    expect(history[0].n).toBe(2);
  });

  it('cards older than 24 hours are never served', async () => {
    const room = await openPhotoRoom();
    await join(room.code);
    await server.admin(
      "update storage.objects set created_at = now() - interval '25 hours' where name like $1",
      [`${room.id}/%`],
    );
    expect(await visible(GUEST, room.id)).toEqual([]);
    expect(await visible(HOST, room.id)).toEqual([]);
  });

  it('the guest loses access when the room closes; the host can still delete', async () => {
    const room = await openPhotoRoom();
    await join(room.code);
    await server.admin("update public.rooms set status = 'finished' where id = $1", [room.id]);
    expect(await visible(GUEST, room.id)).toHaveLength(3); // results screen still shows piles
    await server.rpc(GUEST, 'public.leave_room', { p_room_id: room.id });
    expect(await visible(GUEST, room.id)).toEqual([]);
    expect(await removeAs(GUEST, room.id)).toBe(0);
    expect(await removeAs(STRANGER, room.id)).toBe(0);
    expect(await removeAs(HOST, room.id)).toBe(3);
  });
});

describe('photo rooms: automatic deletion', () => {
  it('lists cards of closed or vanished rooms, and any card older than 24 hours', async () => {
    const live = await openPhotoRoom();
    await join(live.code);
    expect(await expired()).toEqual([]);

    await server.rpc(HOST, 'public.leave_room', { p_room_id: live.id }); // forfeit → finished
    expect(await expired()).toEqual([]);
    await server.rpc(GUEST, 'public.leave_room', { p_room_id: live.id }); // → closed
    expect((await expired()).map((r) => r.n)).toHaveLength(3);
    await server.admin('delete from storage.objects');

    const waiting = await openPhotoRoom();
    await server.rpc(HOST, 'public.leave_room', { p_room_id: waiting.id }); // cancel → closed
    expect(await expired()).toHaveLength(3);
    await server.admin('delete from storage.objects');

    const old = await openPhotoRoom();
    await server.admin(
      "update storage.objects set created_at = now() - interval '24 hours 1 minute'",
    );
    expect(await expired()).toHaveLength(3);
    await server.admin('delete from storage.objects');

    const gone = await openPhotoRoom();
    await server.admin(
      "update public.rooms set status = 'waiting', updated_at = now() - interval '31 minutes' where id = $1",
      [gone.id],
    );
    await server.admin('select private.cleanup_stale_rooms()');
    expect(await expired()).toHaveLength(3);
    expect(old.status).toBe('waiting');
  });

  it('a room abandoned while uploading is cleaned up', async () => {
    const room = await createPhotoRoom();
    await upload(HOST, `${room.id}/p1.jpg`);
    await server.admin(
      "update public.rooms set updated_at = now() - interval '31 minutes' where id = $1",
      [room.id],
    );
    await server.admin('select private.cleanup_stale_rooms()');
    expect(await expired()).toEqual([{ n: `${room.id}/p1.jpg` }]);
  });

  it('only the cleanup (service role) may list due cards', async () => {
    expect(await errorOf(server.as(HOST, 'select * from public.expired_room_photos(10)'))).toMatch(
      /permission denied/,
    );
    expect(await errorOf(server.asAnon('select * from public.expired_room_photos(10)'))).toMatch(
      /permission denied/,
    );
  });

  it("forgets a photo room's shuffle history once the room is gone", async () => {
    const room = await openPhotoRoom();
    await join(room.code);
    await server.admin(
      "update public.rooms set updated_at = now() - interval '4 hours' where id = $1",
      [room.id],
    );
    await server.admin('select private.cleanup_stale_rooms()');
    const rows = await server.admin('select 1 from private.layout_history where board_id = $1', [
      `room:${room.id}`,
    ]);
    expect(rows).toEqual([]);
  });
});

describe('built-in rooms are unchanged', () => {
  it('create_room still refuses the photo board id', async () => {
    const attempt = await errorOf(
      server.rpc(HOST, 'public.create_room', {
        p_board_id: 'photos',
        p_level_id: 'tiny',
        p_name: 'Noa',
        p_avatar: 'fox',
        p_app_version: VERSION,
      }),
    );
    expect(attempt).toMatch(/unknown_board/);
  });

  it('API grants: the game functions for players, nothing for visitors', async () => {
    const rows = await server.admin(
      `select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as auth,
              has_function_privilege('anon', p.oid, 'execute') as anon
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' order by 1`,
    );
    expect(rows.filter((r) => r.anon).map((r) => r.proname)).toEqual([]);
    expect(rows.filter((r) => r.auth).map((r) => r.proname)).toEqual([
      'claim_disconnect',
      'claim_disconnect_win',
      'claim_timeout',
      'create_photo_room',
      'create_room',
      'flip_card',
      'heartbeat',
      'join_room',
      'leave_room',
      'photo_room_ready',
      'request_rematch',
      'resolve_turn',
      'server_time',
      'start_room',
    ]);
  });
});
