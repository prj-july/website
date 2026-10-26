#!/usr/bin/env bash
# Read and triage bug reports. Run from anywhere, signed in with `npx wrangler login`:
#
#   reports/tools/reports.sh list           the newest reports still marked new
#   reports/tools/reports.sh all            the newest 50 reports, any status
#   reports/tools/reports.sh show JR-XXXXXX  one report's full diagnostics (from R2)
#   reports/tools/reports.sh close JR-XXXXXX [note]   mark it closed, with an optional note
#   reports/tools/reports.sh fixed JR-XXXXXX [note]   mark it fixed
set -euo pipefail
cd "$(dirname "$0")/.."

d1() { npx wrangler d1 execute DB --remote --command "$1"; }
code_ok() { [[ "${1:-}" =~ ^JR-[A-Z0-9]{6}$ ]] || { echo "Give a report code like JR-XD86Z7." >&2; exit 1; }; }
note_sql() { printf '%s' "${1:-}" | sed "s/'/''/g"; }

case "${1:-list}" in
  list)
    d1 "SELECT code, created_at, source, installer_version, oven_model, problems, note FROM reports WHERE status = 'new' ORDER BY id DESC LIMIT 20" ;;
  all)
    d1 "SELECT code, created_at, status, source, installer_version, note FROM reports ORDER BY id DESC LIMIT 50" ;;
  show)
    code_ok "${2:-}"
    key=$(npx wrangler d1 execute DB --remote --json --command "SELECT object_key FROM reports WHERE code = '$2'" \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s)[0].results;process.stdout.write(r.length?r[0].object_key:'')})")
    [ -n "$key" ] || { echo "No report $2." >&2; exit 1; }
    npx wrangler r2 object get "june-bug-reports/$key" --remote --pipe
    echo ;;
  close|fixed|seen)
    code_ok "${2:-}"
    status=$1; [ "$status" = close ] && status=closed
    d1 "UPDATE reports SET status = '$status', triage_note = '$(note_sql "${3:-}")' WHERE code = '$2'" ;;
  *)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
