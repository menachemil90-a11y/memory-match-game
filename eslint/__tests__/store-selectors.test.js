/** @jest-environment node */
/* global describe, it, expect, __dirname */
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const { Linter } = require('eslint');
const tsParser = require('@typescript-eslint/parser');

const { STORE_HOOKS, storeSelectorRestrictions } = require('../store-selectors');

const linter = new Linter({ configType: 'flat' });
const config = [
  {
    files: ['**/*.tsx'],
    languageOptions: { parser: tsParser },
    rules: { 'no-restricted-syntax': ['error', ...storeSelectorRestrictions] },
  },
];
const lint = (code) =>
  linter.verify(code, config, 'src/app/example.tsx').map((m) => m.message.slice(0, 40));

describe('store selector lint rule', () => {
  it.each([
    ['the board-editor freeze', 'useCustomBoards((s) => s.missing[id] ?? [])'],
    ['a fallback object', 'useSettingsStore((s) => s.prefs ?? {})'],
    ['an object literal', 'usePlayersStore((s) => ({ a: s.a, b: s.b }))'],
    ['filter', 'useCustomBoards((s) => s.boards.filter((b) => b.ok))'],
    ['map', 'useOnline((s) => s.players.map((p) => p.name))'],
    ['spread', 'useGameSession((s) => [...s.moves])'],
    ['Object.keys', 'useCustomBoards((s) => Object.keys(s.byId))'],
    ['a new Set', 'useCustomBoards((s) => new Set(s.ids))'],
    ['a function selector', 'useCustomBoards(function (s) { return s.boards.slice(1); })'],
  ])('rejects %s', (_name, call) => {
    expect(lint(`const x = ${call};`)).toHaveLength(1);
  });

  it.each([
    ['a stored value', 'useCustomBoards((s) => s.boards)'],
    [
      'a lookup returning a stored object',
      'useCustomBoards((s) => s.boards.find((b) => b.id === id))',
    ],
    ['a primitive', 'useCustomBoards((s) => s.boards.length)'],
    ['an action', 'useCustomBoards((s) => s.deleteBoard)'],
    ['getState() outside React', 'const all = useCustomBoards.getState().boards.map((b) => b.id)'],
    ['other hooks', 'const v = useMemo(() => items.filter(Boolean), [items])'],
  ])('allows %s', (_name, code) => {
    expect(lint(code.startsWith('const') ? code : `const x = ${code};`)).toEqual([]);
  });
});

describe('store registry', () => {
  const files = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path);
      return /\.tsx?$/.test(name) ? [path] : [];
    });

  it('lists every zustand store in src/, so the rule covers new stores too', () => {
    const found = files(join(__dirname, '../../src'))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/export const (use\w+) = create\b/g)])
      .map((m) => m[1])
      .sort();
    expect(found.length).toBeGreaterThan(0);
    expect([...STORE_HOOKS].sort()).toEqual(found);
  });
});
