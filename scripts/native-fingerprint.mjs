#!/usr/bin/env node
/**
 * Prints the fingerprint of the app's native layer and the app version as JSON:
 *   {"fingerprint":"<sha1>","version":"0.4.0"}
 *
 * The same code with the same native layer gives the same fingerprint wherever
 * it runs: the per-build settings that app.config.js reads from the environment
 * (build number, update channel, releases repo, web base path) are removed first,
 * and fingerprint.config.js skips build-independent sources.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFingerprintAsync } from '@expo/fingerprint';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const key of [
  'APK_BUILD_NUMBER',
  'APK_RELEASES_REPO',
  'EXPO_UPDATES_CHANNEL',
  'WEB_BASE_PATH',
]) {
  delete process.env[key];
}

const { hash } = await createFingerprintAsync(ROOT, { silent: true });
const { version } = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo;
console.log(JSON.stringify({ fingerprint: hash, version }));
