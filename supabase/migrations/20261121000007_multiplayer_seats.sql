-- Memory Match — online games for 2–8 players.
--
-- Until now a room had exactly two seats (host_id / guest_id). This migration
-- makes seats a table of their own:
--
-- * public.room_seats — the source of truth for who sits where: one row per
--   player (seat 0 = host), their nickname and avatar, whether they left, their
--   final place, and their last heartbeat. Room access (RLS), photo access
--   (Storage RLS) and every game function go through it.
-- * public.rooms.players — the public, realtime-delivered view of the seats
--   ([{ name, avatar, uid, left, rank }] by seat), rebuilt by
--   private.publish_seats() in the same transaction as every seat change.
-- * public.rooms.max_players — how many may join: 2 for rooms opened by apps
--   before online protocol 2 and for small levels; up to app_config.max_players
--   (8) for bigger levels, by the same minimum-board rule as the app
--   (src/game/players.ts). A 2-seat room starts as soon as the friend joins (as
--   before); a bigger room waits in a lobby until the host presses Start.
--
-- Compatibility with apps that only know two seats (≤ 0.4.x, online protocol 1):
-- every function keeps its name and arguments (new arguments have defaults),
-- 2-seat rooms behave exactly as before, and the legacy columns guest_id,
-- host_seen_at and guest_seen_at are still written for 2-seat rooms. Rooms for
-- more players need protocol ≥ app_config.party_rooms_min_protocol: older apps
-- get 'update_required' instead of a game they can't show.
--
-- Leaving or losing the connection no longer ends a game for everyone: the
-- player's turns are skipped (same rules as the app's engine, `leave`); the game
-- ends and is ranked when only one player is left.

-- ---------------------------------------------------------------------------
-- Config: the shared maximum, the server's protocol, the version gate
-- ---------------------------------------------------------------------------

insert into public.app_config (key, value) values
  -- Same value as MAX_PLAYERS in src/game/players.ts (checked by a server test).
  ('max_players', '8'),
  -- What this server speaks; apps use the N-seat API only when this is ≥ 2.
  ('online_protocol', '2'),
  -- Rooms for more than two players need an app that can show them.
  ('party_rooms_min_protocol', '2')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Smallest board (pairs) for a number of players — mirrors minPairsForPlayers.
create function private.min_pairs_for_players(p_count int) returns int
language sql immutable set search_path = '' as $$
  select case when p_count <= 2 then 0 when p_count <= 4 then 8 else 12 end;
$$;

-- Most players a level allows (online rooms take this many at most).
create function private.max_players_for_level(p_level_id text) returns smallint
language sql stable set search_path = '' as $$
  select coalesce(max(n), 1)::smallint
  from private.levels l
  cross join generate_series(1, private.config_int('max_players', 8)) as n
  where l.level_id = p_level_id and l.pairs >= private.min_pairs_for_players(n);
$$;

-- ---------------------------------------------------------------------------
-- Seats
-- ---------------------------------------------------------------------------

alter table public.rooms
  add column max_players smallint not null default 2 check (max_players between 2 and 8);

create table public.room_seats (
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat smallint not null check (seat between 0 and 7),
  user_id uuid not null,
  name text not null,
  avatar text not null,
  -- Left the game (or lost the connection): their turns are skipped.
  has_left boolean not null default false,
  -- Final place when the game ended (1 = first; shared places for ties).
  rank smallint,
  joined_at timestamptz not null default now(),
  -- Last heartbeat (judges disconnect claims; not broadcast).
  seen_at timestamptz not null default now(),
  primary key (room_id, seat),
  unique (room_id, user_id)
);
create index room_seats_user_id on public.room_seats (user_id);

