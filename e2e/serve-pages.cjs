/**
 * Serves the web export (dist/web) the way the static host does, for local tests:
 * - under the site's sub-path (e.g. http://localhost:8099/memory-match-game/);
 * - a folder serves its index.html (…/join/?c=CODE → join/index.html, 200);
 * - anything else that doesn't exist serves 404.html with status 404 (the SPA
 *   fallback that makes fresh deep links like …/online/CODE work);
 * - no special headers (the host doesn't send COOP/COEP, so neither do we);
 * - nothing under a node_modules folder (the uploader skips those).
 *
 * Usage: node e2e/serve-pages.cjs dist/web /memory-match-game [port]
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? 'dist/web');
const base = (process.argv[3] ?? '/memory-match-game').replace(/\/$/, '');
const port = Number(process.argv[4] ?? 8099);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.svg': 'image/svg+xml',
};

function send(res, status, file) {
  res.writeHead(status, {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
  });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(`${base}/`) && url.pathname !== base) {
      res.writeHead(404).end('Not on this site');
      return;
    }
    if (url.pathname === base) {
      res.writeHead(301, { Location: `${base}/${url.search}` }).end();
      return;
    }
    const rel = decodeURIComponent(url.pathname.slice(base.length));
    // Like the live host: Cloudflare's uploader never uploads node_modules folders.
    if (rel.split('/').includes('node_modules')) {
      send(res, 404, path.join(root, '404.html'));
      return;
    }
    let file = path.join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(400).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    if (fs.existsSync(file) && fs.statSync(file).isFile()) send(res, 200, file);
    else send(res, 404, path.join(root, '404.html'));
  })
  .listen(port, () => console.log(`Serving ${root} at http://localhost:${port}${base}/`));
