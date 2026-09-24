'use strict';

/* TuneForge website behaviour, shared by the home page and the legal pages.
   Every feature checks for its own markup, so each page only runs what it contains.
   Nothing here stores data in the browser, sets cookies or contacts another service. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const config = window.TUNEFORGE_CONFIG || {};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Observer = window.IntersectionObserver;
  const show = (element, visible) => { if (visible) element.removeAttribute('hidden'); else element.setAttribute('hidden', ''); };
  const cleanText = value => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) : '');

  // Header: solid once the page scrolls; the legal pages also show reading progress.
  const header = $('.site-header');
  const progress = $('.reading-progress');
  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    header?.classList.toggle('is-scrolled', scrollY > 8);
    if (progress) {
      const length = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty('--progress', String(length > 0 ? Math.min(1, scrollY / length) : 0));
    }
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Mobile menu.
  const menuButton = $('.menu-toggle');
  const menu = $('#mobile-menu');
  function setMenu(open) {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    show(menu, open);
    document.body.classList.toggle('menu-open', open);
  }
  if (menuButton && menu) {
    menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { setMenu(false); menuButton.focus(); }
    });
    matchMedia('(min-width: 1024px)').addEventListener?.('change', event => { if (event.matches) setMenu(false); });
  }

  $$('[data-year]').forEach(element => { element.textContent = String(new Date().getFullYear()); });

  // Sideways-scrolling areas (toolkit cards on phones, wide tables) take keyboard focus only while they scroll.
  const regions = $$('[data-scroll-region]');
  const updateRegions = () => regions.forEach(region => {
    if (region.scrollWidth > region.clientWidth + 1) region.setAttribute('tabindex', '0');
    else region.removeAttribute('tabindex');
  });
  if (regions.length) { updateRegions(); addEventListener('resize', updateRegions, { passive: true }); }

  // Google Play link: only a real listing URL switches the site out of its coming-soon state.
  function storeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'play.google.com' && url.pathname === '/store/apps/details' && url.searchParams.get('id') ? url.href : null;
    } catch { return null; }
  }
  const listing = config.playStoreUrl ? storeUrl(config.playStoreUrl) : null;
  if (listing) {
    $$('[data-store-link]').forEach(link => {
      link.setAttribute('href', listing);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
    $$('[data-store-kicker]').forEach(element => { element.textContent = 'Get it on'; });
    $$('[data-release-copy]').forEach(element => { element.textContent = 'Available now on Google Play.'; });
    $$('[data-faq-release]').forEach(element => { element.textContent = 'TuneForge is available for Android on Google Play. Any download button on this page takes you straight to its listing.'; });
  }

  // Contact and publisher details for the footer and legal pages, taken from config.js.
  const email = typeof config.contactEmail === 'string' ? config.contactEmail.trim() : '';
  if (email.length <= 254 && /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[a-z]{2,}$/i.test(email)) {
    $$('[data-contact-email]').forEach(element => {
      element.textContent = email;
      if (element.tagName === 'A') element.setAttribute('href', `mailto:${email}`);
    });
    $$('[data-contact-link]').forEach(link => link.setAttribute('href', `mailto:${email}`));
    $$('[data-if-contact]').forEach(element => show(element, true));
    $$('[data-if-no-contact]').forEach(element => show(element, false));
  }
  const developer = cleanText(config.developerName);
  if (developer) $$('[data-developer-name]').forEach(element => { element.textContent = developer; });
  const law = cleanText(config.governingLaw);
  if (law) $$('[data-governing-law]').forEach(element => { element.textContent = law; });

  // Scroll reveal.
  const reveals = $$('.reveal');
  if (!Observer || reducedMotion) reveals.forEach(element => element.classList.add('is-visible'));
  else {
    const revealer = new Observer(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    reveals.forEach(element => revealer.observe(element));
  }

  // Highlight the navigation or contents link for the section being read.
  function spy(links, rootMargin) {
    const targets = new Map();
    links.forEach(link => {
      const id = (link.getAttribute('href') || '').split('#')[1];
      const target = id && document.getElementById(id);
      if (target) targets.set(target, [...(targets.get(target) || []), link]);
    });
    if (!Observer || !targets.size) return;
    const observer = new Observer(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(link => link.removeAttribute('aria-current'));
      targets.get(entry.target).forEach(link => link.setAttribute('aria-current', 'true'));
    }), { rootMargin });
    targets.forEach((_, target) => observer.observe(target));
  }
  spy($$('.site-nav a'), '-45% 0px -50% 0px');
  spy($$('.legal-toc a'), '-20% 0px -70% 0px');

  // Hero: a gentle parallax and a status pill that settles into tune, like the app's own.
  const hero = $('.hero');
  const pill = $('.hero-pill');
  if (hero && pill) {
    const media = $('.hero-media', hero);
    const label = $('.hero-pill-label', pill);
    const cents = $('.hero-pill-cents', pill);
    const render = (value, settled) => {
      const offset = settled ? 0 : Math.sign(value || -1) * Math.max(.1, Math.abs(value));
      pill.classList.toggle('is-in-tune', settled);
      pill.classList.toggle('is-flat', !settled && offset < 0);
      pill.classList.toggle('is-sharp', !settled && offset > 0);
      media.classList.toggle('is-in-tune', settled);
      label.textContent = settled ? 'In tune' : offset < 0 ? 'Tune up' : 'Tune down';
      cents.textContent = settled ? '0.0¢' : `${offset < 0 ? '−' : '+'}${Math.abs(offset).toFixed(1)}¢`;
    };
    if (reducedMotion) render(0, true);
    else {
      const offsets = [-12.4, 8.6, -5.8, 14.2, -9.1, 6.3];
      let round = 0;
      let visible = true;
      let waiting = false;
      const settle = () => {
        if (!visible || document.hidden) { waiting = true; return; }
        waiting = false;
        const start = offsets[round++ % offsets.length];
        render(start, false);
        setTimeout(() => {
          const began = performance.now();
          const step = now => {
            const t = Math.min(1, (now - began) / 2000);
            const eased = 1 - (1 - t) ** 3;
            if (t < 1) {
              render(start * (1 - eased) + Math.sin(t * Math.PI * 4) * (1 - t) * 1.4, false);
              requestAnimationFrame(step);
            } else {
              render(0, true);
              setTimeout(settle, 4600);
            }
          };
          requestAnimationFrame(step);
        }, 900);
      };
      if (Observer) new Observer(([entry]) => { visible = entry.isIntersecting; if (visible && waiting) settle(); }).observe(hero);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && waiting) settle(); });
      setTimeout(settle, 1900);

      if (matchMedia('(pointer: fine)').matches) {
        let frame = 0;
        hero.addEventListener('pointermove', event => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const bounds = hero.getBoundingClientRect();
            hero.style.setProperty('--px', (((event.clientX - bounds.left) / bounds.width) * 2 - 1).toFixed(3));
            hero.style.setProperty('--py', (((event.clientY - bounds.top) / bounds.height) * 2 - 1).toFixed(3));
          });
        });
        hero.addEventListener('pointerleave', () => { hero.style.setProperty('--px', '0'); hero.style.setProperty('--py', '0'); });
      }
    }
  }

  // Stats count up the first time they come into view.
  if (Observer && !reducedMotion) {
    const counter = new Observer(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      counter.unobserve(entry.target);
      const element = entry.target;
      const target = Number(element.dataset.count);
      const began = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - began) / 1300);
        element.textContent = String(Math.round(target * (1 - (1 - t) ** 4)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: .6 });
    $$('[data-count]').forEach(element => counter.observe(element));
  }

  // Tuning library tabs: click, arrow keys, Home and End.
  $$('[data-tabs]').forEach(root => {
    const tabs = $$('[role="tab"]', root);
    const panel = $('[role="tabpanel"]', root);
    const screens = $$('[data-screen]', panel);
    function select(tab, focus = false) {
      tabs.forEach(item => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.setAttribute('tabindex', active ? '0' : '-1');
      });
      panel.setAttribute('aria-labelledby', tab.id);
      screens.forEach(screen => {
        const active = screen.dataset.screen === tab.dataset.screen;
        screen.classList.toggle('is-active', active);
        if (active) screen.removeAttribute('aria-hidden');
        else screen.setAttribute('aria-hidden', 'true');
      });
      if (focus) tab.focus();
    }
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key in keys) next = (index + keys[event.key] + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        select(tabs[next], true);
      });
    });
  });

  // Accent colour preview. It only tints this section and is never saved.
  const appearance = $('#appearance');
  const swatches = $$('.swatch');
  swatches.forEach(swatch => swatch.addEventListener('click', () => {
    const colour = swatch.dataset.colour;
    if (!appearance || !/^#[0-9a-f]{6}$/i.test(colour || '')) return;
    swatches.forEach(item => item.setAttribute('aria-pressed', String(item === swatch)));
    appearance.style.setProperty('--tint', colour);
    const name = $('#swatch-name');
    if (name) name.textContent = $('.swatch-name', swatch).textContent;
  }));

  // The metronome screen pulses at 100 BPM, only while it is on screen.
  const spotlight = $('.spotlight');
  if (spotlight && Observer && !reducedMotion) {
    new Observer(([entry]) => spotlight.classList.toggle('is-playing', entry.isIntersecting), { threshold: .3 }).observe(spotlight);
  }

  // Legal pages: printing, and a contents list that folds away on small screens.
  $$('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
  const toc = $('.toc-details');
  if (toc) {
    const compact = matchMedia('(max-width: 1023px)');
    if (compact.matches) toc.removeAttribute('open');
    compact.addEventListener?.('change', event => { if (!event.matches) toc.setAttribute('open', ''); });
    toc.addEventListener('click', event => { if (event.target.closest('a') && compact.matches) toc.removeAttribute('open'); });
  }
})();
