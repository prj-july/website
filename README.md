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
