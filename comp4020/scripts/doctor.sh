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
windows_shell=0
case "$os" in
Linux)
  grep -qi microsoft /proc/version 2>/dev/null && platform="WSL"
  ;;
MINGW* | MSYS* | CYGWIN*)
  # Git for Windows ships Git Bash and the course requires git, so a Windows
  # student can end up running this despite the site's WSL2 steer. Report
  # rather than refuse: every row below is a true fact about *this* shell. The
  # trap worth naming is that a WSL toolchain is invisible from here and vice
  # versa, so a student straddling both sees each half as broken from the other.
  windows_shell=1
  platform="Windows ($os)"
  ;;
esac

if [ "$windows_shell" = 1 ]; then
  row WARN platform "$platform — the course expects WSL2; these rows describe this shell only, so tools installed inside WSL won't show up here"
else
  row INFO platform "$platform"
fi

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
    # Keep the headers: the HTTP status is the fact worth reading. An empty body
    # means "a 404, a 403, a rate limit or a dropped connection" — indistinguishable
    # once it's gone, and calling all of them "not a member" points a student at
    # the convenor for a problem on their own laptop. The response also carries
    # the token's scopes, so the same request answers whether the check was even
    # able to see a membership (`gh auth status` can't be grepped for that: its
    # missing-scope error names `read:org` too).
    # `gh api` accepts a relative REST endpoint.  Keeping it relative avoids
    # Git Bash/MSYS translating a leading slash into a Windows filesystem path
    # before gh sees it.
    org_out=$(gh api -i "user/memberships/orgs/$ORG" 2>/dev/null)
    org_status=$(printf '%s\n' "$org_out" | head -1 | awk '{print $2}')
    org_scopes=$(printf '%s\n' "$org_out" | grep -i '^x-oauth-scopes:' | head -1)

    case "$org_scopes" in
    *read:org* | *admin:org*) org_scope_ok=1 ;;
    *) org_scope_ok=0 ;;
    esac

    if [ "$org_status" = "200" ]; then
      org_state=$(printf '%s' "$org_out" | tr ',' '\n' | grep -o '"state":"[a-z]*"' | head -1 | cut -d'"' -f4)
      case "$org_state" in
      active) row PASS org "active member of $ORG" ;;
      pending) row FAIL org "invitation to $ORG is unaccepted (they expire after 7 days)" ;;
      *) row WARN org "unexpected membership state: ${org_state:-none reported}" ;;
      esac
    elif [ -z "$org_status" ]; then
      row WARN org "couldn't reach the GitHub API, so membership is unknown — re-run before reading anything into it"
    elif [ "$org_scope_ok" = 0 ]; then
      row FAIL org "cannot read membership (HTTP $org_status): the gh token has no read:org scope, so this check is blind"
    elif [ "$org_status" = "404" ]; then
      row FAIL org "no membership found, and gh can read org membership — so no invitation is outstanding (convenor's end)"
    elif [ "$org_status" = "401" ]; then
      row FAIL org "GitHub rejected the gh token (401), so membership is unknown"
    else
      row WARN org "membership check returned HTTP $org_status, so membership is unknown"
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
    row WARN proxy-probe "cannot reach $probe — usually means not on the ANU VPN; course-key model traffic needs the same network path"
  else
    case "$code" in
    200) row PASS proxy-probe "key accepted (200)" ;;
    401) row FAIL proxy-probe "key rejected (401) — wrong, mistyped or revoked" ;;
    403) row WARN proxy-probe "403 — reconnect the ANU VPN; all strproxy traffic, including model calls, is ANU-network only" ;;
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

  # file:line only — never the matched text. Real keys are random base64url
  # and always carry an uppercase letter; requiring one spares lowercase
  # kebab-case identifiers (CSS classes and the like).
  committed=$(git grep --cached -nE 'sk-[A-Za-z0-9_-]{20,}' 2>/dev/null \
    | grep -E 'sk-[A-Za-z0-9_-]*[A-Z]' | cut -d: -f1,2 | head -5)
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
  # Git Bash reaches the Windows host exactly as WSL does, and on both the
  # browser is a Windows install that no Unix binary name will find.
  if { [ "$platform" = "WSL" ] || [ "$windows_shell" = 1 ]; } && have powershell.exe; then
    chrome_version=$(powershell.exe -NoProfile -Command \
      "\$paths = @('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', \"\$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe\"); \$chrome = \$paths | Where-Object { Test-Path \$_ } | Select-Object -First 1; if (\$chrome) { (Get-Item \$chrome).VersionInfo.ProductVersion }" \
      2>/dev/null | tr -d '\r' | head -1)
    [ -n "$chrome_version" ] && chrome_raw="Google Chrome $chrome_version (Windows host)"
  fi
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    if [ -z "$chrome_raw" ] && have "$c"; then
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

