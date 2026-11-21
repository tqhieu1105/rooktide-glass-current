import { createServer } from 'node:http';
import { readFileSync, statSync, realpathSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const root = realpathSync(resolve(process.env.GAME_DIR || 'game'));
const port = Number(process.env.PORT || 8080);
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    const path = realpathSync(resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));
    if (!path.startsWith(root + sep) || !statSync(path).isFile()) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(path));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Rooktide static files: http://127.0.0.1:${port}`));
