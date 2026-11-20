#!/usr/bin/env node
/**
 * Builds the CAPTURE-ONLY web version of the full app into promo/out/capture-web
 * (see metro-capture.cjs). For filming only: never deployed, never in git.
 * Serve it with promo/capture/serve.cjs (it sends the headers SQLite needs).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'promo', 'out', 'capture-web');
const result = spawnSync(
  'npx',
  ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PROMO_CAPTURE: '1' } },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Capture build ready in ${OUT}`);
