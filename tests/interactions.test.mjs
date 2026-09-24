import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const [home, privacy, terms, app] = await Promise.all(['index.html', 'privacy.html', 'terms.html', 'app.js'].map(read));
const storeUrl = 'https://play.google.com/store/apps/details?id=example.tuneforge';

function load(html, { config = {}, reducedMotion = true } = {}) {
  const { window, document } = parseHTML(html);
  const storageAccess = [];
  // Any use of browser storage is a failure: the Privacy Policy says the website stores nothing.
  const storage = new Proxy({}, { get(_, key) { storageAccess.push(String(key)); throw new Error('Browser storage must not be used'); } });
  window.TUNEFORGE_CONFIG = config;
  window.print = () => { window.printed = true; };
  runInNewContext(app, {
    window, document, URL, console,
    localStorage: storage, sessionStorage: storage,
    scrollY: 0, innerHeight: 900,
    matchMedia: query => ({ matches: reducedMotion && query.includes('reduced-motion'), addEventListener() {} }),
    requestAnimationFrame: callback => callback(0),
    addEventListener() {},
    setTimeout: () => 0,
    performance: { now: () => 0 },
  });
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const fire = (target, type = 'click', properties = {}) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, properties);
    (typeof target === 'string' ? $(target) : target).dispatchEvent(event);
  };
  return { window, document, $, $$, fire, storageAccess };
}

test('download buttons start in an honest coming-soon state', () => {
  const page = load(home);
  assert.deepEqual(page.$$('[data-store-link]').map(link => link.getAttribute('href')), ['#download', '#download', '#download', '#release-status', '#download']);
  assert.ok(page.$$('[data-store-kicker]').every(element => element.textContent === 'Coming soon to'));
  assert.match(page.$('#release-status').textContent, /getting ready for Google Play/);
  assert.match(page.$('#faq-release-copy').textContent, /coming soon/);
});

test('a real Google Play listing switches every download button to the store', () => {
  const page = load(home, { config: { playStoreUrl: storeUrl } });
  for (const link of page.$$('[data-store-link]')) {
    assert.equal(link.getAttribute('href'), storeUrl);
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  }
  assert.ok(page.$$('[data-store-kicker]').every(element => element.textContent === 'Get it on'));
  assert.match(page.$('#faq-release-copy').textContent, /available for Android/);
  const legal = load(privacy, { config: { playStoreUrl: storeUrl } });
  assert.ok(legal.$$('[data-store-link]').every(link => link.getAttribute('href') === storeUrl));
});

test('invalid or unrelated store links keep the coming-soon state', () => {
  for (const playStoreUrl of ['javascript:alert(1)', 'https://example.com/app', 'http://play.google.com/store/apps/details?id=x', 'https://play.google.com/store/apps/details', 'not a url']) {
    const page = load(home, { config: { playStoreUrl } });
    assert.equal(page.$('.header-cta').getAttribute('href'), '#download');
    assert.equal(page.$('[data-store-kicker]').textContent, 'Coming soon to');
  }
});

