---
name: radar
description:
  Tells a COMP4020/COMP8020 student what's coming up — which crits and
  assessments are due this week and next, sorted by date, with weights — by
  reading today's date and the live course schedule. Use for "what's due", "what
  should I be working on", "what's coming up", "when's my next deadline", or a
  start-of-week check-in.
allowed-tools: Bash, WebFetch
---

# COMP4020 deadline radar

Turn the course schedule into "here's what to work on now". This is the
proactive framing of the same data **handbook** answers reactively: instead of
"when is assignment 2 due", it's "given today, what's next".

## 1. Resolve the deadlines

```sh
"$CLAUDE_PLUGIN_ROOT/scripts/next-deadline.sh"
```

One call gives you today's date, the teaching week, the student's group and
session, and every deliverable ordered by deadline with `past` / `next` /
`upcoming` already marked. It owns the arithmetic — the week calendar, the
teaching break, and the group-relative cutoff — so don't re-derive any of it.
Read the header rows before the deliverable rows; they carry the framing.

Three things to respect:

- **a non-empty `MOVED` column** — that week's session isn't in the group's
  standing slot (a public holiday), and the row's `DEADLINE`, `SESSION` and
  `ROOM` are the replacement's. Quote those, and say why it moved. The
  `session`/`cutoff`/`room` headers are the standing slot, so don't quote them
  for that week.
- **`time_known no`** — the date is real but the time is a sort key. For a crit
  that means `$COMP4020_GROUP` is unset (say "two hours before your session",
  and offer **onboard** step 5 to fix it permanently). For an assessment it
  always means the time of day lives on the assessment page: fetch
  `/api/assessments/<slug>.json` and quote the `body`, never end-of-day.
- **`in_teaching_break yes`** — nothing is due this week; look to the
  resumption.

If the script reports `needs-jq`, offer to install it (one command, and the
status line wants it too). If they decline, fetch `/api/crit-groups.json` and
work it out directly — but say that's what you're doing.

## 2. Add weight and detail

The script deliberately carries no weights, because they live with the
assessment. Fetch `/api/index.json` for `meta.weight` on the assessments in
range, and skip anything `meta.draft: true` from firm claims, or flag it as
not-yet-finalised.

## 3. Report

- Lead with the single most urgent thing: "Next up: **<title>**, due <date/time>
  (<weight>%)."
- Then a short dated list of what's in range — this week and next — each with
  its weight and its page URL so they can open the brief and spec.
- Flag anything `past` gently. They may have submitted already, or have an
  extension; don't assume they've missed it.
- Keep it a radar, not a schedule dump. Surface the near horizon and offer "want
  the whole term's deadlines?" rather than pasting all thirteen rows.
- If a piece is close and high-weight, it's fair to say so. Don't editorialise
  beyond what the dates and weights support.

## Hand off

- "am I ready to submit this?" → **preflight**
- detail on a policy, an extension rule, or what a deadline entails →
  **handbook**
- "start this week's prototype" → **start**