alter table public.room_seats enable row level security;
-- A player sees only their own seats (the room row shows everyone's public info).
create policy "Players can read their own seats" on public.room_seats
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.room_seats from anon, authenticated;
grant select on table public.room_seats to authenticated;

-- Existing rooms: the host and the guest become seats 0 and 1.
insert into public.room_seats (room_id, seat, user_id, name, avatar, joined_at, seen_at)
select r.id, 0, r.host_id, coalesce(r.players -> 0 ->> 'name', 'Player'),
       coalesce(r.players -> 0 ->> 'avatar', 'fox'), r.created_at, r.host_seen_at
from public.rooms r;
insert into public.room_seats (room_id, seat, user_id, name, avatar, joined_at, seen_at)
select r.id, 1, r.guest_id, coalesce(r.players -> 1 ->> 'name', 'Player'),
       coalesce(r.players -> 1 ->> 'avatar', 'fox'), r.created_at,
       coalesce(r.guest_seen_at, r.created_at)
from public.rooms r where r.guest_id is not null;

-- Room access: everyone with a seat (was: host or guest).
drop policy "Players can read their own room" on public.rooms;
create policy "Players can read rooms they have a seat in" on public.rooms
  for select to authenticated
  using (exists (
    select 1 from public.room_seats s
    where s.room_id = rooms.id and s.user_id = (select auth.uid())
  ));

-- Rebuilds the public view of the seats (and the legacy guest_id) from room_seats.
create function private.publish_seats(p_room_id uuid) returns void
language plpgsql volatile set search_path = '' as $$
begin
  update public.rooms r set
    players = coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name, 'avatar', s.avatar, 'uid', s.user_id, 'left', s.has_left, 'rank', s.rank
      ) order by s.seat)
      from public.room_seats s where s.room_id = p_room_id
    ), '[]'::jsonb),
    guest_id = (select s.user_id from public.room_seats s where s.room_id = p_room_id and s.seat = 1)
  where r.id = p_room_id;
end $$;

do $$
declare
  rid uuid;
begin
  for rid in select id from public.rooms loop
    perform private.publish_seats(rid);
  end loop;
end $$;

-- Players still in the game (not left).
create function private.present_count(p_room_id uuid) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from public.room_seats where room_id = p_room_id and not has_left;
$$;

-- The next seat after p_from (round the table) whose player is still in the game.
create function private.next_seat(p_room_id uuid, p_from smallint) returns smallint
language sql stable set search_path = '' as $$
  select coalesce((
    select s.seat from public.room_seats s
    where s.room_id = p_room_id and not s.has_left and s.seat <> p_from
    order by (s.seat - p_from + 8) % 8
    limit 1
  ), p_from);
$$;

-- Locks and returns the caller's room and seat. Players who left can't act any more.
drop function private.lock_room(uuid);
create function private.lock_room(p_room_id uuid, out room public.rooms, out seat smallint)
language plpgsql volatile set search_path = '' as $$
declare
  uid uuid := auth.uid();
  gone boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  select s.seat, s.has_left into seat, gone
  from public.room_seats s where s.room_id = p_room_id and s.user_id = uid;
  if seat is null or gone then raise exception 'not_in_room'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Game rules (same as src/game/engine.ts)
-- ---------------------------------------------------------------------------

-- Final places: players still in the game by pairs (ties share a place: 1, 1, 3),
-- then those who left. Also sets the legacy `winner` (seat, or -1 for a tie).
create function private.finish_game(p_room_id uuid, p_reason text, p_now timestamptz)
returns void language plpgsql volatile set search_path = '' as $$
declare
  r public.rooms;
  firsts smallint[];
begin
  select * into r from public.rooms where id = p_room_id;
  with score as (
    select s.seat, s.has_left, jsonb_array_length(coalesce(r.collected -> s.seat::int, '[]')) as pairs
    from public.room_seats s where s.room_id = p_room_id
  )
  update public.room_seats t set rank = 1 + (
    select count(*) from score o
    where (not o.has_left and me.has_left)
       or (o.has_left = me.has_left and o.pairs > me.pairs)
  )
  from score me
  where t.room_id = p_room_id and t.seat = me.seat;
  firsts := array(select seat from public.room_seats where room_id = p_room_id and rank = 1 order by seat);
  update public.rooms set
    status = 'finished',
    phase = 'finished',
    flipped = '{}',
    pending_result = null,
    winner = case when array_length(firsts, 1) = 1 then firsts[1] else -1 end,
    end_reason = p_reason,
    turn_deadline = null,
    resolve_at = null,
    updated_at = p_now
  where id = p_room_id;
end $$;

