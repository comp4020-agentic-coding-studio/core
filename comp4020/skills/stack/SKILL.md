---
name: stack
description:
  Sets up a COMP4020/COMP8020 prototype repo's build stack — installs the course
  default (Astro, from C2) or strips to bare hand-written HTML/CSS. Handles the
  GitHub Pages base path, the lockfile, and the CI link check, and leaves one
  reviewable staged diff. Works on a fresh repo or mid-week on one with
  committed work. Use for "switch to Astro", "use the course default stack",
  "set up Astro in this repo", "go bare", or "strip the build tooling".
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# COMP4020 stack

From C2 the course default stack is Astro, but your repo starts as the same
SSG-agnostic template every week. This skill closes that gap: a tested script
does the conversion the same way in every repo — config, file moves, the CI link
check — and you review the result as one staged diff. The deterministic parts
are scripted because the failure they prevent is silent: a wrong GitHub Pages
base path works perfectly on localhost and 404s on the live URL.

The default is a default, not a mandate. Bare hand-written HTML/CSS is a
legitimate answer in the static half, and this skill's other arm sets that up
with the same care. What the course does insist on: choose deliberately, and let
the agent do the wiring while you verify the outcome.

## 1. Establish the arm and the repo

Astro unless the student asked for bare. Then confirm this is a course prototype
repo: `package.json` must exist and its `name` must start with `comp4020`
(template lineage). If it doesn't, stop and say why — running a stack conversion
on an unrelated project is not what this skill is for.

## 2. Require a clean tree

The script refuses a dirty tree, so explain it before it bites: the conversion
must land as **one reviewable diff**, and mixing it with work-in-progress makes
both unreviewable. Have the student commit (or stash) first. Exception: a repo
that is already converted skips this — the script detects that state and just
re-runs the verify step.

## 3. Run the script

```sh
node "$CLAUDE_PLUGIN_ROOT/scripts/stack-astro.mjs"   # course default
node "$CLAUDE_PLUGIN_ROOT/scripts/stack-bare.mjs"    # bare arm
```

The script derives the Pages base path from the repo's origin remote, writes the
config, converts pages, homes assets, patches the CI link check, runs
`pnpm install`, stages everything, and finishes with `pnpm check`. It commits
nothing — that stays with the student. It never touches the shipped `spec/`
files, `PROCESS.md`, or `reflections/`, and neither do you.

## 4. Fix what the script hands you

The script prints a report; its `flagged` section is your work order.

- **Root-absolute `href`/`src` values** (`/images/x.png`): these break under the
  Pages base path. Make them relative, or prefix `import.meta.env.BASE_URL`.
- **Build errors on converted pages**: Astro's compiler hard-errors on unclosed
  tags that browsers silently tolerate — fix the markup, don't fight the
  compiler.
- **Unresolved stylesheet or script refs**: usually a typo'd path that was
  already broken; confirm with the student before "fixing" what may be
  deliberate.
- **(bare arm) loose TypeScript**: bare has no compile step, so `.ts` would ship
  uncompiled and 404. Convert to `.js` or remove it, the student's call.

Refactor pages into layouts or components only if the student asks — the
mechanical conversion is deliberately conservative.

## 5. Verify like it's deployed

`pnpm check` green is necessary, not sufficient. Run `pnpm dev` and look at the
site **under the base path** (`/​<repo-name>/`) — the dev server serves it there
precisely so path bugs reproduce locally instead of only on the live URL. Click
through pages; check images load.

## 6. Hand back

Changes are staged; the student reviews and commits. Two things to tell them:

- internal links written from now on must be relative (or
  `import.meta.env.BASE_URL`-prefixed) — root-absolute paths will pass local
  eyeballing and fail on Pages
- the CI link check now crawls `astro preview` under the base path, so the
  README's old `linkinator ./dist` one-liner no longer matches what CI does

The updated `pnpm-lock.yaml` is part of the staged diff — it must be committed,
or CI's `--frozen-lockfile` install fails on the next push.
