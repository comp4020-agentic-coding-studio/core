#!/usr/bin/env bash
#
# COMP4020 environment doctor — gathers facts, makes no judgements.
#
# Prints one TAB-separated row per check:
#
#   STATUS<TAB>CHECK<TAB>DETAIL
#
#   PASS  fine                    WARN  works, but worth fixing
#   FAIL  broken, blocks work     INFO  context, not a verdict
#   SKIP  not applicable here
#
# The `doctor` skill interprets these rows and offers fixes; this script only
# reports. It is deliberately dependency-free (no jq, POSIX-ish bash that runs
# on macOS's bash 3.2) so that a machine with nothing set up can still run it,
# and it never prints the value of an API key.
#
# Usage: doctor.sh [--no-network]

set -u

ORG="comp4020-agentic-coding-studio"
DEFAULT_PROXY="https://strproxy.comp.anu.edu.au"
GROUPS_API="https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/crit-groups.json"
CHROME_MIN=140

NETWORK=1
[ "${1:-}" = "--no-network" ] && NETWORK=0

pass_n=0
warn_n=0
fail_n=0

row() {
  case "$1" in
  PASS) pass_n=$((pass_n + 1)) ;;
  WARN) warn_n=$((warn_n + 1)) ;;
  FAIL) fail_n=$((fail_n + 1)) ;;
  esac
  printf '%s\t%s\t%s\n' "$1" "$2" "$3"
}

have() { command -v "$1" >/dev/null 2>&1; }

# --- platform ---------------------------------------------------------------

os=$(uname -s 2>/dev/null || echo unknown)
platform=$os
if [ "$os" = "Linux" ] && grep -qi microsoft /proc/version 2>/dev/null; then
  platform="WSL"
fi
row INFO platform "$platform"

# --- git --------------------------------------------------------------------

if have git; then
  row PASS git "$(git --version 2>/dev/null)"
else
  row FAIL git "not installed"
fi

# --- gh ---------------------------------------------------------------------

if have gh; then
  row PASS gh "$(gh --version 2>/dev/null | head -1)"

  if gh auth status >/dev/null 2>&1; then
    row PASS gh-auth "authenticated to github.com"
  else
    row FAIL gh-auth "not logged in"
  fi

  if gh repo edit --help 2>/dev/null | grep -q accept-visibility-change-consequences; then
    row PASS gh-visibility-flag "new enough to flip a repo public"
  else
    row FAIL gh-visibility-flag "too old for the ship flip (distro build); replace it with mise use -g gh"
  fi

  if [ "$NETWORK" = "1" ]; then
    org_state=$(gh api "/user/memberships/orgs/$ORG" --jq .state 2>/dev/null)
    if [ -n "$org_state" ]; then
      case "$org_state" in
      active) row PASS org "active member of $ORG" ;;
      pending) row FAIL org "invitation to $ORG is unaccepted (they expire after 7 days)" ;;
      *) row WARN org "unexpected membership state: $org_state" ;;
      esac
    elif gh auth status 2>&1 | grep -q "read:org"; then
      row FAIL org "no membership found, and gh has read:org — so no invitation is outstanding (convenor's end)"
    else
      row FAIL org "cannot read membership: gh is missing the read:org scope, so this check is blind"
    fi
  else
    row SKIP org "network checks disabled"
  fi
else
  row FAIL gh "not installed"
fi

# --- flyctl -----------------------------------------------------------------

fly_bin=""
have flyctl && fly_bin=flyctl
[ -z "$fly_bin" ] && have fly && fly_bin=fly

if [ -n "$fly_bin" ]; then
  row PASS flyctl "$($fly_bin version 2>/dev/null | head -1)"
  if [ "$NETWORK" = "1" ]; then
    if $fly_bin auth whoami >/dev/null 2>&1; then
      row PASS flyctl-auth "logged in"

      # Each student gets their own linked org (comp4020-<uid>), so there is no
      # single name to assert — just that a non-personal one is there. The Type
      # column is the discriminator; the personal org is named after the person,
      # so matching on the name would not work.
      orgs=$($fly_bin orgs list 2>/dev/null | grep -c 'SHARED')
      if [ "${orgs:-0}" -gt 0 ]; then
        row PASS flyctl-orgs "member of an org beyond personal"
      else
        row WARN flyctl-orgs "only a personal org — the course invitation isn't accepted yet"
      fi
    else
      row WARN flyctl-auth "not logged in"
      row SKIP flyctl-orgs "not logged in"
    fi
  else
    row SKIP flyctl-auth "network checks disabled"
    row SKIP flyctl-orgs "network checks disabled"
  fi
else
  row WARN flyctl "not installed (needed from the full-stack half, week 8)"
fi

# --- Claude Code / strproxy -------------------------------------------------

base_url=${ANTHROPIC_BASE_URL:-}
token=${ANTHROPIC_AUTH_TOKEN:-}
model=${ANTHROPIC_MODEL:-}

user_settings="$HOME/.claude/settings.json"
repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
repo_settings=""
[ -n "$repo_root" ] && repo_settings="$repo_root/.claude/settings.local.json"

settings_with_key=""
for f in "$user_settings" "$repo_settings"; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  if grep -q ANTHROPIC_AUTH_TOKEN "$f" 2>/dev/null; then
    settings_with_key="$settings_with_key $f"
  fi
done

if [ -n "$token" ]; then
  row PASS proxy-key "ANTHROPIC_AUTH_TOKEN is set in this session"
elif [ -n "$settings_with_key" ]; then
  row WARN proxy-key "a key is in$settings_with_key but not in this session — settings apply to new sessions"
