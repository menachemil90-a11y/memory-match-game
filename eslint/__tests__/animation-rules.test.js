/** @jest-environment node */
/* global describe, it, expect */
const { Linter } = require('eslint');
const tsParser = require('@typescript-eslint/parser');

const { animationRestrictions } = require('../animation-rules');

const linter = new Linter({ configType: 'flat' });
const lint = (code) =>
  linter.verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: { parser: tsParser },
        rules: { 'no-restricted-syntax': ['error', ...animationRestrictions] },
      },
    ],
    'src/x.tsx',
  );

describe('Reanimated sequence lint rule', () => {
  it('rejects a spring followed by more steps (the stuck turn banner)', () => {
    expect(
      lint('v.set(withSequence(withSpring(1, { damping: 12 }), withDelay(950, withTiming(0))));'),
    ).toHaveLength(1);
    expect(lint('v.set(withSequence(withSpring(1.3), withSpring(1)));')).toHaveLength(1);
  });

  it('allows a spring as the last step, timed pops and plain springs', () => {
    expect(lint('v.set(withSequence(withTiming(-90), withSpring(0)));')).toEqual([]);
    expect(lint('v.set(withSequence(popTo(1, 240), withDelay(700, withTiming(0))));')).toEqual([]);
    expect(lint('v.set(withSpring(1));')).toEqual([]);
  });
});
