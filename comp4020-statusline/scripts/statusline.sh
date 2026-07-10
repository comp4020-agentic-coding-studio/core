#!/usr/bin/env bash
# COMP4020 status line: your weekly strproxy budget, e.g. "$12.34/$100 (12%)".
#
# The render path never touches the network. It prints a cached figure and, if
# that figure has gone stale, kicks off a detached refresh for the *next*
# render. Claude Code re-runs the status line after every assistant message and
# cancels a run that is still going when the next one fires --- so a blocking
# curl (which, on a laptop off the ANU VPN, hangs until it times out) would
# leave the bar permanently empty.
#
# The canonical copy lives in the comp4020-statusline plugin; a SessionStart
# hook syncs it to ~/.claude/comp4020/statusline.sh, which is what settings.json
# points at. The plugin's own path is content-hashed and changes on every
# update, so it can't be named in settings.json. Don't edit the installed copy
# --- the hook overwrites it.
#
# Reads nothing from stdin, so it composes: an existing status line script can
# append `"$HOME/.claude/comp4020/statusline.sh" </dev/null` to its own output.

set -uo pipefail
export LC_ALL=C # keep printf's decimal separator a dot under any locale

readonly TTL=60 # seconds a cached figure stays fresh

# Drain the session JSON Claude Code pipes in: we want none of it, but leaving
# it unread risks a broken pipe in the writer.
cat >/dev/null 2>&1 || true

# Only ever speak to a proxy we were explicitly pointed at, and only with a
# credential minted for it. Someone on a Claude Max subscription has no
# ANTHROPIC_AUTH_TOKEN at all; someone on a *different* gateway has a token that
# is none of strproxy's business. In both cases: print nothing, send nothing.
# STRPROXY_HOSTS is a space-separated allowlist, overridable for a staging host.
readonly HOSTS="${STRPROXY_HOSTS:-strproxy.comp.anu.edu.au}"

token="${ANTHROPIC_AUTH_TOKEN:-}"
base="${ANTHROPIC_BASE_URL:-}"
[[ -n "$token" && -n "$base" ]] || exit 0

# `sk-ant-…` is a real Anthropic key, not a strproxy virtual key. Never send one.
[[ "$token" == sk-ant-* ]] && exit 0

base="${base%/}"
host="${base#*://}"
host="${host%%[:/]*}"
matched=
for allowed in $HOSTS; do
  [[ "$host" == "$allowed" ]] && matched=1
done
[[ -n "$matched" ]] || exit 0

dim=$'\e[2m'
reset=$'\e[0m'

if ! command -v jq >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  printf '%s' "${dim}budget: needs jq${reset}"
  exit 0
fi

dir="${XDG_CACHE_HOME:-$HOME/.cache}/comp4020"
mkdir -p "$dir" 2>/dev/null || exit 0

# Key the cache on the token, so a rotated key starts a fresh file rather than
# reporting the old key's spend.
key=$(printf %s "$token" | cksum | cut -d' ' -f1)
json="$dir/me-$key.json"
stamp="$dir/me-$key.ts"

now=$(date +%s)
last=$(cat "$stamp" 2>/dev/null || echo 0)
[[ "$last" =~ ^[0-9]+$ ]] || last=0

if ((now - last >= TTL)); then
  # Claim the slot *before* fetching: concurrent sessions don't stampede the
  # endpoint, and a failed fetch (off VPN) waits a full TTL instead of retrying
  # on every message.
  printf '%s' "$now" >"$stamp" 2>/dev/null || true
  (
    tmp="$json.$$"
    if curl -fsS --connect-timeout 2 --max-time 5 \
      -H "Authorization: Bearer $token" "$base/api/me" -o "$tmp"; then
      mv -f "$tmp" "$json"
    else
      rm -f "$tmp"
    fi
  ) >/dev/null 2>&1 </dev/null & # closing stdout matters here, or Claude Code
  disown 2>/dev/null || true     # waits on the pipe for the refresh to finish
fi

# First run, or we have never once reached the proxy.
if [[ ! -s "$json" ]]; then
  printf '%s' "${dim}budget: ?${reset}"
  exit 0
fi

# current_week_spend and max_budget are JSON *strings* (Pydantic serialises
# Decimal that way), and max_budget is null for a key minted without a cap.
jq -r '[(.current_week_spend | tonumber),
        (.max_budget | if . == null then 0 else tonumber end)] | @tsv' \
  "$json" 2>/dev/null |
  awk -F'\t' '
    NF < 2 { exit }
    {
      spent = $1 + 0
      cap   = $2 + 0
      if (cap > 0) {
        # Truncate rather than round, so the bar never reads 100% short of the cap.
        pct    = int(spent / cap * 100)
        colour = ((pct >= 90) ? 31 : ((pct >= 70) ? 33 : 32))
        printf "\033[%dm$%.2f/$%.0f (%d%%)\033[0m", colour, spent, cap, pct
      } else {
        printf "$%.2f this week", spent
      }
    }'

exit 0 # a corrupt cache must not surface as a status line error