else
  row FAIL proxy-key "no ANTHROPIC_AUTH_TOKEN in the session or in settings"
fi

if [ -n "$base_url" ]; then
  row PASS proxy-url "ANTHROPIC_BASE_URL=$base_url"
else
  row WARN proxy-url "ANTHROPIC_BASE_URL unset (defaults to Anthropic, not the course proxy)"
fi

if [ -n "$model" ]; then
  row PASS model-pin "ANTHROPIC_MODEL=$model"
else
  row WARN model-pin "ANTHROPIC_MODEL unpinned — API keys default to Opus, which burns the weekly budget several times faster"
fi

if [ "$NETWORK" = "1" ] && [ -n "$token" ]; then
  probe="${base_url:-$DEFAULT_PROXY}/api/me"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
    -H "Authorization: Bearer $token" "$probe" 2>/dev/null)
  curl_rc=$?
  if [ "$curl_rc" != "0" ]; then
    row WARN proxy-probe "cannot reach $probe — usually means not on the ANU VPN; model traffic is unaffected"
  else
    case "$code" in
    200) row PASS proxy-probe "key accepted (200)" ;;
    401) row FAIL proxy-probe "key rejected (401) — wrong, mistyped or revoked" ;;
    403) row WARN proxy-probe "403 — /api/* is ANU-network only; model traffic is unaffected" ;;
    *) row WARN proxy-probe "unexpected HTTP $code" ;;
    esac
  fi
else
  row SKIP proxy-probe "no key to probe with, or network checks disabled"
fi

# --- crit group -------------------------------------------------------------

group=${COMP4020_GROUP:-}
if [ -z "$group" ]; then
  row WARN crit-group "COMP4020_GROUP unset — deadline-aware skills can't quote your actual cutoff"
elif [ "$NETWORK" = "1" ]; then
  groups_json=$(curl -s --max-time 15 "$GROUPS_API" 2>/dev/null)
  if [ -z "$groups_json" ]; then
    row WARN crit-group "COMP4020_GROUP=$group (could not reach the course site to check it against the group list)"
  elif printf '%s' "$groups_json" | grep -q "\"agent\"[[:space:]]*:[[:space:]]*\"$group\""; then
    row PASS crit-group "COMP4020_GROUP=$group"
  else
    row WARN crit-group "COMP4020_GROUP=$group is not one of the published group ids"
  fi
else
  row PASS crit-group "COMP4020_GROUP=$group (not checked against the group list)"
fi

# --- pre-commit key guard (course repos only) -------------------------------

if [ -n "$repo_root" ] && [ -f "$repo_root/.githooks/pre-commit" ]; then
  hooks_path=$(git config core.hooksPath 2>/dev/null)
  if [ "$hooks_path" = ".githooks" ]; then
    row PASS key-guard "core.hooksPath=.githooks"
  else
    row FAIL key-guard "core.hooksPath is '${hooks_path:-unset}' — the key guard is off; run pnpm install"
  fi

  # file:line only — never the matched text
  committed=$(git grep --cached -nE 'sk-[A-Za-z0-9_-]{20,}' 2>/dev/null | cut -d: -f1,2 | head -5)
  if [ -n "$committed" ]; then
    row FAIL committed-key "key-shaped string already committed at: $(printf '%s' "$committed" | tr '\n' ' ')"
  else
    row PASS committed-key "nothing key-shaped in the index"
  fi
else
  row SKIP key-guard "not inside a course template repo"
fi

# --- Chrome -----------------------------------------------------------------

chrome_raw=""
if [ "$os" = "Darwin" ]; then
  mac_chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [ -x "$mac_chrome" ] && chrome_raw=$("$mac_chrome" --version 2>/dev/null)
else
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    if have "$c"; then
      chrome_raw=$("$c" --version 2>/dev/null)
      break
    fi
  done
fi

if [ -n "$chrome_raw" ]; then
  chrome_major=$(printf '%s' "$chrome_raw" | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  if [ -n "$chrome_major" ] && [ "$chrome_major" -ge "$CHROME_MIN" ] 2>/dev/null; then
    row PASS chrome "$chrome_raw"
  else
    row WARN chrome "$chrome_raw (course expects $CHROME_MIN or newer)"
  fi
else
  row WARN chrome "not found in the usual place (you may have it installed elsewhere)"
fi

# --- local development toolchain --------------------------------------------

if have node; then
  node_version=$(node --version 2>/dev/null)
  case "$node_version" in
  v24.*) row PASS node "$node_version" ;;
  *) row WARN node "$node_version (starter templates expect Node 24)" ;;
  esac
else
  row FAIL node "not installed — starter templates need Node 24"
fi

if have pnpm; then
  pnpm_version=$(pnpm --version 2>/dev/null)
  case "$pnpm_version" in
  11.*) row PASS pnpm "$pnpm_version" ;;
  *) row WARN pnpm "$pnpm_version (starter templates expect pnpm 11)" ;;
  esac
else
  row FAIL pnpm "not installed — starter templates need pnpm 11"
fi

# --- supporting tooling -----------------------------------------------------

if have jq; then
  row PASS jq "$(jq --version 2>/dev/null)"
else
  row WARN jq "not installed — the deadline and status-line scripts need it; mise use -g jq"
fi

if have mise; then
  row PASS mise "$(mise --version 2>/dev/null | head -1)"
else
  row WARN mise "not installed — how the course installs its command-line tools; another manager is fine if it supplies the template's Node and pnpm versions"
fi

# --- summary ----------------------------------------------------------------

row INFO summary "$pass_n pass, $warn_n warn, $fail_n fail"
exit 0
