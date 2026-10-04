# Link-preview image

`card.html` is the source for `public/og.png` (1200×630). To regenerate after editing:

```sh
chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=8000 --window-size=1200,630 --screenshot=../public/og.png card.html
```

Link previews are cached by chat apps, so rename the image (e.g. `og-2.png`) and update
`og:image` in `index.html` when you change it.
