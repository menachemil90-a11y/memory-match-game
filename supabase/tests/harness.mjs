// Test harness: a real Postgres (PGlite) with small stand-ins for what a
// Supabase project provides, running our actual migration files.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(here, '../migrations');
const require = createRequire(import.meta.url);

/** The app's TypeScript engine and nickname filter, compiled by `npm run test:server`. */
export const engine = require('./.build/game/index.js');
export const nickname = require('./.build/features/online/nickname.js');
export const secureRng = () => engine.createRandomSource((n) => new Uint8Array(randomBytes(n)));

export const HOST = '11111111-1111-4111-8111-111111111111';
export const GUEST = '22222222-2222-4222-8222-222222222222';
export const STRANGER = '33333333-3333-4333-8333-333333333333';
export const VERSION = '0.1.0';
/** First app version that can show photo rooms. */
export const PHOTO_VERSION = '0.3.0';

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema extensions;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- Like a real Supabase project: everything created in "public" is granted
  -- to the API roles by default. Migrations must revoke what they don't want.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  -- Supabase Storage: the API runs object queries as the caller's role, so
  -- storage.objects RLS decides who may upload, read (sign URLs) and delete.
  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz not null default now(),
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
  grant usage on schema public to service_role;
`;

export async function startTestServer() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }

  let queue = Promise.resolve();
  const serial = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const as = (uid, sql, params = []) =>
    serial(async () => {
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
      await db.exec('set role authenticated');
      try {
        return (await db.query(sql, params)).rows;
      } finally {
        await db.exec('reset role');
        await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
      }
    });

  const asRole = (role, sql, params = []) =>
    serial(async () => {
      await db.exec(`set role ${role}`);
      try {
        return (await db.query(sql, params)).rows;
      } finally {
        await db.exec('reset role');
      }
    });

  const asAnon = (sql) =>
    serial(async () => {
      await db.exec('set role anon');
      try {
        return (await db.query(sql)).rows;
      } finally {
        await db.exec('reset role');
      }
    });

  return {
    /** SQL as a visitor who is not signed in. */
    asAnon,
    /** SQL as another database role (e.g. the Edge Functions' service_role). */
    asRole,
    /** SQL as the database owner (setup / time travel). */
    admin: (sql, params = []) => serial(async () => (await db.query(sql, params)).rows),
    /** SQL as a signed-in anonymous user, through RLS and grants. */
    as,
    /** Calls an API function as a user; returns the room (or value) as JSON. */
    async rpc(uid, fn, args) {
      const names = Object.keys(args);
      const call = names.map((n, i) => `${n} => $${i + 1}`).join(', ');
      const rows = await as(uid, `select to_jsonb(${fn}(${call})) as r`, Object.values(args));
      return rows[0].r;
    },
    close: () => db.close(),
  };
}

export async function errorOf(promise) {
  try {
    await promise;
    return 'ok';
  } catch (e) {
    return e.message;
  }
}

/** Tiny `expect` shim over node:assert, so assertions read like the app's Jest tests. */
export function expect(actual) {
  const plain = (v) => JSON.parse(JSON.stringify(v));
  return {
    toBe: (v) => assert.equal(actual, v),
    toEqual: (v) => assert.deepEqual(plain(actual), plain(v)),
    toMatch: (re) => assert.match(String(actual), re),
    toHaveLength: (n) => assert.equal(actual.length, n),
    toBeGreaterThanOrEqual: (n) => assert.ok(actual >= n, `${actual} >= ${n}`),
    toMatchObject: (o) => {
      for (const [k, v] of Object.entries(o)) assert.deepEqual(plain(actual[k]), plain(v), k);
    },
    not: {
      toBe: (v) => assert.notEqual(actual, v),
      toEqual: (v) => assert.notDeepEqual(plain(actual), plain(v)),
    },
  };
}
