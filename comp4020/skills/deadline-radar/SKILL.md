---
name: deadline-radar
description:
  Tells a COMP4020/COMP8020 student what's coming up — which crits and
  assessments are due this week and next, sorted by date, with weights — by
  reading today's date and the live course schedule. Use for "what's due", "what
  should I be working on", "what's coming up", "when's my next deadline", or a
  start-of-week check-in.
---

# COMP4020 deadline radar

Turn the course schedule into "here's what to work on now". This is the
proactive framing of the same data the **course-info** skill answers reactively:
instead of "when is assignment 2 due", it's "given today, what's next".

## 1. Anchor to today

Get the real current date from the machine — `date +%Y-%m-%d` — never assume it.
Everything downstream is relative to this.

## 2. Pull the schedule

Fetch `/api/index.json` from the course site (base URL
`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio`). Collect every
node with a deadline or a week:

- **assessments** — `meta.due` (ISO date), `meta.weight` (% of grade),
  `meta.week`.
- **crits** — `meta.week` (weekly studio critiques; `meta.week` is
  authoritative, since the crit slug number is not the week number).

For precise due _times_ (not just the date) and exactly what each item asks for,
fetch the node's own JSON (`/api/<collection>/<slug>.json`) and read the `body`
— quote the real time-of-day/timezone rather than assuming end-of-day.

## 3. Turn week numbers into dates

Crits carry a `meta.week`, not a date. Map week → the Monday that week starts
using the course calendar below. Note the **two-week teaching break** between
weeks 6 and 7 — weeks 7–12 do _not_ follow a naive `week × 7` from term start.

Semester 2, 2026 (term starts Monday 27 July; 6 teaching weeks, a two-week
break, then 6 more):

| Week | Monday | Week | Monday |
| ---- | ------ | ---- | ------ |
| 1    | 27 Jul | 7    | 21 Sep |
| 2    | 3 Aug  | 8    | 28 Sep |
| 3    | 10 Aug | 9    | 5 Oct  |
| 4    | 17 Aug | 10   | 12 Oct |
| 5    | 24 Aug | 11   | 19 Oct |
| 6    | 31 Aug | 12   | 26 Oct |

(Break: weeks of 7 Sep and 14 Sep — no teaching.) Update this table each time
the plugin is reused for a new offering; it's the one course-instance fact this
skill hard-codes because the site's API exposes week numbers, not dates.

A crit in week N happens during the week beginning at that Monday. Give the
Monday as the date unless the crit's own page `body` names a specific day/time.

## 4. Order and bucket

Sort by due date ascending (crits by their week's Monday, assessments by
`meta.due`). Bucket relative to today:

- **overdue** — past due (flag gently; they may already have submitted, or have
  an extension — don't assume they've missed it).
- **this week** / **next week** / **later**.

If today falls in the two-week break, say so — nothing is due _this_ week; look
to the resumption in week 7. Skip anything marked `meta.draft: true` from firm
claims, or flag it as not-yet-finalised.

## 4. Report

- Lead with the single most urgent thing: "Next up: **<title>**, due <date/time>
  (<weight>%)."
- Then a short dated list of what's in range (this week + next), each with its
  weight and the page URL (`base + /<node-id>/`) so they can open the spec.
- Keep it a radar, not a full schedule dump — surface the near horizon, and
  offer "want the whole term's deadlines?" rather than pasting everything.
- If a piece is close and high-weight, it's fair to say so; don't editorialise
  beyond what the dates and weights support.

## Hand off

- "Am I ready to submit this?" → the **submission-preflight** skill.
- Detail on a specific policy, extension rule, or what a deadline entails →
  **course-info**.
