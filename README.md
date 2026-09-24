# TuneForge

The static showcase website for the TuneForge Android app: a home page, a Privacy Policy, Terms and Conditions and a custom 404 page. Plain HTML, CSS and JavaScript — no framework, CDN, cookies, analytics or server code.

## Preview locally

With Node.js 22 or later installed:

```sh
npm start
```

Open <http://127.0.0.1:4173>. Unknown addresses show the custom 404 page, just as they will on GitHub Pages.

## Before you publish: `config.js`

Every setting is optional. Anything left empty falls back to honest built-in wording, so the site never invents details on your behalf.

```js
window.TUNEFORGE_CONFIG = Object.freeze({
  playStoreUrl: "https://play.google.com/store/apps/details?id=YOUR.PACKAGE",
  contactEmail: "you@example.com",
  developerName: "Your name or company",
  governingLaw: "England and Wales",
});
```

- **playStoreUrl** — switches every download button from “Coming soon to Google Play” to your listing. Only a real `https://play.google.com/store/apps/details?id=…` address is accepted.
- **contactEmail** — shown in the footer and on both legal pages. Without it, they point people to the contact details on your Google Play listing.
- **developerName** — named as the data controller in the Privacy Policy and as the other party in the Terms.
- **governingLaw** — the law that governs the Terms, e.g. “England and Wales” or “Ireland”.

`npm run check` reminds you about any of these that are still empty.

### Keep the Privacy Policy true

`privacy.html` describes how the app handles data. It was written for an app that:

- analyses microphone audio on the device in real time, and never records, stores or uploads it;
- has no accounts, advertising, analytics or crash-reporting SDKs of its own;
- keeps settings and custom tunings only on the device.

If any of that changes — for example if you add Firebase, AdMob or an account system — update the policy and your Google Play Data safety form before releasing. The website side is enforced automatically: `npm run check` fails if `app.js` uses browser storage, cookies, analytics or network requests, or if any page loads a file from another site.

## Publish on GitHub Pages

1. Put the contents of this folder in your GitHub repository and push to `main`.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. The included workflow validates, tests, builds and publishes the site. Your URL appears in the completed deployment.

The workflow passes your Pages address to the build as `SITE_URL`, which adds canonical URLs and absolute social-preview images to each page, generates `sitemap.xml` and `robots.txt`, and anchors the 404 page to the site root so it works at any depth. A custom domain configured through GitHub Pages works the same way. If your default branch has another name, change `branches: [main]` in `.github/workflows/pages.yml`.

For another static host, upload **the contents of `dist`**, produced with:

```sh
npm ci
npm run check
npm test
npm run build
```

Set `SITE_URL` to your real address when building for another host (never put credentials in it). Without it the site still works; only the extras above are skipped.

## Project layout

- `index.html` — the home page: hero, tuner, tunings, toolkit, appearance, details, FAQ and download sections
- `privacy.html`, `terms.html` — the legal pages, with contents navigation, reading progress and print styles
- `404.html` — self-contained “out of tune” page
- `styles.css` — the shared design system (Inter throughout, dark theme, responsive layouts, reduced-motion and print support)
- `app.js` — navigation, scroll reveals, tuning-library tabs, the hero’s animated status pill, the accent preview and config handling. It stores nothing in the browser.
- `config.js` — the settings above
- `assets/` — original artwork plus the web-optimised copies the site uses (`hero/`, `screens/`, `tools/`)
- `scripts/` — preview server, site checks, build and image preparation
- `tests/` — interaction tests

## Updating images

The originals stay in the project: `hero.png`, the showcase posters in `assets/Showcase/` and the tool artwork in `assets/`. After replacing any of them, regenerate the optimised copies with Python and Pillow:

```sh
python scripts/prepare_assets.py
```

The script writes compressed WebP files. It turns the full-resolution `hero.png` master (16:9) into a responsive set — 1280, 1920, 2560 and 3840 px wide for larger screens, plus a portrait crop centred on the dial for phones — and crops each showcase poster to its bare 600 × 1300 screen so the site can present it in its own device frame. The hero’s animated status pill and glow are positioned as percentages of the dial, so a replacement hero needs the same composition. Only the optimised copies are published; neither the build nor the site needs Python.

## Credits

TuneForge branding, screenshots and artwork were supplied by the project owner. The Inter typeface is distributed under the SIL Open Font License (`assets/fonts/inter-LICENSE.txt`). Icons are drawn from Lucide under the ISC License (`assets/icons/LICENSE.txt`).
