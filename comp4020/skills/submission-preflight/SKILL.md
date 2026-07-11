---
name: submission-preflight
description:
  Checks that a COMP4020/COMP8020 student's work is actually submittable before
  a crit or assignment deadline — the local repo is committed and pushed to
  GitHub, matches the assessment spec's required structure, and (in the
  full-stack half) is deployed and reachable. Use before a submission, or when
  the user asks "am I ready to submit", "is my crit/assignment ready", or "did I
  push everything".
---

# COMP4020 submission preflight

Catch the things that cost marks for no good reason — uncommitted work, an
unpushed branch, a private repo the marker can't see, a deploy that 500s —
before a crit or assignment deadline, not after. This crosses the **assessment
spec** (from the course site) with the **student's actual repo state**.

## 1. Which submission, and which repo?

- **The spec**: identify the crit or assessment in question. Ask if it's
  ambiguous, otherwise infer from context/date. Fetch its details via the same
  API the **course-info** skill uses (`/api/index.json`, then the node's JSON
  for the full `body`): the `body` states what to submit and how, and `meta`
  carries `due`/`week`/`weight`. Quote the real due time from the body, not just
  the ISO date.
- **Crit cutoffs are group-relative** — two hours before the student's own
  session, so a different time for every crit group. Read `$COMP4020_GROUP` (set
  during **quickstart**) and resolve the session and cutoff from the crit-group
  data at `/api/crit-groups.json` (one entry per group, keyed by agent name,
  with `session` and `cutoff` fields). If the variable is unset, say "two hours
  before your session", ask which group they're in, and offer to save it
  (quickstart, step 6) so it's never asked again.
- **The repo**: default to the git repo in the current directory. Confirm it's
  the right one (`gh repo view` / `git remote -v`) before judging it.

## 2. Repo checks (both halves of the course)

Classify each PASS / WARN / FAIL:

- **Clean working tree** — `git status --porcelain`. Uncommitted or untracked
  files that belong in the submission are a FAIL; offer to stage and commit them
  (by name, after showing what they are).
- **Everything pushed** — `git status -sb` and
  `git log --oneline @{upstream}..HEAD`. Local commits ahead of the remote mean
  the marker won't see them. FAIL; offer to `git push`.
- **Remote is on GitHub** — all course submissions go through GitHub. A missing
  or non-GitHub remote is a FAIL.
- **Marker can see it** — `gh repo view --json visibility,url`. Repos are
  private while building and public from the cutoff, so a still-private repo
  close to the cutoff is a WARN, not a FAIL: it's the normal state right up
  until the student ships. Point them at **ship** rather than flipping it
  yourself.
- **Required structure** — read the spec `body` for anything concrete it demands
  (a README, a specific entry point, a licence, a particular directory). Check
  what's mechanically checkable and present the rest as a short manual checklist
  rather than guessing pass/fail on prose requirements.

## 3. Deploy checks (full-stack half, weeks 7+)

Only relevant once the course expects a live deployment — skip in the static
half unless the spec asks for a deployed URL.

- **Static (GitHub Pages)**: `gh run list --limit 5` — did the most recent Pages
  build succeed? A red build means the live site is stale or broken. Point them
  at the failing run (`gh run view`).
- **Fly.io**: `flyctl status` in the app dir — is the app deployed and healthy?
  A stopped/failed machine, or the wrong app, is a FAIL. If flyctl isn't set up,
  defer to the **doctor** skill.
- **It actually loads**: if the spec wants a reachable URL, a quick
  `curl -sf -o /dev/null -w '%{http_code}' <url>` confirms it responds (2xx/3xx)
  rather than 500-ing or 404-ing.

## 4. Report

- Lead with a one-line verdict: **ready to submit** / **not ready — N
  blockers**.
- List blockers (FAIL) first with the exact fix, then WARNs, then the manual
  checklist for anything you couldn't verify mechanically.
- Restate the due date/time and how much the piece is worth, and cite the
  assessment page URL so they can double-check the spec themselves.
- Offer to run the fixes you can (commit, push), confirming each. Don't submit
  _for_ them — submission is their deliberate act; you get them to the point
  where it's a single clean step.

## Notes

- The build fails loudly for real problems but stays advisory on prose spec
  requirements — never claim a submission is compliant with a written rubric you
  can only partly check. Say what you verified and what you didn't.
- If you can't route the submission to a spec node on the site, don't invent
  requirements — check the mechanical repo/deploy state and tell them to confirm
  the spec details against the assessment page.
- This skill never flips a repo public. That is the one irreversible act in the
  course, and it has exactly one entry point, so that the secret scan always
  runs before it. Diagnose here; act in **ship**.

## Hand off

- "ready — now ship it" → **ship**
- "what's due this week?" → **deadline-radar**
- "start this week's prototype" → **new-week**
- "is my machine set up right?" → **doctor**
