-- Review before publishing, and labels for what's on the main page.
--
-- Every edit, restore and new recipe is saved as a pending revision; the recipe row keeps the
-- last approved version until a moderator approves (or rejects) it. A new recipe stays out of
-- sight (status 'pending') until approved.
--
-- origin:   'june'      a page for one of June's published recipes (june_url set)
--           'starter'   written for the wiki by Project July
--           'community' added by someone on the wiki
-- featured: 1 for recipes a moderator promoted (high quality, or close to June's original);
--           only these are on the main page. Community recipes that aren't featured show in
--           their own section, hidden by default.

ALTER TABLE recipes ADD COLUMN status TEXT NOT NULL DEFAULT 'live';        -- 'live' | 'pending'
ALTER TABLE recipes ADD COLUMN origin TEXT NOT NULL DEFAULT 'community';
ALTER TABLE recipes ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

ALTER TABLE revisions ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';  -- 'pending' | 'approved' | 'rejected'
ALTER TABLE revisions ADD COLUMN base_rev INTEGER NOT NULL DEFAULT 0;      -- the approved version it was made from
ALTER TABLE revisions ADD COLUMN reviewed_by TEXT NOT NULL DEFAULT '';
ALTER TABLE revisions ADD COLUMN reviewed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE revisions ADD COLUMN review_note TEXT NOT NULL DEFAULT '';

CREATE INDEX revisions_pending ON revisions (status, id);

-- What moderators did, and failed logins (for the login rate limit).
CREATE TABLE mod_events (
  id         INTEGER PRIMARY KEY,
  moderator  TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,               -- approve, reject, feature, unfeature, hide, unhide, login, login-failed
  recipe_id  INTEGER,
  revision_id INTEGER,
  note       TEXT NOT NULL DEFAULT '',
  ip_hash    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX mod_events_recent ON mod_events (created_at);

-- What's already live was published before review existed: label it.
UPDATE recipes SET origin = 'june' WHERE june_url != '';
UPDATE recipes SET origin = 'starter' WHERE june_url = '' AND id IN (SELECT recipe_id FROM revisions WHERE rev = 1 AND ip_hash = '');
-- The starter recipes Project July wrote are the first featured ones.
UPDATE recipes SET featured = 1 WHERE is_stub = 0 AND id IN (SELECT recipe_id FROM revisions WHERE rev = 1 AND ip_hash = '' AND comment = 'Starter version written by Project July');
UPDATE revisions SET base_rev = rev - 1;
