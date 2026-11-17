import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { nickname, startTestServer } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '../migrations/20261117000001_online_core.sql'), 'utf8');
function sqlList(fn) {
  const body = SQL.slice(SQL.indexOf(`function private.${fn}()`));
  const arr = body.slice(body.indexOf('array['), body.indexOf(']::text[]'));
  return [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const SAMPLES = [
  ['Noa', true],
  ['Grandma Rose', true],
  ['Michelle', true],
  ['Cassandra', true],
  ['Skill Master', true],
  ['Ben 10', true],
  ['שירה', true],
  ['', false],
  ['A very long nickname', false],
  ['Noa!', false],
  ['hell', false],
  ['Sh1t head', false],
  ['f u c k', false],
  ['ass', false],
  ['B1TCH', false],
];

describe('nickname filter', () => {
  let server;
  before(async () => (server = await startTestServer()));
  after(() => server.close());

  it('uses the same word lists on client and server', () => {
    assert.deepEqual(sqlList('blocked_words'), [...nickname.BLOCKED_WORDS]);
    assert.deepEqual(sqlList('blocked_fragments'), [...nickname.BLOCKED_FRAGMENTS]);
  });

  for (const [name, allowed] of SAMPLES) {
    it(`client and server agree: ${JSON.stringify(name)} → ${allowed ? 'allowed' : 'blocked'}`, async () => {
      assert.equal(nickname.checkNickname(name).ok, allowed);
      // PGlite's default locale only classifies ASCII letters; the hosted DB is UTF-8.
      if (/[^\x00-\x7F]/.test(name)) return;
      let ok = true;
      await server.admin('select private.clean_nickname($1)', [name]).catch(() => (ok = false));
      assert.equal(ok, allowed);
    });
  }
});
