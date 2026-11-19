-- Memory Match — online games on the host's own photo board.
--
-- Privacy design (Families policy):
-- * Only the HOST (who has the app) can choose a photo board. The friend who
--   joins never uploads anything.
-- * Only the small cropped cards the level needs are uploaded — one per pair —
--   into the PRIVATE bucket "room-photos" at "<room id>/<image id>.jpg".
--   No public bucket, no public links: a card can be read only by the two
--   players of that room (Storage RLS below), through short-lived signed URLs.
-- * Deleted automatically when the room closes, and at the latest 24 hours
--   after upload (Edge Function "room-photos-cleanup", every 5 minutes; the
--   read policy also stops serving any card older than 24 hours).
--
-- A photo room starts in status 'preparing' while the host uploads; nobody can
-- join until the host calls photo_room_ready (which checks every card is there).

-- ---------------------------------------------------------------------------
-- Rooms: 'preparing' status, the photo room's image ids and card back
-- ---------------------------------------------------------------------------

alter table public.rooms drop constraint rooms_status_check;
alter table public.rooms add constraint rooms_status_check
  check (status in ('preparing', 'waiting', 'playing', 'finished', 'closed'));

alter table public.rooms
  -- Image ids of a photo room ('p1' … 'pN', N = pairs of the level); null for built-in boards.
  add column photo_ids text[],
  -- Card back id of the host's photo board (the app falls back to a default if unknown).
  add column card_back text check (card_back is null or card_back ~ '^[a-z0-9-]{1,32}$');

-- Photo rooms need an app that knows how to show them (guests on older apps
-- are asked to update instead of seeing an empty board).
insert into public.app_config (key, value) values ('photo_rooms_min_version', '"0.3.0"')
  on conflict (key) do nothing;

create function private.assert_photo_room_version(p_app_version text) returns void
language plpgsql stable set search_path = '' as $$
declare
  min_version text := coalesce(
    (select value #>> '{}' from public.app_config where key = 'photo_rooms_min_version'), '0.3.0');
begin
  if not private.version_gte(p_app_version, min_version) then
    raise exception 'update_required';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Private storage bucket and its access rules
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-photos', 'room-photos', false, 262144, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload: only the host, only while the room is being prepared, only the
-- expected file names ("<room id>/p1.jpg" …), nothing else in the bucket.
create policy "Room photos: host uploads the cards of a room being prepared"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'room-photos'
    and exists (
      select 1 from public.rooms r
      where r.id::text = split_part(objects.name, '/', 1)
        and r.host_id = (select auth.uid())
        and r.status = 'preparing'
        and objects.name = any (
          select r.id::text || '/' || i || '.jpg' from unnest(r.photo_ids) as i
        )
    )
  );

-- Read (signed URLs): the two players of the room, for at most 24 hours.
-- The guest loses access as soon as the room closes; the host keeps it (their
-- own photos) so their app can delete the cards right after closing.
create policy "Room photos: the two players see their room's cards"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'room-photos'
    and objects.created_at > now() - interval '24 hours'
    and exists (
      select 1 from public.rooms r
      where r.id::text = split_part(objects.name, '/', 1)
        and (
          r.host_id = (select auth.uid())
          or (r.guest_id = (select auth.uid()) and r.status <> 'closed')
        )
    )
  );

