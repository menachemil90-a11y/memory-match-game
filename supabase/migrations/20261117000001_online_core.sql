-- Memory Match — online 1v1 (server-authoritative).
--
-- Clients can only READ their own room through RLS. Every write goes through
-- SECURITY DEFINER functions below, which apply the same rules as the app's
-- TypeScript engine (src/game/engine.ts). The shuffled deck lives in the
-- `private` schema, which is not exposed through the API and has no grants.
-- Parity with the TS engine is proven by src/features/online/__tests__.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
create policy "Config is readable by everyone" on public.app_config
  for select to anon, authenticated using (true);
grant select on public.app_config to anon, authenticated;

insert into public.app_config (key, value) values
  ('min_supported_version', '"0.1.0"'),
  ('turn_seconds', '30'),
  ('disconnect_grace_seconds', '60');

create table private.levels (
  level_id text primary key,
  pairs int not null,
  cols int not null,
  rows int not null
);
insert into private.levels values
  ('tiny', 3, 2, 3), ('easy', 6, 3, 4), ('medium', 8, 4, 4),
  ('tricky', 10, 4, 5), ('hard', 12, 4, 6), ('expert', 18, 6, 6);

-- Image ids of the built-in boards (seeded by a generated migration).
create table private.builtin_boards (
  board_id text primary key,
  image_ids text[] not null
);

-- ---------------------------------------------------------------------------
-- Rooms (public state) and decks (secret)
-- ---------------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  board_id text not null,
  level_id text not null references private.levels (level_id),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished', 'closed')),
  host_id uuid not null,
  guest_id uuid,
  -- [{ "name": "...", "avatar": "fox" }] — index 0 = host, 1 = guest
  players jsonb not null default '[]'::jsonb,
  game_number int not null default 0,
  starting_player smallint,
  current_player smallint,
  phase text check (phase in ('awaitingFirst', 'awaitingSecond', 'resolving', 'finished')),
  -- Public card state: [{ "s": "down"|"up"|"matched", "i": imageId|null, "m": seat|null }]
  -- Face-down cards never carry their image id.
  cards jsonb not null default '[]'::jsonb,
  flipped smallint[] not null default '{}',
  pending_result text check (pending_result in ('match', 'mismatch')),
  collected jsonb not null default '[[], []]'::jsonb,
  moves int[] not null default '{0,0}',
  pairs_total int not null default 0,
  pairs_found int not null default 0,
  winner smallint, -- 0 / 1, or -1 for a tie
  end_reason text check (end_reason in ('complete', 'forfeit', 'disconnect')),
  turn_deadline timestamptz,
  resolve_at timestamptz,
  rematch smallint[] not null default '{}',
  host_seen_at timestamptz not null default now(),
  guest_seen_at timestamptz,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_updated_at on public.rooms (updated_at);

alter table public.rooms enable row level security;
create policy "Players can read their own room" on public.rooms
  for select to authenticated
  using ((select auth.uid()) = host_id or (select auth.uid()) = guest_id);
grant select on public.rooms to authenticated;
-- No insert/update/delete grants: all writes go through the functions below.

create table private.room_decks (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  layout text[] not null
);
alter table private.room_decks enable row level security;

create table private.layout_history (
  id bigserial primary key,
  board_id text not null,
  level_id text not null,
  hash text not null,
  played_at timestamptz not null default now()
);
create index layout_history_key on private.layout_history (board_id, level_id, id);
alter table private.layout_history enable row level security;

-- Realtime: both phones receive every change of their room.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers (private)
-- ---------------------------------------------------------------------------

-- Unbiased secure random integer in [0, max) — rejection sampling on 32-bit values.
create function private.random_int(max int) returns int
language plpgsql volatile set search_path = '' as $$
declare
  range bigint := 4294967296;
  lim bigint;
  b bytea;
  v bigint;
begin
  if max <= 0 then raise exception 'invalid_max'; end if;
  lim := range - (range % max);
  loop
    b := extensions.gen_random_bytes(4);
    v := (get_byte(b, 0)::bigint << 24) + (get_byte(b, 1) << 16) + (get_byte(b, 2) << 8) + get_byte(b, 3);
    if v < lim then return (v % max)::int; end if;
  end loop;
end $$;

-- Fisher–Yates shuffle.
create function private.shuffle(arr text[]) returns text[]
language plpgsql volatile set search_path = '' as $$
declare
  n int := coalesce(array_length(arr, 1), 0);
  j int;
  tmp text;
begin
  for i in reverse n..2 loop
    j := private.random_int(i) + 1;
    tmp := arr[i]; arr[i] := arr[j]; arr[j] := tmp;
  end loop;
  return arr;
end $$;

