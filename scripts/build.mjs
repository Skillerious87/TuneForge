import { cp, mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
// Never remove a computed location outside this project's own build directory.
if (output !== resolve(root, 'dist') || !output.startsWith(root + sep)) throw new Error('Unsafe output directory');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('Refusing a symlinked build directory'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const pages = ['index.html', 'privacy.html', 'terms.html'];
const files = [...pages, '404.html', 'styles.css', 'app.js', 'config.js', '.nojekyll',
  'assets/brand.webp', 'assets/app-icon-256.webp', 'assets/favicon.png', 'assets/apple-touch-icon.png',
  'assets/TuneForge_Feature_Graphic_1024x500.png', 'assets/hero', 'assets/screens', 'assets/tools',
  'assets/fonts/inter.woff2', 'assets/fonts/inter-LICENSE.txt', 'assets/icons/LICENSE.txt'];
for (const file of files) {
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, file), destination, { recursive: true });
}

const configuredOrigin = process.env.SITE_URL;
if (configuredOrigin) {
  const site = new URL(configuredOrigin);
  if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.search || site.hash) throw new Error('SITE_URL must be an HTTP(S) site address without credentials, query or fragment.');
  const base = site.href.replace(/\/?$/, '/');
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const preview = new URL('assets/TuneForge_Feature_Graphic_1024x500.png', base).href;
  const urls = [];
  for (const page of pages) {
    const url = page === 'index.html' ? base : new URL(page, base).href;
    urls.push(url);
    const file = resolve(output, page);
    let html = await readFile(file, 'utf8');
    html = html.replaceAll('content="assets/TuneForge_Feature_Graphic_1024x500.png"', `content="${escape(preview)}"`);
    html = html.replace('</head>', `  <link rel="canonical" href="${escape(url)}">\n  <meta property="og:url" content="${escape(url)}">\n</head>`);
    await writeFile(file, html);
  }
  // GitHub Pages serves 404.html at whatever address was requested, so anchor its relative links to the site root.
  const notFoundFile = resolve(output, '404.html');
  const notFound = await readFile(notFoundFile, 'utf8');
  await writeFile(notFoundFile, notFound.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <base href="${escape(base)}">`));
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escape(url)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(resolve(output, 'sitemap.xml'), sitemap);
  await writeFile(resolve(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', base).href}\n`);
}
console.log('Built static TuneForge site in dist/.');
console.log(configuredOrigin ? 'Canonical URLs, absolute social previews, a root-anchored 404 page and a sitemap were generated.' : 'Set SITE_URL at build time to generate canonical URLs, absolute social metadata, a sitemap and a 404 page that works at any depth.');
