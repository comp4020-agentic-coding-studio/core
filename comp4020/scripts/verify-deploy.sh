#!/usr/bin/env bash
# Verify a deployed URL the way a browser would: the page serves, *and* the
# assets it references resolve.
#
# A status code on the page alone cannot see the failure this exists to catch.
# A project Pages site is served from /<repo>/, so a build configured for the
# domain root emits <link href="/_astro/index.css">, the page still returns
# 200, and every stylesheet 404s — a live URL serving an unstyled page. That is
# invisible on localhost, where the site sits at the root and the same path
# resolves, and invisible to a CI link check run against ./dist for the same
# reason. Fetching one referenced asset is what closes the gap.
#
# Only same-origin css/js are checked: an off-site font or CDN is not the
# student's deploy to police, and a flaky third party must not read as a
# broken submission.
#
# usage: verify-deploy.sh <url>
# exit:  0 page and assets resolve   1 page not serving   2 assets missing
set -uo pipefail

usage() {
  echo "usage: verify-deploy.sh <url>" >&2
  exit 64
}

[ $# -eq 1 ] || usage
url=$1
case $url in
  http://* | https://*) ;;
  *) usage ;;
esac

page=$(mktemp) || exit 1
trap 'rm -f "$page"' EXIT

fetch_code() {
  curl -sS -L -o "$2" -w '%{http_code}' --max-time 20 "$1" 2>/dev/null || echo 000
}

# The site takes a moment to come up after a workflow finishes, so poll rather
# than declaring failure on the first miss.
code=000
attempt=1
while [ "$attempt" -le 10 ]; do
  code=$(fetch_code "$url" "$page")
  case $code in
    2??) break ;;
  esac
  sleep 3
  attempt=$((attempt + 1))
done

echo "page   $code  $url"
case $code in
  2??) ;;
  *)
    echo "the page is not serving, so there is nothing downstream to check" >&2
    exit 1
    ;;
esac

origin=$(printf '%s' "$url" | sed -e 's|^\(https*://[^/]*\).*|\1|')

# the directory a relative ref resolves against
base=${url%%\#*}
base=${base%%\?*}
if [ "$base" = "$origin" ]; then
  base="$origin/"
else
  case $base in
    */) ;;
    *) base=${base%/*}/ ;;
  esac
fi

# Trailing `"` is required so a `.json` ref cannot match as `.js`.
assets=$(grep -oE '(href|src)="[^"]+\.(css|js)(\?[^"]*)?"' "$page" |
  sed -e 's/^[a-z]*="//' -e 's/"$//' | sort -u | head -20)

missing=0
checked=0
# A here-doc, not a pipe: bash 3.2 runs the right-hand side of a pipe in a
# subshell, where the counters below would be lost.
while IFS= read -r ref; do
  [ -n "$ref" ] || continue
  case $ref in
    //* | http://* | https://*) continue ;;
    /*) target="$origin$ref" ;;
    ./*) target="$base${ref#./}" ;;
    *) target="$base$ref" ;;
  esac
  acode=$(fetch_code "$target" /dev/null)
  checked=$((checked + 1))
  case $acode in
    2??) echo "asset  $acode  $ref" ;;
    *)
      echo "asset  $acode  $ref  ->  $target"
      missing=$((missing + 1))
      ;;
  esac
done <<EOF
$assets
EOF

if [ "$checked" -eq 0 ]; then
  echo "no same-origin css/js referenced — nothing to resolve"
  exit 0
fi

if [ "$missing" -gt 0 ]; then
  echo "" >&2
  echo "$missing of $checked referenced asset(s) did not resolve." >&2
  echo "The page serves but will render without them. A root-absolute ref" >&2
  echo "(/_astro/..., /assets/...) under a project Pages URL is the usual" >&2
  echo "cause: the build is configured for the domain root, not for" >&2
  echo "${base}. Set the base path and redeploy — the stack skill" >&2
  echo "wires it up, or set Astro's \`base\` by hand." >&2
  exit 2
fi

echo "ok — the page and $checked referenced asset(s) all resolve"