-- Deals a layout never used before for (board, level). When every layout has
-- been used (practically impossible for built-in boards), the history resets
-- but the 10 most recent layouts stay forbidden.
create function private.deal_layout(p_board_id text, p_level_id text) returns text[]
language plpgsql volatile set search_path = '' as $$
declare
  images text[];
  pairs int;
  chosen text[];
  layout text[];
  h text;
  attempt int := 0;
begin
  select image_ids into images from private.builtin_boards where board_id = p_board_id;
  select l.pairs into pairs from private.levels l where level_id = p_level_id;
  if images is null then raise exception 'unknown_board'; end if;
  if pairs is null then raise exception 'unknown_level'; end if;
  if array_length(images, 1) < pairs then raise exception 'board_too_small'; end if;

  loop
    attempt := attempt + 1;
    chosen := (private.shuffle(images))[1:pairs];
    layout := private.shuffle(chosen || chosen);
    h := encode(extensions.digest(array_to_json(layout)::text, 'sha256'), 'hex');
    exit when not exists (
      select 1 from private.layout_history
      where board_id = p_board_id and level_id = p_level_id and hash = h
    );
    if attempt = 200 then
      delete from private.layout_history
      where board_id = p_board_id and level_id = p_level_id
        and id not in (
          select id from private.layout_history
          where board_id = p_board_id and level_id = p_level_id
          order by id desc limit 10
        );
    end if;
    if attempt > 400 then raise exception 'deal_failed'; end if;
  end loop;

  insert into private.layout_history (board_id, level_id, hash) values (p_board_id, p_level_id, h);
  return layout;
end $$;

