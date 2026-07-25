#!/usr/bin/env bash
#
# COMP4020 deadline resolver — the one place the cutoff arithmetic lives.
#
# Fetches the published crit-group data and turns it into an ordered list of
# every deliverable with a real deadline attached, so that no skill has to
# re-derive "the cutoff is two hours before your group's session, in the week
# whose Monday is in the calendar, except during the teaching break".
#
# Output is TAB-separated. Header rows are `key<TAB>value`; then one row per
# deliverable, earliest deadline first:
#
#   deliverable  STATE  KIND  SLUG  TITLE  WEEK  DEADLINE  TIME_KNOWN  REPO_PREFIX  PAGE
#
#   STATE       past | next | upcoming   (`next` is the first deadline still ahead)
#   DEADLINE    YYYY-MM-DDTHH:MM in the course timezone
#   TIME_KNOWN  yes  — the time is real, quote it
#               no   — the date is real but the time is a sort key only. Crits
#                      need $COMP4020_GROUP for a real time; assessments state
#                      their time of day on the assessment page, not here.
#
# Usage:
#   next-deadline.sh [--group <id>] [--today YYYY-MM-DD] [--json <file>]
#
# Exit: 0 ok · 3 jq missing · 4 could not get the data · 5 bad arguments.

set -u

BASE="https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio"
API="$BASE/api/crit-groups.json"
TZ_COURSE="Australia/Canberra"

group=${COMP4020_GROUP:-}
today=""
json_file=""

while [ $# -gt 0 ]; do
  case "$1" in
  --group)
    group=${2:-}
    shift 2
    ;;
  --today)
    today=${2:-}
    shift 2
    ;;
  --json)
    json_file=${2:-}
    shift 2
    ;;
  *)
    printf 'status\tbad-argument\t%s\n' "$1" >&2
    exit 5
    ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  printf 'status\tneeds-jq\n'
  printf 'hint\tinstall jq: brew install jq (macOS) | sudo apt install jq (Debian/Ubuntu/WSL) | mise use -g jq\n'
  printf 'hint\tor fetch %s and work the deadline out directly\n' "$API"
  exit 3
fi

# The course runs on Canberra time whatever the laptop is set to. Both GNU and
# BSD date honour TZ, so this is portable; if the zone is unknown it falls back
# to local time, which is close enough to order deadlines by.
if [ -n "$today" ]; then
  now="${today}T00:00" # --today is "pretend it is this date", for testing
else
  now=$(TZ="$TZ_COURSE" date +'%Y-%m-%dT%H:%M' 2>/dev/null || date +'%Y-%m-%dT%H:%M')
  today=$(printf '%s' "$now" | cut -c1-10)
fi

if [ -n "$json_file" ]; then
  payload=$(cat "$json_file" 2>/dev/null)
else
  payload=$(curl -sS --max-time 20 "$API" 2>/dev/null)
fi

if [ -z "$payload" ]; then
  printf 'status\tno-data\n'
  printf 'hint\tcould not read %s\n' "${json_file:-$API}"
  exit 4
fi

printf '%s' "$payload" | jq -r \
  --arg group "$group" --arg now "$now" --arg today "$today" --arg base "$BASE" '
  def dayoffset: {"Mon":0,"Tue":1,"Wed":2,"Thu":3,"Fri":4}[.];

  . as $root
  | ($root.weeks | map({key: (.week|tostring), value: .monday}) | from_entries) as $weeks
  | ($root.groups | map(select(.agent == $group)) | first) as $g
  | ($root.deliverables
     | map(
         . as $d
         | $weeks[$d.week|tostring] as $monday
         | (if $d.kind == "crit" then
              (if $g then
                 ((($monday + "T00:00:00Z" | fromdateiso8601)
                   + (86400 * ($g.day | dayoffset))) | strftime("%Y-%m-%d")) as $date
                 | {deadline: ($date + "T" + $g.cutoffTime), known: "yes"}
               else
                 {deadline: ($monday + "T00:00"), known: "no"}
               end)
            else
              {deadline: ($d.due + "T23:59"), known: "no"}
            end) as $dl
         | {kind: $d.kind, slug: $d.slug, title: $d.title, week: $d.week,
            prefix: $d.repoPrefix, deadline: $dl.deadline, known: $dl.known,
            page: ($base + (if $d.kind == "crit" then "/crits/" else "/assessments/" end)
                   + $d.slug + "/")}
       )
     | sort_by(.deadline)) as $ds
  | ($ds | map(select(.deadline >= $now)) | first) as $next

  | [ ["status", (if $group == "" then "ok-no-group"
                  elif $g == null then "ok-unknown-group"
                  else "ok" end)],
      ["today", $today],
      ["now", $now],
      ["timezone", $root.timezone],
      ["group", (if $group == "" then "unset" else $group end)],
      ["session", ($g.session // "")],
      ["cutoff", ($g.cutoff // "")],
      ["room", ($root.room // "")],
      ["tutor", (if $g then ($g.tutor.name + " (" + $g.tutor.slug + ")") else "" end)],
      ["teaching_week",
        (($root.weeks | map(select(.monday <= $today)) | last | .week) // "before-semester"
         | tostring)],
      ["in_teaching_break",
        (if ($today >= $root.teachingBreak.start) and ($today < $root.teachingBreak.end)
         then "yes" else "no" end)]
    ]
    + ($ds | map(
        ["deliverable",
         (if .deadline < $now then "past"
          elif $next != null and .deadline == $next.deadline then "next"
          else "upcoming" end),
         .kind, .slug, .title, (.week|tostring), .deadline, .known, .prefix, .page]))
  | .[] | @tsv
'
