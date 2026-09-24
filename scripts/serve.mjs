import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url, 'http://localhost');
    let relative = decodeURIComponent(url.pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    const path = resolve(root, `.${relative}`);
    if (!path.startsWith(root + sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { response.writeHead(403); response.end('Forbidden'); return; }
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : await readFile(path));
  } catch {
    // Mirror GitHub Pages: unknown paths get the custom 404 page, anchored to the site root.
    try {
      const page = (await readFile(resolve(root, '404.html'), 'utf8')).replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base href="/">');
      response.writeHead(404, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : page);
    } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); }
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`TuneForge preview: http://127.0.0.1:${port}`));
