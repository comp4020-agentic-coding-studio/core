#!/usr/bin/env bash
#
# COMP4020 crit group id normaliser — the one place a typed group name becomes
# a published group id.
#
# The site shows the agents' names in tone-marked pinyin (Liùrú, Shítāo), but
# the ids in crit-groups.json are plain lowercase ASCII (liuru, shitao). A
# student who copies the name off the page would otherwise match nothing, so
# this strips the tone marks, lowercases, and trims surrounding whitespace.
# Each mark is its own literal substitution, so it works byte-wise in any locale
# (bash 3.2 and BSD sed included) without iconv, whose transliteration differs
# between platforms.
#
# Usage: group-id.sh <name>    prints the id, or nothing for an empty name

set -u

printf '%s' "${1:-}" |
  sed -e 's/ā/a/g' -e 's/á/a/g' -e 's/ǎ/a/g' -e 's/à/a/g' \
    -e 's/Ā/a/g' -e 's/Á/a/g' -e 's/Ǎ/a/g' -e 's/À/a/g' \
    -e 's/ē/e/g' -e 's/é/e/g' -e 's/ě/e/g' -e 's/è/e/g' \
    -e 's/Ē/e/g' -e 's/É/e/g' -e 's/Ě/e/g' -e 's/È/e/g' \
    -e 's/ī/i/g' -e 's/í/i/g' -e 's/ǐ/i/g' -e 's/ì/i/g' \
    -e 's/Ī/i/g' -e 's/Í/i/g' -e 's/Ǐ/i/g' -e 's/Ì/i/g' \
    -e 's/ō/o/g' -e 's/ó/o/g' -e 's/ǒ/o/g' -e 's/ò/o/g' \
    -e 's/Ō/o/g' -e 's/Ó/o/g' -e 's/Ǒ/o/g' -e 's/Ò/o/g' \
    -e 's/ū/u/g' -e 's/ú/u/g' -e 's/ǔ/u/g' -e 's/ù/u/g' \
    -e 's/Ū/u/g' -e 's/Ú/u/g' -e 's/Ǔ/u/g' -e 's/Ù/u/g' \
    -e 's/ǖ/u/g' -e 's/ǘ/u/g' -e 's/ǚ/u/g' -e 's/ǜ/u/g' -e 's/ü/u/g' \
    -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' |
  tr '[:upper:]' '[:lower:]'