-- Delete: the host removes their own cards (the app does this when leaving).
create policy "Room photos: host deletes their room's cards"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'room-photos'
    and exists (
      select 1 from public.rooms r
      where r.id::text = split_part(objects.name, '/', 1)
        and r.host_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Dealing from any list of images (built-in board or photo room)
-- ---------------------------------------------------------------------------

-- Deals a layout never used before for p_key (board id, or 'room:<id>' for a
-- photo room). Same algorithm as before; deal_layout now delegates here.
create function private.deal_images(p_key text, p_images text[], p_level_id text)
returns text[]
language plpgsql volatile set search_path = '' as $$
declare
  pairs int;
  chosen text[];
  layout text[];
  h text;
  attempt int := 0;
begin
  select l.pairs into pairs from private.levels l where level_id = p_level_id;
  if p_images is null then raise exception 'unknown_board'; end if;
  if pairs is null then raise exception 'unknown_level'; end if;
  if coalesce(array_length(p_images, 1), 0) < pairs then raise exception 'board_too_small'; end if;

  loop
    attempt := attempt + 1;
    chosen := (private.shuffle(p_images))[1:pairs];
    layout := private.shuffle(chosen || chosen);
    h := encode(extensions.digest(array_to_json(layout)::text, 'sha256'), 'hex');
    exit when not exists (
      select 1 from private.layout_history
      where board_id = p_key and level_id = p_level_id and hash = h
    );
    if attempt = 200 then
      delete from private.layout_history
      where board_id = p_key and level_id = p_level_id
        and id not in (
          select id from private.layout_history
          where board_id = p_key and level_id = p_level_id
          order by id desc limit 10
        );
    end if;
    if attempt > 400 then raise exception 'deal_failed'; end if;
  end loop;

  insert into private.layout_history (board_id, level_id, hash) values (p_key, p_level_id, h);
  return layout;
end $$;

create or replace function private.deal_layout(p_board_id text, p_level_id text) returns text[]
language plpgsql volatile set search_path = '' as $$
begin
  return private.deal_images(
    p_board_id,
    (select image_ids from private.builtin_boards where board_id = p_board_id),
    p_level_id
  );
end $$;

create or replace function private.start_game(p_room_id uuid, p_starting smallint, p_now timestamptz)
returns void language plpgsql volatile set search_path = '' as $$
declare
  r public.rooms;
  layout text[];
  n int;
begin
  select * into r from public.rooms where id = p_room_id;
  if r.photo_ids is not null then
    layout := private.deal_images('room:' || r.id::text, r.photo_ids, r.level_id);
  else
    layout := private.deal_layout(r.board_id, r.level_id);
  end if;
  n := array_length(layout, 1);
  insert into private.room_decks (room_id, layout) values (p_room_id, layout)
    on conflict (room_id) do update set layout = excluded.layout;
  update public.rooms set
    status = 'playing',
    game_number = r.game_number + 1,
    starting_player = p_starting,
    current_player = p_starting,
    phase = 'awaitingFirst',
    cards = (select jsonb_agg(jsonb_build_object('s', 'down', 'i', null, 'm', null)) from generate_series(1, n)),
    flipped = '{}',
    pending_result = null,
    collected = '[[], []]'::jsonb,
    moves = '{0,0}',
    pairs_total = n / 2,
    pairs_found = 0,
    winner = null,
    end_reason = null,
    rematch = '{}',
    resolve_at = null,
    -- A few extra seconds for the coin-flip animation before the first turn.
    turn_deadline = p_now + make_interval(secs => private.config_int('turn_seconds', 30) + 4),
    version = r.version + 1,
    updated_at = p_now
  where id = p_room_id;
end $$;

-- ---------------------------------------------------------------------------
-- API: photo rooms
-- ---------------------------------------------------------------------------

-- Host: opens a photo room in 'preparing'. Returns the room with photo_ids —
-- the app then uploads exactly those cards and calls photo_room_ready.
create function public.create_photo_room(
  p_level_id text, p_card_back text, p_name text, p_avatar text, p_app_version text
) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n int;
  r public.rooms;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform private.assert_version(p_app_version);
  perform private.assert_photo_room_version(p_app_version);
  select pairs into n from private.levels where level_id = p_level_id;
  if n is null then raise exception 'unknown_level'; end if;
  -- Limits uploads per player (rooms are removed by the cleanup, so this is a soft cap).
  if (select count(*) from public.rooms
      where host_id = uid and photo_ids is not null
        and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too_many_rooms';
  end if;
  -- One open room per host: close older waiting/preparing rooms.
  update public.rooms set status = 'closed', version = version + 1, updated_at = now()
    where host_id = uid and status in ('waiting', 'preparing');
  insert into public.rooms (code, board_id, level_id, host_id, players, status, photo_ids, card_back)
  values (
    private.new_room_code(), 'photos', p_level_id, uid,
    jsonb_build_array(jsonb_build_object(
      'name', private.clean_nickname(p_name), 'avatar', private.clean_avatar(p_avatar))),
    'preparing',
    array(select 'p' || g from generate_series(1, n) as g),
    case when p_card_back ~ '^[a-z0-9-]{1,32}$' then p_card_back end
  )
  returning * into r;
  return r;
end $$;

-- Host: every card is uploaded → the room opens for the friend.
create function public.photo_room_ready(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  uploaded int;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if l.seat <> 0 or r.photo_ids is null or r.status <> 'preparing' then
    raise exception 'not_now';
  end if;
  select count(*) into uploaded from storage.objects o
  where o.bucket_id = 'room-photos'
    and o.name = any (select r.id::text || '/' || i || '.jpg' from unnest(r.photo_ids) as i);
  if uploaded < array_length(r.photo_ids, 1) then raise exception 'photos_missing'; end if;
  update public.rooms set status = 'waiting', version = r.version + 1, updated_at = now()
    where id = r.id;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Existing API, updated for 'preparing' and photo rooms
-- ---------------------------------------------------------------------------

create or replace function public.create_room(
  p_board_id text, p_level_id text, p_name text, p_avatar text, p_app_version text
) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.rooms;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform private.assert_version(p_app_version);
  if not exists (select 1 from private.builtin_boards where board_id = p_board_id) then
    raise exception 'unknown_board';
  end if;
  if not exists (select 1 from private.levels where level_id = p_level_id) then
    raise exception 'unknown_level';
  end if;
  -- One open room per host: close older waiting/preparing rooms.
  update public.rooms set status = 'closed', version = version + 1, updated_at = now()
    where host_id = uid and status in ('waiting', 'preparing');
  insert into public.rooms (code, board_id, level_id, host_id, players)
  values (
    private.new_room_code(), p_board_id, p_level_id, uid,
    jsonb_build_array(jsonb_build_object(
      'name', private.clean_nickname(p_name), 'avatar', private.clean_avatar(p_avatar)))
  )
  returning * into r;
  return r;
end $$;

create or replace function public.join_room(p_code text, p_name text, p_avatar text, p_app_version text)
returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.rooms;
  nm text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform private.assert_version(p_app_version);
  select * into r from public.rooms where code = upper(btrim(p_code)) for update;
  if not found or r.status = 'closed' then raise exception 'room_not_found'; end if;
  -- Re-joining your own room (e.g. after the app restarted) just returns it.
  if r.host_id = uid or r.guest_id = uid then return r; end if;
  -- The host is still uploading the photo cards: the room isn't open yet.
  if r.status = 'preparing' then raise exception 'room_not_found'; end if;
  if r.guest_id is not null or r.status <> 'waiting' then raise exception 'room_full'; end if;
  if r.photo_ids is not null then perform private.assert_photo_room_version(p_app_version); end if;
  nm := private.clean_nickname(p_name);
  update public.rooms set
    guest_id = uid,
    guest_seen_at = now(),
    players = r.players || jsonb_build_array(
      jsonb_build_object('name', nm, 'avatar', private.clean_avatar(p_avatar)))
  where id = r.id;
  -- Coin flip: who starts is decided randomly on the server.
  perform private.start_game(r.id, private.random_int(2)::smallint, now());
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

create or replace function public.leave_room(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status in ('waiting', 'preparing') then
    update public.rooms set status = 'closed', version = r.version + 1, updated_at = now() where id = r.id;
  elsif r.status = 'playing' then
    update public.rooms set
      status = 'finished', phase = 'finished', winner = 1 - l.seat, end_reason = 'forfeit',
      turn_deadline = null, resolve_at = null, version = r.version + 1, updated_at = now()
    where id = r.id;
  elsif r.status = 'finished' then
    update public.rooms set status = 'closed', version = r.version + 1, updated_at = now() where id = r.id;
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

create or replace function private.cleanup_stale_rooms() returns int
language plpgsql volatile set search_path = '' as $$
declare
  n int;
begin
  delete from public.rooms
  where (status in ('preparing', 'waiting', 'closed') and updated_at < now() - interval '30 minutes')
     or (updated_at < now() - interval '3 hours');
  get diagnostics n = row_count;
  delete from private.layout_history
  where played_at < now() - interval '180 days';
  -- Photo rooms keep their no-repeat history only while the room exists.
  delete from private.layout_history h
  where h.board_id like 'room:%'
    and not exists (select 1 from public.rooms r where 'room:' || r.id::text = h.board_id);
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Automatic deletion of the photo cards
-- ---------------------------------------------------------------------------

-- Cards to delete: the room closed or is gone, or the card is older than 24 hours.
-- Called only by the cleanup Edge Function (service role) and the cron job.
create function public.expired_room_photos(p_limit int default 500) returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'room-photos'
    and (
      o.created_at <= now() - interval '24 hours'
      or not exists (
        select 1 from public.rooms r
        where r.id::text = split_part(o.name, '/', 1) and r.status <> 'closed'
      )
    )
  order by o.created_at
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

revoke execute on function private.assert_photo_room_version(text) from public, anon, authenticated;
revoke execute on function private.deal_images(text, text[], text) from public, anon, authenticated;
revoke execute on function
  public.create_photo_room(text, text, text, text, text),
  public.photo_room_ready(uuid),
  public.expired_room_photos(int)
from public, anon, authenticated;
grant execute on function
  public.create_photo_room(text, text, text, text, text),
  public.photo_room_ready(uuid)
to authenticated;
grant execute on function public.expired_room_photos(int) to service_role;

-- Every 5 minutes: if any card is due, call the Edge Function, which deletes
-- the files through the Storage API (deleting rows in SQL would leave the
-- files behind). Skipped where pg_cron / pg_net are unavailable (tests).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    perform cron.schedule(
      'memory-match-delete-room-photos',
      '*/5 * * * *',
      $job$
        select net.http_post(
          url := 'https://idarczmhhhkazbuewwao.supabase.co/functions/v1/room-photos-cleanup',
          body := '{}'::jsonb,
          timeout_milliseconds := 20000
        )
        where exists (select 1 from public.expired_room_photos(1));
      $job$
    );
  end if;
end $$;
