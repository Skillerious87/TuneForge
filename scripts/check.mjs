import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'privacy.html', 'terms.html', '404.html'];
const failures = [];
const warnings = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const parsed = new Map();
for (const page of pages) parsed.set(page, parseHTML(await readFile(resolve(root, page), 'utf8')).document);
const idsOf = document => [...document.querySelectorAll('[id]')].map(element => element.id);
const assets = new Set();
let linkCount = 0;

for (const [page, document] of parsed) {
  const ids = idsOf(document);
  check(new Set(ids).size === ids.length, `${page}: duplicate element IDs.`);
  check(document.querySelectorAll('h1').length === 1, `${page}: expected exactly one h1.`);
  check(document.documentElement.getAttribute('lang') === 'en', `${page}: missing document language.`);
  check(Boolean(document.querySelector('title')?.textContent.trim()), `${page}: missing title.`);
  check(Boolean(document.querySelector('meta[name="description"]')?.getAttribute('content')), `${page}: missing description.`);
  check(Boolean(document.querySelector('meta[name="viewport"]')), `${page}: missing viewport.`);

  for (const element of document.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby], label[for]')) {
    for (const attribute of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for']) {
      const value = element.getAttribute(attribute);
      if (value) for (const id of value.split(/\s+/)) check(ids.includes(id), `${page}: missing ${attribute} target "${id}".`);
    }
  }
  for (const use of document.querySelectorAll('use')) {
    const target = use.getAttribute('href') || '';
    check(target.startsWith('#') && ids.includes(target.slice(1)), `${page}: icon "${target}" is not defined on the page.`);
  }
  for (const image of document.querySelectorAll('img')) {
    check(image.hasAttribute('alt'), `${page}: missing alt text on ${image.getAttribute('src')}.`);
    check(image.hasAttribute('width') && image.hasAttribute('height'), `${page}: missing dimensions on ${image.getAttribute('src')}.`);
  }

  // Every in-site link must reach a real page and, where it names one, a real section.
  for (const link of document.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;
    linkCount++;
    const [path, hash] = href.split('#');
    const target = path === '' ? page : path === './' ? 'index.html' : posix.normalize(path);
    const targetDocument = parsed.get(target);
    check(Boolean(targetDocument), `${page}: link to unknown page "${href}".`);
    if (targetDocument && hash) check(idsOf(targetDocument).includes(hash), `${page}: broken link "${href}".`);
  }

  // Local files only: the Privacy Policy promises that pages make no third-party requests.
  for (const element of document.querySelectorAll('[src], link[href], source[srcset], img[srcset]')) {
    const references = element.tagName === 'LINK' ? [element.getAttribute('href')] : [element.getAttribute('src'), ...(element.getAttribute('srcset') || '').split(',').map(part => part.trim().split(/\s+/)[0])];
    for (const reference of references.filter(Boolean)) {
      if (/^(https?:)?\/\//.test(reference)) failures.push(`${page}: loads an external resource (${reference}).`);
      else if (!reference.startsWith('data:')) assets.add(reference);
    }
  }
  for (const style of document.querySelectorAll('style')) {
    for (const match of style.textContent.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) if (!match[1].startsWith('data:') && !match[1].startsWith('#')) assets.add(match[1]);
  }
}

const css = await readFile(resolve(root, 'styles.css'), 'utf8');
for (const match of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) if (!match[1].startsWith('data:')) assets.add(match[1]);
check(!/@import|https?:\/\//.test(css), 'styles.css must not load anything from another site.');
for (const file of assets) {
  try { check((await stat(resolve(root, file))).isFile(), `Not a file: ${file}`); }
  catch { failures.push(`Missing asset: ${file}`); }
}
try { check((await readFile(resolve(root, 'assets/fonts/inter.woff2'))).subarray(0, 4).toString() === 'wOF2', 'Inter is not a WOFF2 font.'); }
catch { failures.push('Cannot read assets/fonts/inter.woff2'); }

for (const file of ['app.js', 'config.js', 'scripts/build.mjs', 'scripts/serve.mjs', 'scripts/check.mjs']) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' });
  check(result.status === 0, `JavaScript syntax error in ${file}: ${result.stderr}`);
}
// The Privacy Policy says the site stores nothing in the browser and runs no trackers or audio capture.
const script = await readFile(resolve(root, 'app.js'), 'utf8');
for (const [pattern, reason] of [
  [/localStorage|sessionStorage|indexedDB|document\.cookie/, 'browser storage or cookies'],
  [/getUserMedia|AudioContext/, 'microphone or audio code'],
  [/googletagmanager|google-analytics|gtag\(|analytics|fetch\(|XMLHttpRequest|sendBeacon/, 'analytics or network requests'],
]) check(!pattern.test(script), `app.js must not use ${reason}; the Privacy Policy says the website doesn’t.`);

const sandbox = { window: {} };
runInNewContext(await readFile(resolve(root, 'config.js'), 'utf8'), sandbox);
const config = sandbox.window.TUNEFORGE_CONFIG || {};
if (!config.contactEmail) warnings.push('config.js: contactEmail is empty, so the legal pages point people to your Google Play listing. Add a contact email before publishing.');
if (!config.developerName) warnings.push('config.js: developerName is empty, so the legal pages describe the publisher generically. Add your name or company name.');
if (!config.playStoreUrl) warnings.push('config.js: playStoreUrl is empty, so download buttons show “Coming soon to Google Play”.');

if (failures.length) { failures.forEach(message => console.error(`FAIL: ${message}`)); process.exitCode = 1; }
else console.log(`Checked ${pages.length} pages: ${linkCount} internal links, ${assets.size} local assets, IDs, headings, icons, accessibility references, image dimensions, font format, script syntax and privacy promises.`);
warnings.forEach(message => console.warn(`Note: ${message}`));
