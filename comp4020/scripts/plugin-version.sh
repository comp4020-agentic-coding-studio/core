#!/usr/bin/env bash
#
# Is the installed course plugin the one the marketplace publishes?
#
# Prints doctor.sh's row format — STATUS<TAB>CHECK<TAB>DETAIL — so `doctor`
# folds these straight into its report and the shipping skills can read the
# same rows without a second output shape to parse.
#
# It lives apart from doctor.sh because the answer is wanted on two very
# different paths. doctor is run at onboarding and when something is already
# broken; ship and preflight run weekly, and a stale plugin is invisible on
# that path even though it is the path where it costs something — the skill
# a student actually executes is whichever one their installed copy holds, so
# a step added after they installed simply does not exist for them.
#
# Dependency-free on purpose, matching doctor.sh: sed, awk and git only, POSIX-ish
# bash 3.2 so macOS's system bash runs it, and no jq or node — a student whose
# toolchain is half-installed still gets a true answer, and Git Bash supplies
# all three on Windows.
#
# Usage: plugin-version.sh [--no-network] [--quiet]
#   --no-network  skip the origin fetch; compare against the local checkout
#   --quiet       print only WARN/FAIL rows, so a current install says nothing
#
# Always exits 0. Like doctor.sh this reports facts and judges nothing: a stale
# plugin must never be the reason a student cannot ship before a cutoff.

set -u

NETWORK=1
QUIET=0
for arg in "$@"; do
  case "$arg" in
  --no-network) NETWORK=0 ;;
  --quiet) QUIET=1 ;;
  *)
    echo "usage: plugin-version.sh [--no-network] [--quiet]" >&2
    exit 64
    ;;
  esac
done

MARKET="$HOME/.claude/plugins/marketplaces/comp4020"
REGISTRY="$HOME/.claude/plugins/installed_plugins.json"

row() {
  case "$1" in
  PASS | INFO) [ "$QUIET" = 1 ] && return 0 ;;
  esac
  printf '%s\t%s\t%s\n' "$1" "$2" "$3"
}

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

  # The marketplace is a git clone whose checkout only moves on
  # `claude plugin marketplace update`, so with the network up compare against
  # origin: a student who has never run that would otherwise be told they are
  # current when they are weeks behind.
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

exit 0
