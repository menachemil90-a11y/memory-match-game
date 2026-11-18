// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

const { storeSelectorRestrictions } = require('./eslint/store-selectors');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'android/*',
      'ios/*',
      'node_modules/*',
      'supabase/functions/*',
      'supabase/tests/.build/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the crypto-secure RNG in src/game (expo-crypto) instead of Math.random.',
        },
      ],
      'no-restricted-syntax': ['error', ...storeSelectorRestrictions],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    ignores: ['src/game/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@/*', 'node:*'],
              message: 'src/game is a pure engine: no React, Expo, Node or app imports.',
            },
          ],
        },
      ],
    },
  },
]);