create function private.config_int(p_key text, p_default int) returns int
language sql stable set search_path = '' as $$
  select coalesce((select (value #>> '{}')::int from public.app_config where key = p_key), p_default);
$$;

-- a >= b for dotted numeric versions ("1.2.10" >= "1.2.9").
create function private.version_gte(a text, b text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  pa int[] := string_to_array(regexp_replace(coalesce(a, '0'), '[^0-9.]', '', 'g'), '.')::int[];
  pb int[] := string_to_array(regexp_replace(coalesce(b, '0'), '[^0-9.]', '', 'g'), '.')::int[];
begin
  for i in 1..greatest(coalesce(array_length(pa, 1), 0), coalesce(array_length(pb, 1), 0)) loop
    if coalesce(pa[i], 0) > coalesce(pb[i], 0) then return true; end if;
    if coalesce(pa[i], 0) < coalesce(pb[i], 0) then return false; end if;
  end loop;
  return true;
end $$;

create function private.assert_version(p_app_version text) returns void
language plpgsql stable set search_path = '' as $$
declare
  min_version text := (select value #>> '{}' from public.app_config where key = 'min_supported_version');
begin
  if min_version is not null and not private.version_gte(p_app_version, min_version) then
    raise exception 'update_required';
  end if;
end $$;

-- Nickname filter word lists (kept identical to src/features/online/nickname.ts by a test).
-- Whole-word list: short words that are also parts of normal names (e.g. "Michelle").
create function private.blocked_words() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'anal', 'anus', 'arse', 'ass', 'boob', 'boobs', 'butt', 'cock', 'crap', 'cum', 'damn', 'dick',
    'fag', 'hell', 'homo', 'jerk', 'kill', 'piss', 'poop', 'rape', 'sex', 'sexy', 'suck', 'tit',
    'tits', 'wtf'
  ]::text[];
$$;

-- Substring list: never acceptable anywhere in a name (spaces ignored).
create function private.blocked_fragments() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'bastard', 'bitch', 'cunt', 'dildo', 'fuck', 'hitler', 'nazi', 'nigga', 'nigger', 'penis',
    'porn', 'pussy', 'retard', 'shit', 'slut', 'twat', 'vagina', 'whore'
  ]::text[];
$$;

-- Folds look-alike characters: "Sh1t" → "shit". "1" can stand for "i" or "l",
-- so both readings are returned.
create function private.fold_word(p text) returns text[]
language sql immutable set search_path = '' as $$
  select array[
    regexp_replace(translate(lower(p), '03457@$!1', 'oeastasii'), '[^a-z]', '', 'g'),
    regexp_replace(translate(lower(p), '03457@$!1', 'oeastasil'), '[^a-z]', '', 'g')
  ];
$$;

-- Validates and cleans a nickname: 1–14 letters/digits/spaces, nothing offensive.
create function private.clean_nickname(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  cleaned text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  joined text[];
  token text;
  w text;
begin
  if char_length(cleaned) < 1 or char_length(cleaned) > 14 then raise exception 'invalid_nickname'; end if;
  if cleaned !~ '^[[:alnum:] ]+$' then raise exception 'invalid_nickname'; end if;
  foreach token in array string_to_array(cleaned, ' ') loop
    if private.fold_word(token) && private.blocked_words() then
      raise exception 'nickname_not_allowed';
    end if;
  end loop;
  joined := private.fold_word(cleaned);
  foreach w in array private.blocked_fragments() loop
    if position(w in joined[1]) > 0 or position(w in joined[2]) > 0 then
      raise exception 'nickname_not_allowed';
    end if;
  end loop;
  return cleaned;
end $$;

create function private.clean_avatar(p_avatar text) returns text
language sql immutable set search_path = '' as $$
  select case when p_avatar in (
    'fox', 'panda', 'frog', 'tiger', 'octopus', 'unicorn', 'monkey', 'penguin', 'owl', 'dino',
    'koala', 'bunny'
  ) then p_avatar else 'fox' end;
$$;

-- 6 characters without ambiguous ones (no O/0/I/1).
create function private.new_room_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, private.random_int(length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.rooms r where r.code = candidate);
  end loop;
  return candidate;
end $$;

-- Locks and returns the caller's room and seat (0 = host, 1 = guest).
create function private.lock_room(p_room_id uuid, out room public.rooms, out seat smallint)
language plpgsql volatile set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if room.host_id = uid then seat := 0;
  elsif room.guest_id = uid then seat := 1;
  else raise exception 'not_in_room';
  end if;
end $$;

-- Starts a new game in the room with a fresh never-used deal.
create function private.start_game(p_room_id uuid, p_starting smallint, p_now timestamptz)
returns void language plpgsql volatile set search_path = '' as $$
declare
  r public.rooms;
  layout text[];
  n int;
begin
  select * into r from public.rooms where id = p_room_id;
  layout := private.deal_layout(r.board_id, r.level_id);
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

-- Applies a pending match/mismatch (same rules as the TS engine's `resolve`).
create function private.apply_resolve(r public.rooms, p_now timestamptz) returns void
language plpgsql volatile set search_path = '' as $$
declare
  a int := r.flipped[1];
  b int := r.flipped[2];
  cur smallint := r.current_player;
  img text;
  v_cards jsonb := r.cards;
  v_found int;
  scores int[];
  win smallint;
begin
  if r.pending_result = 'match' then
    img := v_cards -> a ->> 'i';
    v_cards := jsonb_set(v_cards, array[a::text], jsonb_build_object('s', 'matched', 'i', img, 'm', cur));
    v_cards := jsonb_set(v_cards, array[b::text], jsonb_build_object('s', 'matched', 'i', img, 'm', cur));
    v_found := r.pairs_found + 1;
    if v_found = r.pairs_total then
      scores := array[
        jsonb_array_length(r.collected -> 0) + (case when cur = 0 then 1 else 0 end),
        jsonb_array_length(r.collected -> 1) + (case when cur = 1 then 1 else 0 end)
      ];
      win := case when scores[1] > scores[2] then 0 when scores[2] > scores[1] then 1 else -1 end;
    end if;
    update public.rooms set
      cards = v_cards,
      collected = jsonb_set(r.collected, array[cur::text], (r.collected -> cur::int) || to_jsonb(img)),
      pairs_found = v_found,
      flipped = '{}',
      pending_result = null,
      resolve_at = null,
      phase = case when v_found = r.pairs_total then 'finished' else 'awaitingFirst' end,
      status = case when v_found = r.pairs_total then 'finished' else r.status end,
      winner = win,
      end_reason = case when v_found = r.pairs_total then 'complete' else null end,
      turn_deadline = case when v_found = r.pairs_total then null
        else p_now + make_interval(secs => private.config_int('turn_seconds', 30)) end,
      version = r.version + 1,
      updated_at = p_now
    where id = r.id;
  else
    v_cards := jsonb_set(v_cards, array[a::text], jsonb_build_object('s', 'down', 'i', null, 'm', null));
    v_cards := jsonb_set(v_cards, array[b::text], jsonb_build_object('s', 'down', 'i', null, 'm', null));
    update public.rooms set
      cards = v_cards,
      flipped = '{}',
      pending_result = null,
      resolve_at = null,
      current_player = 1 - cur,
      phase = 'awaitingFirst',
      turn_deadline = p_now + make_interval(secs => private.config_int('turn_seconds', 30)),
      version = r.version + 1,
      updated_at = p_now
    where id = r.id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Public API (called by the app with supabase.rpc)
-- ---------------------------------------------------------------------------

create function public.server_time() returns timestamptz
language sql stable set search_path = '' as $$ select now(); $$;

create function public.create_room(
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
  -- One open room per host: close older waiting rooms.
  update public.rooms set status = 'closed', updated_at = now()
    where host_id = uid and status = 'waiting';
  insert into public.rooms (code, board_id, level_id, host_id, players)
  values (
    private.new_room_code(), p_board_id, p_level_id, uid,
    jsonb_build_array(jsonb_build_object(
      'name', private.clean_nickname(p_name), 'avatar', private.clean_avatar(p_avatar)))
  )
  returning * into r;
  return r;
end $$;

create function public.join_room(p_code text, p_name text, p_avatar text, p_app_version text)
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
  if r.guest_id is not null or r.status <> 'waiting' then raise exception 'room_full'; end if;
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

create function public.flip_card(p_room_id uuid, p_index int) returns public.rooms
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

-- Completes a pending pair once the reveal delay has passed (server time).
-- The player who missed may skip the rest of the mismatch delay (p_skip).
create function public.resolve_turn(p_room_id uuid, p_skip boolean default false)
returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.phase <> 'resolving' then return r; end if; -- already resolved (the other phone was faster)
  if now() < r.resolve_at and not (
    p_skip and r.pending_result = 'mismatch' and l.seat = r.current_player
  ) then
    raise exception 'too_early';
  end if;
  perform private.apply_resolve(r, now());
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- The turn timer ran out (checked against the server clock, never the phone's).
create function public.claim_timeout(p_room_id uuid) returns public.rooms
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
      current_player = 1 - r.current_player,
      phase = 'awaitingFirst',
      turn_deadline = now() + make_interval(secs => private.config_int('turn_seconds', 30)),
      version = r.version + 1,
      updated_at = now()
    where id = r.id;
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- "I'm still here" — every ~10 s. Returns the server time (for clock sync).
create function public.heartbeat(p_room_id uuid) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
begin
  select * into l from private.lock_room(p_room_id);
  if l.seat = 0 then
    update public.rooms set host_seen_at = now() where id = p_room_id;
  else
    update public.rooms set guest_seen_at = now() where id = p_room_id;
  end if;
  return now();
end $$;

-- After the grace period without heartbeats, the remaining player may take the win.
create function public.claim_disconnect_win(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  other_seen timestamptz;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status <> 'playing' then return r; end if;
  other_seen := case when l.seat = 0 then r.guest_seen_at else r.host_seen_at end;
  if other_seen is not null and now() - other_seen
     < make_interval(secs => private.config_int('disconnect_grace_seconds', 60)) then
    raise exception 'opponent_still_connected';
  end if;
  update public.rooms set
    status = 'finished', phase = 'finished', winner = l.seat, end_reason = 'disconnect',
    turn_deadline = null, resolve_at = null, version = r.version + 1, updated_at = now()
  where id = r.id;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- Leaving: a waiting room closes; a running game is forfeited to the opponent.
create function public.leave_room(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status = 'waiting' then
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

-- Both players ask → new server-side shuffle, and the other player starts.
create function public.request_rematch(p_room_id uuid) returns public.rooms
language plpgsql volatile security definer set search_path = '' as $$
declare
  l record;
  r public.rooms;
  wants smallint[];
begin
  select * into l from private.lock_room(p_room_id);
  r := l.room;
  if r.status <> 'finished' then raise exception 'game_not_finished'; end if;
  if r.guest_id is null then raise exception 'room_not_found'; end if;
  wants := array(select distinct unnest(r.rematch || array[l.seat]));
  if array_length(wants, 1) = 2 then
    perform private.start_game(r.id, (1 - r.starting_player)::smallint, now());
  else
    update public.rooms set rematch = wants, version = r.version + 1, updated_at = now() where id = r.id;
  end if;
  select * into r from public.rooms where id = r.id;
  return r;
end $$;

-- Removes stale rooms (and their decks). Scheduled with pg_cron.
create function private.cleanup_stale_rooms() returns int
language plpgsql volatile set search_path = '' as $$
declare
  n int;
begin
  delete from public.rooms
  where (status in ('waiting', 'closed') and updated_at < now() - interval '30 minutes')
     or (updated_at < now() - interval '3 hours');
  get diagnostics n = row_count;
  delete from private.layout_history
  where played_at < now() - interval '180 days';
  return n;
end $$;

-- Only signed-in (anonymous) users may call the game API.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.server_time(),
  public.create_room(text, text, text, text, text),
  public.join_room(text, text, text, text),
  public.flip_card(uuid, int),
  public.resolve_turn(uuid, boolean),
  public.claim_timeout(uuid),
  public.heartbeat(uuid),
  public.claim_disconnect_win(uuid),
  public.leave_room(uuid),
  public.request_rematch(uuid)
to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
