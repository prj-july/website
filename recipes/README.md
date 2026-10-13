# June Recipes (recipes.project-july.org)

A wiki of June oven recipes that anyone can edit without an account, with Project July's
thanks to the team at June. It's its own small site, separate from project-july.org: a
Cloudflare Worker that renders every page from a D1 database. It links back to Project July
and invites people to make their oven local. project-july.org/recipes/* redirects here
(`public/_redirects` in the main site).

```
recipes/
  wrangler.jsonc        the Worker, its D1 database (DB) and the recipes.project-july.org domain
  src/worker.js         routes, saving, history, restores, spam checks
  src/pages.js          the HTML (home, recipe, edit, history, compare, changes, help)
  src/text.js           fields, escaping, slugs, one-item-per-line parsing, diffs
  src/oven.js           reading the "Oven:" lines into June settings and oven commands
  src/art.js            the mode glyphs and the animated oven pictures
  src/api.js            the JSON API for the app and Home Assistant
  public/               the stylesheet and icons, served before the Worker runs
  migrations/           the database schema
  data/                 june-index.json, starter.mjs and the generated seed.sql
  tools/                build-recipe-seed.mjs, backup-june-photos.mjs, build-og.mjs
```

Run everything from this folder:

```sh
npx wrangler dev                                        # preview (after the local setup below)
npx wrangler deploy                                     # publish to recipes.project-july.org
```

## How it works

- Every save adds a full snapshot to `revisions`, so the History tab can show, compare and
  restore any version.
- **Review first.** An edit, a restore or a new recipe from a visitor is saved as a *pending*
  revision. The page keeps its last approved version (with a note that a change is waiting)
  until a moderator approves it at `/mod`; a new recipe stays out of sight until then.
  Rejecting a change keeps it in the moderators' history with the note; rejecting a new recipe
  deletes it. Moderators' own edits go live straight away. Every moderator action is logged in
  `mod_events` and listed at `/mod`.
- **Labels.** `origin` is `june` (one of June's published recipes), `starter` (written by
  Project July) or `community` (added on the wiki). `featured` marks the recipes a moderator
  promoted: only those are on the main page and in the API by default. Approved recipes that
  aren't featured are "community" recipes, in their own section that's hidden until the visitor
  switches it on.
- **Moderators** sign in at `/mod` with a name and password from the `MODERATORS` secret,
  `name:password` pairs separated by `;` (passwords of 12 characters or more):
  `npx wrangler secret put MODERATORS`, then paste for example `felix:…;gene:…`. Signing in
  sets a signed cookie for 30 days; changing the secret signs everyone out. Failed sign-ins are
  limited to 10 an hour per visitor. Signed in, every page shows a bar with the queue, and a
  recipe page has Feature / Unfeature and Hide buttons. For local previews, put a throwaway
  `MODERATORS="tester:…"` in `.dev.vars` (ignored by git).
- The look follows the June app's recipe screens and the Project July app's Still Glass theme
  (`public/css/recipes.css`, light and dark): Barlow for June's DIN, Source Serif for its recipe
  headlines, and the July Oven card's mode glyphs.
- A recipe's summary and tips are lightly formatted (`richText()` in `src/pages.js`): blank
  lines make paragraphs, a line starting `Warning:`, `Tip:` or `Note:` is a callout, `<3` is a
  heart, and a closing paragraph ending in just a name is the cooks' sign-off. `byline`
  ("Recipe by", migration 0004) credits who it's from without putting names in the title.
- Oven pictures follow the step: Proof is on the bottom shelf unless the line names one, and the
  food sits in what the step (or the one before) mentions: a glass bowl under a shower cap, a
  baking dish, or a sheet pan (`vesselOf()` in `src/oven.js`, `?vessel=` on the picture).
- People type ingredients and steps one per line. A line ending in `:` is a subheading; a step
  starting with `Oven:` is an oven step, drawn as an animated oven and turned into the command
  the app and Home Assistant send (`src/oven.js`, `src/art.js`).
- Spam: a honeypot field, at most 2 links per edit, and a rate limit per visitor (15 edits per
  10 minutes, 120 per day) keyed on a salted hash of the IP address that changes daily (the
  `IP_SALT` secret). Cloudflare Turnstile switches on when the `TURNSTILE_SITE_KEY` variable and
  `TURNSTILE_SECRET_KEY` secret are set.
- To take a page down, set `hidden = 1` on it:
  `npx wrangler d1 execute DB --remote --command "UPDATE recipes SET hidden = 1 WHERE slug = '…'"`.
  Takedown requests come to hello@project-july.org (the help page and footer say so).

## Link previews

Every page has Open Graph and Twitter tags (`layout()` in `src/pages.js`). A recipe's preview
shows its photo (June's, from June's server, credited in the image's alt text), its summary and
the June settings at a glance; the home page and recipes without a photo use `public/og.png`,
drawn from the site's own oven picture by `node tools/build-og.mjs` (headless Chrome). Telegram
caches previews: send the link to @WebpageBot to refresh one after a change.

## The seed

`data/seed.sql` has a page for every recipe June published, linking to June's own page, plus
starter recipes written for the wiki in our own words. June's app text, photos and the saved
June content are not copied into it. To change it, edit `data/starter.mjs` (or refresh
`data/june-index.json` from juneoven.com/pages/recipes) and rebuild:

```sh
node tools/build-recipe-seed.mjs           # writes data/seed.sql
node tools/build-recipe-seed.mjs --check   # lists the titles in each category
```

The seed only inserts pages that don't exist yet, so running it again never overwrites edits.

## June's photos

They're shown from June's own server (`recipe-media.juneoven.com`), never from ours. In case
that server goes away, `tools/backup-june-photos.mjs` keeps a private copy: it downloads all of
them (608, about 28 MB, a few at a time) with a `manifest.json` of checksums, and `--upload`
copies them to the private R2 bucket `june-recipe-photos` (no public access, not bound to the
site). Like the saved June content, they are June's work: kept, not published.

```sh
node tools/backup-june-photos.mjs ../../june-recipe-photos            # download (skips ones already saved)
node tools/backup-june-photos.mjs ../../june-recipe-photos --upload   # and copy to R2
```

## Setup

First time (already done for the live site; the database is `project-july-recipes`):

```sh
npx wrangler d1 create project-july-recipes        # put the database_id in wrangler.jsonc
npx wrangler d1 migrations apply DB --remote
npx wrangler d1 execute DB --remote --file data/seed.sql
npx wrangler secret put IP_SALT                    # any long random string
npx wrangler secret put MODERATORS                 # name:password;name:password
npx wrangler deploy
```

A new migration (like `0002_review.sql`) goes on the live database before the code that needs
it: `npx wrangler d1 migrations apply DB --remote`, then `npx wrangler deploy`.

Locally, run the migration and seed commands with `--local` instead of `--remote`. D1 also keeps
30 days of restore points by itself; for a copy of your own:
`npx wrangler d1 export DB --remote --output recipes-backup.sql`.

## API

The Project July app and the Home Assistant card read recipes as JSON and run their oven steps.
Everything is `GET`, public, cached for 5 minutes and sent with `Access-Control-Allow-Origin: *`.

| Path | What |
|---|---|
| `/api/v1/recipes` | The featured recipes and June's titles still to write up (add `?include=community` for every approved recipe): `slug`, `title`, `category`, `mode`, `temp`, `cook`, `tags`, `ready` (written up, not just a title), `featured`, `origin`, `image`, `url`, `api` |
| `/api/v1/recipes/{slug}` | One recipe (below) |
| `/api/v1/art/oven.svg?mode=&shelf=&preheat=1&temp=&probe=&level=` | The animated oven for one step, as on the wiki. Plain SVG with its own styles, so it animates in an `<img>` |
| `/api/v1/art/glyph-{mode}.svg?color=%23ffc247` | A mode glyph (the card's set) |

A recipe has `ingredients` (`{type: "item" | "heading", text}`), `steps` and `program`:

- `steps`: `{n, type: "step" | "oven", text}` in order, headings as `{type: "heading", text}`.
  An oven step also has `phase` (which program phase it belongs to) and `art`.
- `program`: the cooks to start, in order. Each phase has `steps` (the step numbers it covers;
  a "preheat" line and the "bake 12 minutes" line after it are one phase), a readable `label`,
  the parsed settings (`mode_id`, `temp_f`, `level`, `preheat`, `duration_s: {min, max}`,
  `probe_f`, `shelf`), `art`, and either `command` or `why`:

```json
"command": {
  "start": { "primitive_type": "bake", "temperature_cavity": 204444, "temperature_f": 400 },
  "timer_ms": 480000,
  "timer_max_ms": 600000
}
```

`start` is the 11002 Preheat payload as the clients send it (`temperature_cavity` in milli-°C,
`plan_index` for toast levels and grill heats), checked against the app's mode table
(`MODE_SPECS` in `src/oven.js`, which mirrors `project-july-app/src/api/modes.ts`; keep them in
step). `timer_ms` is the low end of the step's time, for 11006 SetTimer once the oven reports
the new plan; `timer_max_ms` is the high end when the recipe gives a range. `probe_f` is advice
only: no client can set the oven's probe target. `why` explains a phase that can't be started
remotely (Slow Cook, Broil on Low, a temperature outside the mode's range, no mode named).

Clients run one phase at a time and show each one for the person to confirm before anything
heats, exactly as they do for any cook (the 5-minute review). Nothing starts by itself, and the
next phase waits for the person.
