// Leonida Trophy Guide — a tiny static server for trying the guide locally.
// Serves app/ at its root on http://localhost:8080. Node 22, standard library
// only: `node serve.ts`. The guide itself makes no network requests, so this
// server is only a convenience for the browser.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'app');
const port = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  let path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (path.endsWith('/')) path = join(path, 'index.html');
  if (!existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
});

server.listen(port, () => {
  console.log(`Leonida Trophy Guide at http://localhost:${port}/`);
});