-- Starts a new game in the room with a fresh never-used deal.
create or replace function private.start_game(p_room_id uuid, p_starting smallint, p_now timestamptz)
returns void language plpgsql volatile set search_path = '' as $$
declare
  r public.rooms;
  layout text[];
  n int;
  seats int;
begin
  select * into r from public.rooms where id = p_room_id;
  seats := (select count(*) from public.room_seats where room_id = p_room_id);
  if r.photo_ids is not null then
    layout := private.deal_images('room:' || r.id::text, r.photo_ids, r.level_id);
  else
    layout := private.deal_layout(r.board_id, r.level_id);
  end if;
  n := array_length(layout, 1);
  insert into private.room_decks (room_id, layout) values (p_room_id, layout)
    on conflict (room_id) do update set layout = excluded.layout;
  update public.room_seats set rank = null where room_id = p_room_id;
  update public.rooms set
    status = 'playing',
    game_number = r.game_number + 1,
    starting_player = p_starting,
    current_player = p_starting,
    phase = 'awaitingFirst',
    cards = (select jsonb_agg(jsonb_build_object('s', 'down', 'i', null, 'm', null)) from generate_series(1, n)),
    flipped = '{}',
    pending_result = null,
    collected = (select jsonb_agg('[]'::jsonb) from generate_series(1, seats)),
    moves = array_fill(0, array[seats]),
    pairs_total = n / 2,
    pairs_found = 0,
    winner = null,
    end_reason = null,
    rematch = '{}',
    resolve_at = null,
    -- A few extra seconds for the "who starts" animation before the first turn.
    turn_deadline = p_now + make_interval(secs => private.config_int('turn_seconds', 30) + 4),
    version = r.version + 1,
    updated_at = p_now
  where id = p_room_id;
  perform private.publish_seats(p_room_id);
end $$;

