/** @jest-environment node */
/* global describe, it, expect */
const { Linter } = require('eslint');
const tsParser = require('@typescript-eslint/parser');

const { springRestrictions } = require('../animation-rules');

const linter = new Linter({ configType: 'flat' });
const lint = (code) =>
  linter.verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        languageOptions: { parser: tsParser },
        rules: { 'no-restricted-syntax': ['error', ...springRestrictions] },
      },
    ],
    'src/x.tsx',
  );

describe('spring settings lint rule', () => {
  it('rejects layout springs (the wobbling dialog)', () => {
    expect(lint('<Animated.View entering={ZoomIn.springify().damping(14)} />;')).toHaveLength(1);
    expect(lint('<Animated.View entering={ZoomIn.delay(1100).springify()} />;')).toHaveLength(1);
  });

  it('rejects inline spring configs', () => {
    expect(lint('v.set(withSpring(1, { damping: 7, stiffness: 180 }));')).toHaveLength(1);
    expect(lint('v.set(withSpring(0, { damping: 9 }));')).toHaveLength(1);
  });

  it('allows the shared springs and timed pop-ins', () => {
    expect(lint('v.set(withSpring(1, springs.settle));')).toEqual([]);
    expect(lint('<Animated.View entering={popupEntering} />;')).toEqual([]);
    expect(lint('<Animated.View entering={FadeIn.duration(150)} />;')).toEqual([]);
  });
});