# A version manager's shim is on PATH whether or not a version is selected: mise
# installed-but-unset writes its error to stderr and nothing to stdout, so an
# empty version here means "shim, no version", not "no runtime".
if have node; then
  node_version=$(node --version 2>/dev/null)
  case "$node_version" in
  v24.*) row PASS node "$node_version" ;;
  "") row WARN node "on PATH but reports no version — a version manager shim with nothing selected; mise use -g node@24" ;;
  *) row WARN node "$node_version (starter templates expect Node 24)" ;;
  esac
else
  row FAIL node "not installed — starter templates need Node 24"
fi

if have pnpm; then
  pnpm_version=$(pnpm --version 2>/dev/null)
  case "$pnpm_version" in
  11.*) row PASS pnpm "$pnpm_version" ;;
  "") row WARN pnpm "on PATH but reports no version — a version manager shim with nothing selected; mise use -g pnpm@11" ;;
  *) row WARN pnpm "$pnpm_version (starter templates expect pnpm 11)" ;;
  esac
else
  row FAIL pnpm "not installed — starter templates need pnpm 11"
fi

# --- claude code ------------------------------------------------------------
#
# This usually runs inside a Claude Code session, so "is it installed" is close
# to tautological — but `claude` missing from PATH is a separate, real failure:
# the status-line hook and anything else that shells out to it break while the
# session itself keeps working, which is a confusing way to find out. No
# freshness check to match the plugin rows below: Claude Code updates itself,
# and the course states no minimum version.

if have claude; then
  row PASS claude-code "$(claude --version 2>/dev/null | head -1)"
elif [ -n "${CLAUDECODE:-}" ]; then
  row WARN claude-code "session running, but claude is not on PATH — the status line and scripts that shell out to it will fail"
else
  row FAIL claude-code "not installed — onboard step 2 on the site"
fi

# --- course plugins ---------------------------------------------------------
#
# These churn early in the semester, and a stale copy answers with last week's
# facts rather than failing loudly. The marketplace is a git clone, so with the
# network up compare against origin: the checkout itself only moves on
# `claude plugin marketplace update`, and a student who has never run that would
# otherwise be told they're current.

MARKET="$HOME/.claude/plugins/marketplaces/comp4020"
REGISTRY="$HOME/.claude/plugins/installed_plugins.json"

# First "version": "..." on stdin. Every manifest puts the plugin's own version
# first, which is what both callers want.
json_version() {
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1
}

# The version the registry records for $1, or empty if it isn't installed. The
# file's top-level "version": 2 is skipped by keying on the plugin id first.
installed_version() {
  [ -f "$REGISTRY" ] || return 0
  awk -v want="\"$1@comp4020\"" '
    index($0, want) > 0 { found = 1; next }
    found && /"version"[[:space:]]*:/ {
      sub(/.*"version"[[:space:]]*:[[:space:]]*"/, "")
      sub(/".*/, "")
      print
      exit
    }' "$REGISTRY"
}

for plug in comp4020 comp4020-statusline; do
  manifest="$plug/.claude-plugin/plugin.json"
  installed=$(installed_version "$plug")

  if [ -z "$installed" ]; then
    # The status line is opt-in, so its absence is a fact, not a fault.
    if [ "$plug" = "comp4020-statusline" ]; then
      row INFO "plugin-$plug" "not installed (optional status line)"
    else
      row FAIL "plugin-$plug" "not installed — claude plugin install $plug@comp4020"
    fi
    continue
  fi

  latest=""
  if [ "$NETWORK" = "1" ] && [ -d "$MARKET/.git" ]; then
    git -C "$MARKET" fetch --quiet origin 2>/dev/null &&
      latest=$(git -C "$MARKET" show "origin/main:$manifest" 2>/dev/null | json_version)
  fi
  [ -z "$latest" ] && [ -f "$MARKET/$manifest" ] &&
    latest=$(json_version <"$MARKET/$manifest")

  if [ -z "$latest" ]; then
    row INFO "plugin-$plug" "$installed installed (could not check for a newer one)"
  elif [ "$installed" = "$latest" ]; then
    row PASS "plugin-$plug" "$installed"
  else
    row WARN "plugin-$plug" "$installed installed, $latest available — claude plugin update $plug@comp4020"
  fi
done

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
