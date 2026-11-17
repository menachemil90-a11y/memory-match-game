const http = require('http'),
  fs = require('fs'),
  path = require('path');
const root = process.argv[2];
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
};
http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(root, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      f = fs.existsSync(f + '.html') ? f + '.html' : path.join(root, 'index.html');
    }
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  })
  .listen(8099);
