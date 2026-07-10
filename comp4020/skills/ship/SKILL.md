---
name: ship
description:
  Ships a COMP4020/COMP8020 deliverable — flips the repo public, enables GitHub
  Pages, triggers the deploy and checks the live URL actually serves. Use when
  the user says "ship it", "make my repo public", "flip it public", "publish my
  prototype", "enable Pages", or "deploy for the crit". Not for checking whether
  the work is ready; that's submission-preflight.
---

# COMP4020 ship

This is the one irreversible thing you will do in this course. The moment the
repo goes public, your entire commit history and every CI log in it have been
served to the world. A later `git push --force` does not unring that: it was
fetched, cached, and possibly indexed. Treat the flip with the seriousness it
deserves, and never do it on a repo you haven't just read.

Everything up to the flip is reversible. The flip is not. So this skill does the
checking first, the scanning second, and the flip last, and it stops at the
first sign of trouble.

## 1. Confirm what you're shipping

Default to the git repo in the current directory, and confirm it before judging
it (`gh repo view --json nameWithOwner,visibility,isArchived`). It must be in
the `comp4020-agentic-coding-studio` org — a repo under a personal account is
not the one your tutor marks, and shipping it publishes work to a place nobody
is looking.

Then identify the deliverable and quote its real cutoff from the course site
(the same `/api/index.json` route **course-info** uses). Shipping after the
cutoff is allowed and shipping early costs nothing, but the student should hear
the actual time out loud before anything becomes public.

## 2. Is it even ready?

Run **submission-preflight** and read its verdict. If it reports any FAIL, stop
and say so. Do not offer to flip anyway: a public repo with uncommitted work in
the tree is worse than a private repo with the same, because now the gap is
permanent and visible.

WARNs are the student's call. Show them, ask, continue only on a clear yes.

## 3. Scan for secrets, before the flip

This is the step that cannot be done afterwards. Look through the working tree
**and the history** — the history is the part people forget:

```sh
git log --all -p | rg -i 'api[_-]?key|secret|token|password|BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}'
gh api /repos/{owner}/{repo}/actions/runs --jq '.workflow_runs[].id'   # logs go public too
```

Also check for the things a course repo specifically accumulates: an
`ANTHROPIC_API_KEY` pasted into a `.env` that got committed once and deleted
later, a `.claude/settings.local.json`, a fly.io deploy token in a script.

Anything you find is a **stop**. Removing a secret from the tip commit does not
remove it from history, and rewriting history on a repo that has never been
public is easy while doing it afterwards is not. Tell them to rotate the
credential regardless, because a leaked key must be assumed leaked.

If it's clean, say what you searched for and what you did not. You are not a
secret scanner, and a green result here is not a guarantee.

## 4. Flip, deploy, verify

Confirm explicitly, in one sentence that names what becomes public: _"this makes
`<repo>` — all source, all commit history, all CI logs — permanently public.
Proceed?"_ Then, and only then:

```sh
gh repo edit <owner>/<repo> --visibility public --accept-visibility-change-consequences
```

You are a repo admin on your own repo, so this works. If it 403s, you are not
admin, or the org has restricted visibility changes — say so, don't retry.

For the **static half** (weeks 2–6), the flip is what makes Pages available.
Enable it from the default branch, then dispatch the deploy workflow and wait:

```sh
gh api -X POST /repos/{owner}/{repo}/pages -f 'source[branch]=main' -f 'source[path]=/'
gh workflow run <deploy workflow> && gh run watch
```

For the **full-stack half** (weeks 8+), the deploy is fly.io and doesn't depend
on visibility at all — `flyctl deploy`, then check the machine is healthy.

Verify the live URL yourself. A Pages site takes a minute or two to build after
being enabled, so poll rather than declaring victory:

```sh
curl -sf -o /dev/null -w '%{http_code}' <url>
```

Report the URL and the status code. A repo that never deployed is worth no
marks, so "the flip worked" is not the finish line — a 2xx at the live URL is.

## Notes

- Never flip a repo that isn't the student's own deliverable. Read the owner and
  the name back to them first.
- Never `--force` anything, and never rewrite history on a public repo.
- A repo that is already public when you arrive is not an error — the student
  flipped it earlier; skip to the deploy and verify steps. Nothing in the course
  flips a student repo automatically: if it is still private, nobody has shipped
  it.
- Archived repos are read-only. If `isArchived` is true the student has been
  off-boarded; do not try to work around it, ask them to talk to the convenor.

## Hand off

- "am I ready to submit?" → **submission-preflight**
- "what's due this week?" → **deadline-radar**
- "start next week's prototype" → **new-week**
