-- Photos people upload. The file goes to the private R2 bucket june-recipe-uploads (bound as
-- UPLOADS) under `key`; the site serves it at /uploads/<key> only once a moderator approves it,
-- which also adds it to the recipe's gallery (recipes.photos) or makes it the cover.
CREATE TABLE photo_uploads (
  id          INTEGER PRIMARY KEY,
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id),
  key         TEXT NOT NULL UNIQUE,          -- <slug>/<random>.<ext> in the bucket
  type        TEXT NOT NULL,                 -- image/jpeg, image/png or image/webp
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  author      TEXT NOT NULL DEFAULT '',      -- the photo credit, if they gave a name
  caption     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | removed
  ip_hash     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  reviewed_by TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX photo_uploads_pending ON photo_uploads (status, id);
CREATE INDEX photo_uploads_ip ON photo_uploads (ip_hash, created_at);