-- Applies a pending match/mismatch (the engine's `resolve`).
create or replace function private.apply_resolve(r public.rooms, p_now timestamptz) returns void
language plpgsql volatile set search_path = '' as $$
declare
  a int := r.flipped[1];
  b int := r.flipped[2];
  cur smallint := r.current_player;
  img text;
  v_cards jsonb := r.cards;
  v_found int;
begin
  if r.pending_result = 'match' then
    img := v_cards -> a ->> 'i';
    v_cards := jsonb_set(v_cards, array[a::text], jsonb_build_object('s', 'matched', 'i', img, 'm', cur));
    v_cards := jsonb_set(v_cards, array[b::text], jsonb_build_object('s', 'matched', 'i', img, 'm', cur));
    v_found := r.pairs_found + 1;
    update public.rooms set
      cards = v_cards,
      collected = jsonb_set(r.collected, array[cur::text], (r.collected -> cur::int) || to_jsonb(img)),
      pairs_found = v_found,
      flipped = '{}',
      pending_result = null,
      resolve_at = null,
      phase = 'awaitingFirst',
      turn_deadline = p_now + make_interval(secs => private.config_int('turn_seconds', 30)),
      version = r.version + 1,
      updated_at = p_now
    where id = r.id;
    if v_found = r.pairs_total then
      perform private.finish_game(r.id, 'complete', p_now);
      perform private.publish_seats(r.id);
    end if;
  else
    v_cards := jsonb_set(v_cards, array[a::text], jsonb_build_object('s', 'down', 'i', null, 'm', null));
    v_cards := jsonb_set(v_cards, array[b::text], jsonb_build_object('s', 'down', 'i', null, 'm', null));
    update public.rooms set
      cards = v_cards,
      flipped = '{}',
      pending_result = null,
      resolve_at = null,
      current_player = private.next_seat(r.id, cur),
      phase = 'awaitingFirst',
      turn_deadline = p_now + make_interval(secs => private.config_int('turn_seconds', 30)),
      version = r.version + 1,
      updated_at = p_now
    where id = r.id;
  end if;
end $$;

-- A player leaves for good (left, or lost the connection) — the engine's `leave`.
-- Playing: their turns are skipped; if it was their turn, the open cards flip
-- back and the turn passes; with one player left the game ends and is ranked.
-- Finished: they won't rematch; with nobody left to play with, the room closes.
create function private.depart(p_room_id uuid, p_seat smallint, p_reason text)
returns void language plpgsql volatile set search_path = '' as $$
declare
  r public.rooms;
  v_cards jsonb;
  idx smallint;
  over boolean;
begin
  select * into r from public.rooms where id = p_room_id;
  update public.room_seats set has_left = true where room_id = p_room_id and seat = p_seat;
  over := private.present_count(p_room_id) <= 1;
  if r.status = 'playing' then
    if r.current_player = p_seat or over then
      v_cards := r.cards;
      foreach idx in array r.flipped loop
        v_cards := jsonb_set(v_cards, array[idx::text], jsonb_build_object('s', 'down', 'i', null, 'm', null));
      end loop;
      update public.rooms set
        cards = v_cards,
        flipped = '{}',
        pending_result = null,
        resolve_at = null,
        phase = 'awaitingFirst',
        current_player = case when r.current_player = p_seat
          then private.next_seat(p_room_id, p_seat) else r.current_player end,
        turn_deadline = now() + make_interval(secs => private.config_int('turn_seconds', 30))
      where id = p_room_id;
    end if;
    if over then perform private.finish_game(p_room_id, p_reason, now()); end if;
  elsif r.status = 'finished' then
    update public.rooms set
      rematch = array_remove(r.rematch, p_seat),
      status = case when over then 'closed' else r.status end
    where id = p_room_id;
  end if;
  update public.rooms set version = r.version + 1, updated_at = now() where id = p_room_id;
  perform private.publish_seats(p_room_id);
end $$;

-- Seats 0..n-1 again after players left a lobby or a finished game (before a rematch).
create function private.compact_seats(p_room_id uuid) returns void
language plpgsql volatile set search_path = '' as $$
declare
  old_seat smallint;
  i smallint := 0;
begin
  delete from public.room_seats where room_id = p_room_id and has_left;
  -- In seating order, each player moves down to the first free seat (always free:
  -- whoever sat there moved down before them or left).
  for old_seat in
    select seat from public.room_seats where room_id = p_room_id order by seat
  loop
    if old_seat <> i then
      update public.room_seats set seat = i where room_id = p_room_id and seat = old_seat;
    end if;
    i := i + 1;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- API: rooms, joining, starting
-- ---------------------------------------------------------------------------

-- The protocol an app speaks: apps ≤ 0.4 don't send one (protocol 1, two seats).
create function private.assert_party_protocol(p_max_players int, p_protocol int) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_max_players > 2 and coalesce(p_protocol, 1) < private.config_int('party_rooms_min_protocol', 2) then
    raise exception 'update_required';
  end if;
end $$;

create function private.open_room(
  p_uid uuid, p_board_id text, p_level_id text, p_name text, p_avatar text,
  p_protocol int, p_status text, p_photo_ids text[], p_card_back text
) returns public.rooms
language plpgsql volatile set search_path = '' as $$
declare
  r public.rooms;
  nm text := private.clean_nickname(p_name);
  av text := private.clean_avatar(p_avatar);
begin
  -- One open room per host: close older waiting/preparing rooms.
  update public.rooms set status = 'closed', version = version + 1, updated_at = now()
    where host_id = p_uid and status in ('waiting', 'preparing');
  insert into public.rooms (code, board_id, level_id, host_id, status, photo_ids, card_back, max_players)
  values (
    private.new_room_code(), p_board_id, p_level_id, p_uid, p_status, p_photo_ids, p_card_back,
    -- Apps before protocol 2 can only show two players.
    case when coalesce(p_protocol, 1) >= 2 then private.max_players_for_level(p_level_id) else 2 end
  )
  returning * into r;
  insert into public.room_seats (room_id, seat, user_id, name, avatar) values (r.id, 0, p_uid, nm, av);
  perform private.publish_seats(r.id);
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

drop function public.create_room(text, text, text, text, text);
create function public.create_room(
  p_board_id text, p_level_id text, p_name text, p_avatar text, p_app_version text,
  p_protocol int default 1
) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform private.assert_version(p_app_version);
  if not exists (select 1 from private.builtin_boards where board_id = p_board_id) then
    raise exception 'unknown_board';
  end if;
  if not exists (select 1 from private.levels where level_id = p_level_id) then
    raise exception 'unknown_level';
  end if;
  return private.open_room(uid, p_board_id, p_level_id, p_name, p_avatar, p_protocol, 'waiting', null, null);
end $$;

drop function public.create_photo_room(text, text, text, text, text);
create function public.create_photo_room(
  p_level_id text, p_card_back text, p_name text, p_avatar text, p_app_version text,
  p_protocol int default 1
) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n int;
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
  return private.open_room(
    uid, 'photos', p_level_id, p_name, p_avatar, p_protocol, 'preparing',
    array(select 'p' || g from generate_series(1, n) as g),
    case when p_card_back ~ '^[a-z0-9-]{1,32}$' then p_card_back end
  );
end $$;

drop function public.join_room(text, text, text, text);
create function public.join_room(
  p_code text, p_name text, p_avatar text, p_app_version text, p_protocol int default 1
) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.rooms;
  seated int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform private.assert_version(p_app_version);
  select * into r from public.rooms where code = upper(btrim(p_code)) for update;
  if not found or r.status = 'closed' then raise exception 'room_not_found'; end if;
  -- Re-joining your own room (e.g. after the app restarted) just returns it.
  if exists (select 1 from public.room_seats where room_id = r.id and user_id = uid and not has_left) then
    return r;
  end if;
  -- The host is still uploading the photo cards: the room isn't open yet.
  if r.status = 'preparing' then raise exception 'room_not_found'; end if;
  perform private.assert_party_protocol(r.max_players, p_protocol);
  if r.status <> 'waiting'
     or exists (select 1 from public.room_seats where room_id = r.id and user_id = uid) then
    -- Apps ≤ 0.4 only know 'room_full' (their 2-seat rooms are full once started).
    if coalesce(p_protocol, 1) >= 2 then raise exception 'game_started'; end if;
    raise exception 'room_full';
  end if;
  seated := (select count(*) from public.room_seats where room_id = r.id);
  if seated >= r.max_players then raise exception 'room_full'; end if;
  if r.photo_ids is not null then perform private.assert_photo_room_version(p_app_version); end if;
  insert into public.room_seats (room_id, seat, user_id, name, avatar)
  values (r.id, seated, uid, private.clean_nickname(p_name), private.clean_avatar(p_avatar));
  if r.max_players = 2 then
    -- Two-player rooms start as soon as the friend joins (as they always have);
    -- who starts is decided randomly on the server.
    update public.rooms set guest_seen_at = now() where id = r.id;
    perform private.start_game(r.id, private.random_int(2)::smallint, now());
  else
    update public.rooms set version = r.version + 1, updated_at = now() where id = r.id;
    perform private.publish_seats(r.id);
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- Host: everyone who joined plays (at least two). Who starts is random.
create function public.start_room(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  seated int;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if l.seat <> 0 then raise exception 'not_host'; end if;
  if r.status <> 'waiting' then raise exception 'not_now'; end if;
  seated := (select count(*) from public.room_seats where room_id = p_room_id);
  if seated < 2 then raise exception 'not_enough_players'; end if;
  perform private.start_game(p_room_id, private.random_int(seated)::smallint, now());
  return (select x from public.rooms x where x.id = p_room_id);
end $$;

-- ---------------------------------------------------------------------------
-- API: turns
-- ---------------------------------------------------------------------------

create or replace function public.flip_card(p_room_id uuid, p_index int) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  img text;
  first_img text;
  is_match boolean;
  now_ts timestamptz := now();
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status <> 'playing' then raise exception 'game_not_active'; end if;
  if r.phase not in ('awaitingFirst', 'awaitingSecond') then raise exception 'not_now'; end if;
  if l.seat <> r.current_player then raise exception 'not_your_turn'; end if;
  if p_index is null or p_index < 0 or p_index >= jsonb_array_length(r.cards) then
    raise exception 'invalid_card';
  end if;
  if r.cards -> p_index ->> 's' <> 'down' then raise exception 'invalid_card'; end if;

  select layout[p_index + 1] into img from private.room_decks where room_id = r.id;

  if r.phase = 'awaitingFirst' then
    update public.rooms set
      cards = jsonb_set(r.cards, array[p_index::text], jsonb_build_object('s', 'up', 'i', img, 'm', null)),
      flipped = array[p_index]::smallint[],
      phase = 'awaitingSecond',
      version = r.version + 1,
      updated_at = now_ts
    where id = r.id;
  else
    first_img := r.cards -> r.flipped[1]::int ->> 'i';
    is_match := first_img = img;
    update public.rooms set
      cards = jsonb_set(r.cards, array[p_index::text], jsonb_build_object('s', 'up', 'i', img, 'm', null)),
      flipped = array[r.flipped[1], p_index]::smallint[],
      phase = 'resolving',
      pending_result = case when is_match then 'match' else 'mismatch' end,
      moves[r.current_player + 1] = r.moves[r.current_player + 1] + 1,
      resolve_at = now_ts + case when is_match then interval '900 milliseconds' else interval '1500 milliseconds' end,
      version = r.version + 1,
      updated_at = now_ts
    where id = r.id;
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- The turn timer ran out (checked against the server clock): any player may
-- claim it, and the turn passes to the next player still in the game.
create or replace function public.claim_timeout(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  v_cards jsonb;
  idx smallint;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status <> 'playing' then return r; end if;
  if r.turn_deadline is null or now() < r.turn_deadline then raise exception 'not_expired'; end if;
  if r.phase = 'resolving' then
    perform private.apply_resolve(r, now());
  else
    v_cards := r.cards;
    foreach idx in array r.flipped loop
      v_cards := jsonb_set(v_cards, array[idx::text], jsonb_build_object('s', 'down', 'i', null, 'm', null));
    end loop;
    update public.rooms set
      cards = v_cards,
      flipped = '{}',
      current_player = private.next_seat(r.id, r.current_player),
      phase = 'awaitingFirst',
      turn_deadline = now() + make_interval(secs => private.config_int('turn_seconds', 30)),
      version = r.version + 1,
      updated_at = now()
    where id = r.id;
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- API: presence, leaving, disconnects, rematch
-- ---------------------------------------------------------------------------

-- "I'm still here" — every ~10 s. Returns the server time (for clock sync).
-- Two-seat rooms also update the room's host_seen_at / guest_seen_at, which
-- apps ≤ 0.4 read for their "opponent away" dialog.
create or replace function public.heartbeat(p_room_id uuid) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  update public.room_seats set seen_at = now() where room_id = p_room_id and seat = l.seat;
  if r.max_players = 2 then
    if l.seat = 0 then
      update public.rooms set host_seen_at = now() where id = p_room_id;
    else
      update public.rooms set guest_seen_at = now() where id = p_room_id;
    end if;
  end if;
  return now();
end $$;

-- A player silent for longer than the grace period (no heartbeats): any other
-- player may take them out of the game; their turns are then skipped.
create function public.claim_disconnect(p_room_id uuid, p_seat int) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  target public.room_seats;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status <> 'playing' then return r; end if;
  select * into target from public.room_seats where room_id = p_room_id and seat = p_seat;
  if not found or target.seat = l.seat then raise exception 'not_now'; end if;
  if target.has_left then return r; end if;
  if now() - target.seen_at < make_interval(secs => private.config_int('disconnect_grace_seconds', 60)) then
    raise exception 'player_still_connected';
  end if;
  perform private.depart(p_room_id, target.seat, 'disconnect');
  return (select x from public.rooms x where x.id = p_room_id);
end $$;

-- Apps ≤ 0.4 (two seats): the same claim for "the other player".
create or replace function public.claim_disconnect_win(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  target public.room_seats;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status <> 'playing' then return r; end if;
  if r.max_players <> 2 then raise exception 'not_now'; end if;
  select * into target from public.room_seats where room_id = p_room_id and seat = 1 - l.seat;
  if not found or target.has_left then return r; end if;
  if now() - target.seen_at < make_interval(secs => private.config_int('disconnect_grace_seconds', 60)) then
    raise exception 'opponent_still_connected';
  end if;
  perform private.depart(p_room_id, target.seat, 'disconnect');
  return (select x from public.rooms x where x.id = p_room_id);
end $$;

-- Leaving:
-- * a lobby: the host closes it for everyone; anyone else just gives up their seat;
-- * a running game: the player is out, the others play on (with one player left
--   the game ends — in a 2-player game the other player wins, as before);
-- * after the game: no rematch for them; the room closes when fewer than two remain.
create or replace function public.leave_room(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status in ('waiting', 'preparing') then
    if l.seat = 0 then
      update public.rooms set status = 'closed', version = r.version + 1, updated_at = now() where id = r.id;
    else
      delete from public.room_seats where room_id = r.id and seat = l.seat;
      perform private.compact_seats(r.id);
      update public.rooms set version = r.version + 1, updated_at = now() where id = r.id;
      perform private.publish_seats(r.id);
    end if;
  elsif r.status = 'playing' then
    perform private.depart(r.id, l.seat, 'forfeit');
  elsif r.status = 'finished' then
    perform private.depart(r.id, l.seat, 'forfeit');
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- Rematch for the whole group: once everyone still here has asked, a new
-- server-side shuffle with the same players; the next player in order starts.
create or replace function public.request_rematch(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  wants smallint[];
  present smallint[];
  next_starter smallint;
  new_starter smallint;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status <> 'finished' then raise exception 'game_not_finished'; end if;
  present := array(select seat from public.room_seats where room_id = r.id and not has_left order by seat);
  if coalesce(array_length(present, 1), 0) < 2 then raise exception 'room_not_found'; end if;
  wants := array(select distinct unnest(r.rematch || array[l.seat]) order by 1);
  if present <@ wants then
    -- The next player after the last starter, counted among those still here,
    -- keeps their place in line once the seats are renumbered.
    next_starter := private.next_seat(r.id, r.starting_player);
    new_starter := (select count(*) from unnest(present) as p where p < next_starter);
    perform private.compact_seats(r.id);
    perform private.start_game(r.id, new_starter, now());
  else
    update public.rooms set rematch = wants, version = r.version + 1, updated_at = now() where id = r.id;
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Photo rooms: every player in the room sees the cards
-- ---------------------------------------------------------------------------

-- Read (signed URLs): every player still in the room, for at most 24 hours.
-- Players lose access when they leave or the room closes; the host keeps it
-- (their own photos) so their app can delete the cards right after closing.
drop policy "Room photos: the two players see their room's cards" on storage.objects;
create policy "Room photos: the players see their room's cards"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'room-photos'
    and objects.created_at > now() - interval '24 hours'
    and exists (
      select 1 from public.rooms r
      join public.room_seats s on s.room_id = r.id
      where r.id::text = split_part(objects.name, '/', 1)
        and s.user_id = (select auth.uid())
        and (r.host_id = s.user_id or (not s.has_left and r.status <> 'closed'))
    )
  );

-- ---------------------------------------------------------------------------
-- Data minimisation: anonymous users still seated in a room are kept
-- ---------------------------------------------------------------------------

create or replace function private.cleanup_anonymous_users() returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  n int := 0;
begin
  if to_regclass('auth.users') is null then
    return 0;
  end if;
  execute $sql$
    delete from auth.users u
    where u.is_anonymous
      and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
      and not exists (select 1 from public.room_seats s where s.user_id = u.id)
      and not exists (select 1 from public.rooms r where r.host_id = u.id)
  $sql$;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Grants: only signed-in players may call the API; helpers stay private
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  public.server_time(),
  public.create_room(text, text, text, text, text, int),
  public.create_photo_room(text, text, text, text, text, int),
  public.photo_room_ready(uuid),
  public.join_room(text, text, text, text, int),
  public.start_room(uuid),
  public.flip_card(uuid, int),
  public.resolve_turn(uuid, boolean),
  public.claim_timeout(uuid),
  public.heartbeat(uuid),
  public.claim_disconnect(uuid, int),
  public.claim_disconnect_win(uuid),
  public.leave_room(uuid),
  public.request_rematch(uuid)
to authenticated;
revoke execute on function public.expired_room_photos(int) from authenticated;
grant execute on function public.expired_room_photos(int) to service_role;
