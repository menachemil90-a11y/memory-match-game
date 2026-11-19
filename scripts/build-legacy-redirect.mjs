#!/usr/bin/env node
/**
 * Builds the web game's old address (GitHub Pages, LEGACY_WEB_GAME_URL in
 * src/lib/links.ts) as a forwarder to WEB_GAME_URL: `node scripts/build-legacy-redirect.mjs`
 * → dist/legacy.
 *
 * Invite links sent before the move (…/memory-match-game/join/?c=CODE) and apps
 * not yet updated keep working: every page there sends the browser to the same
 * path, query and hash on the new site (…/join/?c=CODE → WEB_GAME_URL/join/?c=CODE).
 * The pages keep the link-preview tags, so old links still look right in chats.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'legacy');

function link(name) {
  const links = readFileSync(join(ROOT, 'src/lib/links.ts'), 'utf8');
  const match = new RegExp(`export const ${name} =\\s*'([^']+)'`).exec(links);
  if (!match) throw new Error(`${name} not found in src/lib/links.ts`);
  return new URL(match[1]);
}

const site = link('WEB_GAME_URL');
const legacy = link('LEGACY_WEB_GAME_URL');
const target = site.href.replace(/\/$/, '');
const oldBase = legacy.pathname.replace(/\/$/, '');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Memory Match</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${target}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Memory Match" />
    <meta property="og:title" content="Play Memory Match with me! 🃏" />
    <meta property="og:description" content="Tap to play a family memory game with me right in your browser — no download needed." />
    <meta property="og:url" content="${target}/" />
    <meta property="og:image" content="${target}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <script>
      (function () {
        var path = location.pathname;
        if (path.indexOf(${JSON.stringify(oldBase)}) === 0) path = path.slice(${oldBase.length});
        location.replace(${JSON.stringify(target)} + (path || '/') + location.search + location.hash);
      })();
    </script>
    <noscript><meta http-equiv="refresh" content="0; url=${target}/" /></noscript>
  </head>
  <body>
    <p>Memory Match has moved: <a href="${target}/">${site.host}</a></p>
  </body>
</html>
`;

// index.html, the invite page (a real 200 page, for link previews) and 404.html
// for everything else (room links, other routes).
for (const dir of ['', 'join']) {
  mkdirSync(join(OUT, dir), { recursive: true });
  writeFileSync(join(OUT, dir, 'index.html'), html);
}
writeFileSync(join(OUT, '404.html'), html);
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`Old address ${legacy.href} forwards to ${target} (dist/legacy)`);
