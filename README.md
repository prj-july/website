# project-july.org

The website for Project July, a community project that keeps June ovens working after the
June cloud shuts down. It's a static site with no build step, served by Cloudflare Workers
Static Assets.

- `public/`: the site (`index.html`, `css/`, `assets/`)
- `wrangler.jsonc`: Cloudflare config

```sh
npx wrangler dev      # preview locally
npx wrangler deploy   # publish to project-july.org
```

`public/css/tokens.css` is generated from the Project July design system's `tokens.json`;
regenerate it rather than editing it by hand.

## 3D setup walkthrough

`public/setup/player.html` is the guided walkthrough, embedded on the home page (lazy-loaded, it
plays by itself once scrolled into view and pauses when scrolled away) and full-size at `/setup/`. It's generated, so don't edit it directly:

- The oven model comes from `../oven-3d-model/june-oven.html` (the explorer version). That folder
  sits next to this repo locally and isn't part of it yet, so rebuilding the player needs a copy of it.
- The captions, step controls, laptop step and site styling are in `tools/player-template.html`.

After changing either one, run:

```sh
node tools/build-player.js
```

three.js r128 is served from `public/setup/vendor/` (MIT licence included) rather than a CDN.
The images shown while the home page player loads are `public/setup/poster-light.webp` and `poster-dark.webp`,
rendered from `player.html?poster` with headless Chrome at 1280×720.

## Setup, installer and clients pages

- `/setup/` is the short version: the 3D walkthrough, the USB stick, the four steps and the
  certificate step after the install. A section after the four steps links into the installer
  guide, which covers the rest.
- `/installer/` is the full installer guide: Ventoy, booting, every screen, backup and restore,
  and troubleshooting. Its screenshots are in `public/installer/img/`. The dark desktop ones
  (`oven-found`, `custom-options`, `success-laptop`, `backup-drive`) are crops of the installer's
  mock-mode captures in `installer/website-assets/installer-mockups/png/` (version 0.5), converted
  to WebP with ffmpeg; the rest are photos and phone screenshots of real runs. The sticky section
  bar under its header is filled in by the script at the end of the page; when you add, remove or
  rename a section, update the bar's links (and the "On this page" list) to match.
- `/clients` (`public/clients.html`) lists every way to control the oven (Home Assistant, the
  Android and Apple companion apps) and what each one needs after a standard or custom install.
- `/clients/privacy` (`public/clients/privacy.html`) is the Project July app's privacy policy
  (Android and iOS), the URL given to Google Play and the App Store. Keep it in step with what the app actually stores
  and sends (including any new SDKs), and change the effective date whenever the text changes.
  Don't move it: the store listings point at this URL.

The board photo on `/setup/` (`public/setup/img/sw2.webp`) is a 360×300 crop of
`../oven-3d-model/reference-photos/18-electronics-bay-teardown-clear.webp` (from x 170, y 250),
scaled to 720×600. The red arrows for SW2 and the micro-USB port are an SVG drawn on top in the
crop's own 360×300 coordinates, so they scale with the photo; SW2 is the right-hand of the two
blue buttons (SW1 is the left one), matching `june-oven.html`. To re-crop:

```sh
ffmpeg -i ../oven-3d-model/reference-photos/18-electronics-bay-teardown-clear.webp -vf "crop=360:300:170:250,scale=720:600:flags=lanczos" -c:v libwebp -quality 82 public/setup/img/sw2.webp
```

When you add or move a page, update `public/sitemap.xml`.

## App pages

- `/android/` and `/ios/` are the pages for the Project July phone app (`prj-july/project-july-app`).
  The Android page has the Google Play beta links: the tester group `prj-july-beta` and the
  opt-in page for `org.projectjuly.oven`. The iPhone page asks for TestFlight invites by email.
  Both end with a short privacy summary that links to `/clients/privacy`; keep it in step with
  the policy.
- They share `public/css/app-pages.css`, the same dark glass as the card guide. The screenshots in
  `public/assets/app/` are WebP copies of the app repo's `docs/screenshots/` and
  `store-assets/screenshots/`; `feature-graphic.png` is the link-preview image.

## July Oven card guide

`public/card/` is a walkthrough of the Home Assistant dashboard card, at `/card/`, linked from the
App section and the Home Assistant FAQ. It is styled after the card's own dark glass rather than
the site's design system. Its screenshots and GIFs are rendered from the card's test page in
`prj-july/ha-june-oven` (`tests/card/index.html`); the same guide, in Markdown, is in that repo's
`docs/card-guide/`.

## Videos

`tools/record-video.js` records the walkthrough to MP4 for sharing (Reddit, chat). It drives
`player.html?record` in headless Chrome one frame at a time, so the result is a smooth 30 fps
whatever the machine's speed, then encodes it with ffmpeg. With the local preview server running:

```sh
node tools/record-video.js --chapter 0 --out ../videos/project-july-setup.mp4   # full walkthrough
node tools/record-video.js --chapter 3 --out ../videos/project-july-sw2.mp4     # the SW2 step only
```

Options: `--theme light|dark` (default dark). The page is laid out at 800×450 and captured at
1280×720, so the captions stay readable on a phone. Each video ends on a short Project July card.
