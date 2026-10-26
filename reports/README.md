# Bug reports (reports.project-july.org)

A small Worker that takes bug reports from ovens (the /local page's "Send report"), from the
Project July phone app and, optionally, from email. It is **write-only**: no URL returns a
report, a list or a count. Reports can only be read by someone signed in to the Cloudflare
account, with the commands below.

```
reports/
  wrangler.jsonc        the Worker, its D1 database (DB), its R2 bucket (REPORTS), the domain
  src/worker.js         POST /v1/reports, the email handler, redaction and the rate limit
  migrations/           the database schema
```

## What's stored, and what isn't

- The D1 table `reports` keeps a triage summary: the code shown to the sender (`JR-XXXXXX`),
  the note, an optional reply address, installer version and build, oven model, connection
  state, the ids of the problems /local listed, and where the full report is.
- The full report (the note plus the oven's `/local/status`) is in the private R2 bucket
  `june-bug-reports`, under `oven/` or `app/` and the date. Raw emails are under `email/`.
- Before anything is stored, `redact()` replaces every field whose name looks like a token,
  password, key, seed, fingerprint, serial, account name or email with `[removed]`, and blanks
  June serial numbers and long hex strings inside text (log lines). Clients should leave
  those out too; this is the backstop.
- Senders are rate limited to 5 reports an hour and 20 a day, keyed on a salted hash of their
  address that changes daily (the `IP_SALT` secret). Addresses aren't stored. Bodies are capped
  at 256 KB.
- The Worker sends no CORS headers, so another website can't make a visitor's browser post
  here. Ovens post from their own server and the app isn't a browser, so neither needs them.
- Invocation logs are off, so Cloudflare doesn't keep request details; errors are still logged.

## Setting it up (once)

Run from this folder, signed in with `npx wrangler login`:

```sh
npx wrangler d1 create project-july-reports
```

Put the `database_id` it prints into `wrangler.jsonc`, then:

```sh
npx wrangler r2 bucket create june-bug-reports
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put IP_SALT
npx wrangler deploy
```

Leave the bucket's public access and r2.dev URL off (they are off by default).

### Email (optional)

This works only if Cloudflare Email Routing receives the domain's mail (the MX records point at
Cloudflare). In the dashboard: Email → Email Routing → Routing rules, send the address (for
example help@project-july.org) to the Worker `project-july-reports`. Then set where the copy goes:

```sh
npx wrangler secret put FORWARD_TO
```

The forward address must be a verified destination in Email Routing. Each email is saved, gets
a code, and is forwarded with an `X-Project-July-Report` header carrying it.

## Reading reports

```sh
npx wrangler d1 execute DB --remote --command "SELECT code, source, created_at, installer_version, oven_model, connection, problems, note FROM reports WHERE status = 'new' ORDER BY id DESC LIMIT 20"
npx wrangler r2 object get june-bug-reports/oven/2026-10-26/JR-XXXXXX.json --remote --pipe
npx wrangler d1 execute DB --remote --command "UPDATE reports SET status = 'fixed', triage_note = '0.9.2' WHERE code = 'JR-XXXXXX'"
```

## Sending one

```sh
curl -X POST https://reports.project-july.org/v1/reports \
  -H 'content-type: application/json' \
  -d '{"source":"oven","note":"App says disconnected","diagnostics":{}}'
```

The reply is `{"code":"JR-XXXXXX"}` with status 201. Errors are `{"error":"…"}` with 400, 413,
415, 429 or 500.

## Local preview

```sh
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```
