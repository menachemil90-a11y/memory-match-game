#!/usr/bin/env node
/**
 * Builds the web game for Cloudflare Pages: `npm run build:web` → dist/web.
 *
 * 1. Exports the Expo Router app for the web (single-page app) under the path
 *    of WEB_GAME_URL (src/lib/links.ts) — the site root today, a sub-path works too.
 * 2. The host serves files only, so it adds copies of index.html:
 *    - <route>/index.html for every fixed route (online/, settings/, join/ …):
 *      opened fresh they are real pages (HTTP 200). The invite link
 *      (…/join/?c=CODE) is one of them, so chat apps show the link preview, and
 *      the app routes it into the room (src/app/join.tsx);
 *    - 404.html: routes with a room code (…/online/CODE, e.g. after a reload
 *      during a game) can't be files; GitHub Pages answers them with 404.html,
 *      which loads the game, and the game shows the right screen.
 * 3. Writes _redirects: APP_DOWNLOAD_URL (…/download) → APK_RELEASE_URL.
 * 4. Moves assets/node_modules (fonts, icons) to assets/vendor: Cloudflare's
 *    uploader (wrangler pages deploy) never uploads a folder named node_modules.
 * 5. Checks the result (base path, link-preview tags, no SQLite in the bundle).
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'web');

/** A link from src/lib/links.ts, the one place they are configured. */
function link(name) {
  const links = readFileSync(join(ROOT, 'src/lib/links.ts'), 'utf8');
  const match = new RegExp(`export const ${name} =\\s*'([^']+)'`).exec(links);
  if (!match) throw new Error(`${name} not found in src/lib/links.ts`);
  return new URL(match[1]);
}

function fail(message) {
  console.error(`build-web: ${message}`);
  process.exit(1);
}

const site = link('WEB_GAME_URL');
const basePath = site.pathname.replace(/\/$/, '');
console.log(`Building the web game for ${site.href} (base path ${basePath})`);

const result = spawnSync(
  'npx',
  ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, WEB_BASE_PATH: basePath } },
);
if (result.status !== 0) fail(`expo export failed (exit ${result.status})`);

// Fonts and icons from packages are exported to assets/node_modules/…; the
// uploader skips every node_modules folder, so the live site would have none.
const VENDOR_FROM = `${basePath}/assets/node_modules/`;
const VENDOR_TO = `${basePath}/assets/vendor/`;
if (existsSync(join(OUT, 'assets', 'node_modules'))) {
  renameSync(join(OUT, 'assets', 'node_modules'), join(OUT, 'assets', 'vendor'));
}
/** Every file under dir (relative paths). */
function files(dir, prefix = '') {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(dir, join(prefix, e.name)) : [join(prefix, e.name)],
  );
}
for (const file of files(OUT)) {
  if (file.split(/[\\/]/).includes('node_modules')) fail(`still under node_modules: ${file}`);
  if (!/\.(js|html|json|css|map)$/.test(file)) continue;
  const text = readFileSync(join(OUT, file), 'utf8');
  if (text.includes(VENDOR_FROM))
    writeFileSync(join(OUT, file), text.split(VENDOR_FROM).join(VENDOR_TO));
}
for (const file of files(OUT).filter((f) => /\.(js|html|json|css)$/.test(f))) {
  if (readFileSync(join(OUT, file), 'utf8').includes(VENDOR_FROM)) {
    fail(`${file} still points at ${VENDOR_FROM}`);
  }
}

const index = join(OUT, 'index.html');
const html = readFileSync(index, 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
if (scripts.length === 0) fail('index.html has no scripts');
for (const src of scripts) {
  if (!src.startsWith(`${basePath}/`)) fail(`script not under ${basePath}: ${src}`);
}
for (const tag of ['og:title', 'og:image', 'og:description', 'og:url']) {
  if (!html.includes(`property="${tag}"`)) fail(`index.html is missing ${tag}`);
}
if (!html.includes(`${site.origin}${basePath}/og-image.png`)) fail('og:image is not on this site');
if (!existsSync(join(OUT, 'og-image.png'))) fail('og-image.png was not exported');

// SQLite needs cross-origin isolation headers that GitHub Pages can't send; the
// web game must not contain it (see src/lib/kvStorage.web.ts, src/lib/db/index.web.ts).
const jsDir = join(OUT, '_expo', 'static', 'js', 'web');
for (const file of readdirSync(jsDir)) {
  const code = readFileSync(join(jsDir, file), 'utf8');
  if (/ExpoSQLite|wa-sqlite/.test(code)) fail(`${file} contains SQLite`);
}

/** Fixed (non-dynamic) routes of the Expo Router app, e.g. ["online", "settings/privacy"]. */
function staticRoutes(dir = join(ROOT, 'src', 'app'), prefix = '') {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    if (name.startsWith('_') || name.startsWith('+') || name.includes('[')) continue;
    if (entry.isDirectory()) {
      routes.push(...staticRoutes(join(dir, name), `${prefix}${name}/`));
    } else if (/\.tsx$/.test(name) && !/\.(web|native|ios|android)\.tsx$/.test(name)) {
      const route = name.replace(/\.tsx$/, '');
      const path = route === 'index' ? prefix.replace(/\/$/, '') : `${prefix}${route}`;
      if (path) routes.push(path);
    }
  }
  return routes;
}

const routes = staticRoutes();
if (!routes.includes('join')) fail('the join route (invite links) is missing');
for (const route of routes) {
  mkdirSync(join(OUT, route), { recursive: true });
  copyFileSync(index, join(OUT, route, 'index.html'));
}
copyFileSync(index, join(OUT, '404.html'));
console.log(`Pages for ${routes.length} routes: ${routes.join(', ')}`);

// "Download the app" → the newest APK (a 302, so the target can change any time).
const download = link('APP_DOWNLOAD_URL');
const apk = link('APK_RELEASE_URL');
if (download.origin !== site.origin || !download.pathname.startsWith(`${basePath}/`)) {
  fail(`APP_DOWNLOAD_URL is not on the web game's site: ${download.href}`);
}
writeFileSync(join(OUT, '_redirects'), `${download.pathname} ${apk.href} 302\n`);
console.log(`Redirect: ${download.pathname} → ${apk.href}`);
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`Web game ready in ${OUT}`);
