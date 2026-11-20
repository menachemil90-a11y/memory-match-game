/**
 * Serves a web export for filming: SPA fallback to index.html and the
 * cross-origin isolation headers that SQLite (expo-sqlite on the web) needs.
 * Usage: node promo/capture/serve.cjs <dir> <port>
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 8098);
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
  '.wasm': 'application/wasm',
};
http
  .createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, rel);
    if (!file.startsWith(root)) return res.writeHead(400).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) file = path.join(root, 'index.html');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Capture build at http://localhost:${port}/`));
