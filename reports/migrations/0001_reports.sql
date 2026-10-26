-- Bug reports. Nothing here is ever served: the Worker only writes, and reports are read with
-- `npx wrangler d1 execute` by someone signed in to the Cloudflare account (see README.md).
-- The full diagnostics (or the raw email) go to the private R2 bucket june-bug-reports under
-- `object_key`; this table keeps the short summary used to triage.
CREATE TABLE reports (
  id                INTEGER PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,          -- JR-XXXXXX, shown to the person who sent it
  source            TEXT NOT NULL,                 -- oven | app | email
  created_at        TEXT NOT NULL,
  note              TEXT NOT NULL DEFAULT '',      -- what they said went wrong
  contact           TEXT NOT NULL DEFAULT '',      -- optional reply address
  subject           TEXT NOT NULL DEFAULT '',      -- email only
  installer_version TEXT NOT NULL DEFAULT '',
  build_id          TEXT NOT NULL DEFAULT '',
  server_version    TEXT NOT NULL DEFAULT '',
  oven_model        TEXT NOT NULL DEFAULT '',
  connection        TEXT NOT NULL DEFAULT '',
  problems          TEXT NOT NULL DEFAULT '',      -- ids of the problems /local/status listed
  client            TEXT NOT NULL DEFAULT '',      -- e.g. "Project July iOS 1.4"
  object_key        TEXT NOT NULL DEFAULT '',
  bytes             INTEGER NOT NULL DEFAULT 0,
  ip_hash           TEXT NOT NULL DEFAULT '',      -- salted daily hash, for the rate limit only
  status            TEXT NOT NULL DEFAULT 'new',   -- new | seen | fixed | closed
  triage_note       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX reports_status ON reports (status, id);
CREATE INDEX reports_ip ON reports (ip_hash, created_at);