test('the mobile menu opens, closes after navigating and closes with Escape', () => {
  const page = load(home);
  const toggle = page.$('.menu-toggle');
  page.fire(toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.getAttribute('aria-label'), 'Close menu');
  assert.equal(page.$('#mobile-menu').hasAttribute('hidden'), false);
  assert.ok(page.document.body.classList.contains('menu-open'));
  page.fire('#mobile-menu a');
  assert.equal(page.$('#mobile-menu').hasAttribute('hidden'), true);
  assert.equal(page.document.body.classList.contains('menu-open'), false);
  page.fire(toggle);
  page.fire(page.document, 'keydown', { key: 'Escape' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(page.$('#mobile-menu').hasAttribute('hidden'), true);
});

test('each tuning tab shows its own screen and keeps the tab semantics in step', () => {
  const page = load(home);
  const tabs = page.$$('[role="tab"]');
  assert.equal(tabs.length, 4);
  for (const tab of [...tabs.slice(1), tabs[0]]) {
    page.fire(tab);
    assert.deepEqual(tabs.map(item => item.getAttribute('aria-selected')), tabs.map(item => String(item === tab)));
    assert.deepEqual(tabs.map(item => item.getAttribute('tabindex')), tabs.map(item => (item === tab ? '0' : '-1')));
    assert.equal(page.$('#tunings-panel').getAttribute('aria-labelledby'), tab.id);
    const screens = page.$$('#tunings-panel [data-screen]');
    const active = screens.filter(screen => screen.classList.contains('is-active'));
    assert.equal(active.length, 1);
    assert.equal(active[0].dataset.screen, tab.dataset.screen);
    assert.equal(active[0].hasAttribute('aria-hidden'), false);
    assert.ok(screens.filter(screen => screen !== active[0]).every(screen => screen.getAttribute('aria-hidden') === 'true'));
  }
});

test('tuning tabs support arrow keys, Home and End, wrapping at the ends', () => {
  const page = load(home);
  const selected = () => page.$('[role="tab"][aria-selected="true"]').id;
  page.fire('#tab-guitar', 'keydown', { key: 'ArrowDown' });
  assert.equal(selected(), 'tab-alternate');
  page.fire('#tab-alternate', 'keydown', { key: 'End' });
  assert.equal(selected(), 'tab-custom');
  page.fire('#tab-custom', 'keydown', { key: 'ArrowRight' });
  assert.equal(selected(), 'tab-guitar');
  page.fire('#tab-guitar', 'keydown', { key: 'ArrowUp' });
  assert.equal(selected(), 'tab-custom');
  page.fire('#tab-custom', 'keydown', { key: 'Home' });
  assert.equal(selected(), 'tab-guitar');
});

test('the accent preview tints only its own section and is never saved', () => {
  const page = load(home);
  page.fire('.swatch[data-colour="#f5b940"]');
  assert.deepEqual(page.$$('.swatch[aria-pressed="true"]').map(swatch => swatch.textContent.trim()), ['Amber']);
  assert.equal(page.$('#appearance').style.getPropertyValue('--tint'), '#f5b940');
  assert.equal(page.$('#swatch-name').textContent, 'Amber');
  assert.equal(page.document.documentElement.style.getPropertyValue('--tint'), '');
  assert.deepEqual(page.storageAccess, []);
});

test('with reduced motion, content is revealed and the hero pill rests in tune', () => {
  const page = load(home);
  assert.ok(page.$$('.reveal').every(element => element.classList.contains('is-visible')));
  assert.ok(page.$('.hero-pill').classList.contains('is-in-tune'));
  assert.equal(page.$('.hero-pill-label').textContent, 'In tune');
  assert.equal(page.$('.hero-pill-cents').textContent, '0.0¢');
});

test('the footer year stays current on every page', () => {
  for (const html of [home, privacy, terms]) {
    const page = load(html);
    assert.equal(page.$('[data-year]').textContent, String(new Date().getFullYear()));
  }
});

test('legal pages show configured contact, publisher and governing-law details', () => {
  const config = { contactEmail: ' hello@example.com ', developerName: 'Example Studio Ltd', governingLaw: 'England and Wales' };
  const page = load(privacy, { config });
  const email = page.$('[data-contact-email]');
  assert.equal(email.textContent, 'hello@example.com');
  assert.equal(email.getAttribute('href'), 'mailto:hello@example.com');
  assert.ok(page.$$('[data-if-contact]').every(element => !element.hasAttribute('hidden')));
  assert.ok(page.$$('[data-if-no-contact]').every(element => element.hasAttribute('hidden')));
  assert.ok(page.$$('[data-developer-name]').every(element => element.textContent === 'Example Studio Ltd'));
  assert.equal(page.$('[data-contact-link]').getAttribute('href'), 'mailto:hello@example.com');
  const agreement = load(terms, { config });
  assert.equal(agreement.$('[data-governing-law]').textContent, 'England and Wales');
  assert.match(agreement.$('#about').textContent, /between you and Example Studio Ltd/);
});

test('legal pages keep their fallback wording when details are missing or unsafe', () => {
  for (const config of [{}, { contactEmail: 'not-an-email', developerName: '   ' }, { contactEmail: 'javascript:alert(1)//@x.io', developerName: 42 }, { contactEmail: '"><img src=x>@example.com' }]) {
    const page = load(privacy, { config });
    assert.ok(page.$$('[data-if-contact]').every(element => element.hasAttribute('hidden')));
    assert.ok(page.$$('[data-if-no-contact]').every(element => !element.hasAttribute('hidden')));
    assert.match(page.$('[data-developer-name]').textContent, /named on its Google Play listing/);
    assert.equal(page.$('[data-contact-email]').getAttribute('href'), 'privacy.html#contact');
  }
  const agreement = load(terms);
  assert.match(agreement.$('[data-governing-law]').textContent, /country in which the developer/);
});

test('publisher details are written as plain text, never as markup', () => {
  const page = load(terms, { config: { developerName: '<b>Studio</b>\u0007', governingLaw: 'Ireland<script>' } });
  assert.equal(page.$('[data-developer-name]').textContent, '<b>Studio</b>');
  assert.equal(page.$('[data-developer-name] b'), null);
  assert.equal(page.$('[data-governing-law]').textContent, 'Ireland<script>');
  assert.equal(page.$('[data-governing-law] script'), null);
});

test('legal pages can be printed and the site never touches browser storage', () => {
  for (const html of [privacy, terms]) {
    const page = load(html);
    page.fire('[data-print]');
    assert.equal(page.window.printed, true);
    assert.deepEqual(page.storageAccess, []);
  }
  const animated = load(home, { reducedMotion: false });
  animated.fire('.swatch[data-colour="#5db7fe"]');
  animated.fire('#tab-bass');
  assert.deepEqual(animated.storageAccess, []);
});
