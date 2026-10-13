-- Recipe wiki at /recipes/. Each recipe keeps its current text in `recipes`, and every save
-- adds a full snapshot to `revisions`, so any version can be viewed, compared or restored.

CREATE TABLE recipes (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,       -- fixed when the page is created; renaming keeps it
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  mode        TEXT NOT NULL DEFAULT '',   -- main June cook mode, e.g. Bake
  temp        TEXT NOT NULL DEFAULT '',
  shelf       TEXT NOT NULL DEFAULT '',
  prep        TEXT NOT NULL DEFAULT '',
  cook        TEXT NOT NULL DEFAULT '',
  servings    TEXT NOT NULL DEFAULT '',
  ingredients TEXT NOT NULL DEFAULT '',   -- one per line; a line ending in ":" is a subheading
  steps       TEXT NOT NULL DEFAULT '',   -- one per line; a line starting "Oven:" is an oven step
  notes       TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '',   -- comma separated
  june_url    TEXT NOT NULL DEFAULT '',   -- June's own page for this recipe, set by the seed only
  image_url   TEXT NOT NULL DEFAULT '',   -- June's photo, shown from June's server (not copied); seed only
  is_stub     INTEGER NOT NULL DEFAULT 1, -- no ingredients and no steps yet
  hidden      INTEGER NOT NULL DEFAULT 0, -- set by hand to take a page down
  rev         INTEGER NOT NULL DEFAULT 1, -- the current revision number
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE revisions (
  id         INTEGER PRIMARY KEY,
  recipe_id  INTEGER NOT NULL REFERENCES recipes(id),
  rev        INTEGER NOT NULL,
  data       TEXT NOT NULL,               -- JSON snapshot of the editable fields
  author     TEXT NOT NULL DEFAULT '',
  comment    TEXT NOT NULL DEFAULT '',
  ip_hash    TEXT NOT NULL DEFAULT '',    -- salted, rotates daily; only used to slow down spam
  created_at TEXT NOT NULL,
  UNIQUE (recipe_id, rev)
);

CREATE INDEX revisions_recent ON revisions (created_at);
CREATE INDEX revisions_ip ON revisions (ip_hash, created_at);
