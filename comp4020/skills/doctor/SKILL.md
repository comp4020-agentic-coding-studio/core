---
name: doctor
description:
  Checks a COMP4020/COMP8020 student's machine against the course's required
  environment — Git, the GitHub CLI (gh), course GitHub org membership, flyctl,
  Claude Code's proxy config, Chrome, Node, pnpm and mise — including whether
  the tools that hit external services are actually authenticated, then offers
  to fix what's broken. Use for "check my setup", "is everything installed", "why isn't
  gh/fly/claude working", "am I in the course GitHub org", or any
  setup/environment health check.
allowed-tools: Bash, Read, Edit, Write, WebFetch
---

# COMP4020 environment doctor

Diagnose the student's local setup, then **offer to fix** what's wrong. This
skill owns the diagnosis; **quickstart** owns the fixes, so findings here hand
off there rather than restating the setup steps.

## 1. Run the check script

```sh
"$CLAUDE_PLUGIN_ROOT/scripts/doctor.sh"
```

If `$CLAUDE_PLUGIN_ROOT` isn't set, the script is at `scripts/doctor.sh` inside
the installed `comp4020` plugin (under `~/.claude/plugins/`); find it rather
than performing the checks by hand, so every student gets the same verdicts.
`--no-network` skips the checks that call out, if they're offline and impatient.

It prints one TAB-separated row per check — `STATUS`, `CHECK`, `DETAIL` — and
detects the platform itself (macOS, Linux, WSL). Everything it reports is a
fact; the judgement below is yours.

## 2. Ground truth: the site's tool list

The canonical list of required and recommended tools is the course site's
quickstart page, so fetch it and cross-check:

```
https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/topics/quickstart.json
```

If the page names a tool the script doesn't check, report it as "listed on the
site — verify manually" rather than skipping it silently. That gap means the
plugin has drifted from the site, which is worth flagging to the convenor.

## 3. Interpret

Most rows say what they mean. These are the ones that need judgement:

- **`proxy-probe` unreachable** — almost always "not on the ANU VPN". Only
  `/api/*` is network-restricted; their actual Claude sessions still work, so
  don't report this as a broken setup. A `401`, by contrast, is a real failure:
  the key is wrong or revoked.
- **`proxy-key` missing** — could mean unconfigured, or could mean a student
  with their own Claude plan who has scoped the course key to course repos. The
  vars being absent _outside_ a course repo is that setup working. Ask which
  before routing them anywhere.
- **`gh-visibility-flag` FAIL** — a distro-packaged `gh` (Ubuntu still ships
  2.45) can't flip a repo public, and it fails at the cutoff, which is the worst
  possible moment to find out. Worth fixing now even though nothing is broken
  today.
- **`org` FAIL** — read the detail. A pending invitation, a missing `read:org`
  scope, and no invitation at all have three different fixes, and the script
  says which one it found. Never guess between them: telling a student to email
  the convenor about a scope problem on their own laptop wastes everyone's week.
- **`flyctl` WARN** — only matters from the full-stack half (week 8). Say so
  rather than presenting it as an outstanding failure in week 3. The course
  covers Fly billing, so also remind them not to add a payment method; there's
  no CLI check for that.
- **`flyctl-orgs` WARN** — each student's app lives in their own per-student
  linked Fly org (`comp4020-<uid>`), not one shared course org, so there is no
  single org name to assert. What matters is that the account shows a `SHARED`
  org at all; only a `PERSONAL` one means the invitation hasn't been accepted,
  and those go out ahead of the full-stack half.
- **`crit-group` WARN** — nothing breaks, but **deadline-radar**,
  **submission-preflight** and **ship** can only say "two hours before your
  session" instead of naming the real cutoff.
- **`committed-key` FAIL** — report the file and line **only, never the matched
  value**. The key has to come out of the file; if the commit was ever pushed,
  treat it as leaked and get it rotated via a private Ed thread.
- **`mise` WARN** — mise is the course's supported runtime path, and every
  starter template pins its Node and pnpm versions in `mise.toml`. Do not call a
  student off piste merely for using nvm, Volta, asdf or system installers:
  `node` and `pnpm` working at the template's versions is sufficient. Explain
  that tutor support reproduces runtime problems with mise; offer `mise install`
  from the repo root if they want the supported path.

Two things the script deliberately doesn't check. **Permission mode**: if you
can see they're in default or plan mode, mention auto mode as a flow improvement
— never nudge toward `--dangerously-skip-permissions`. **Native Windows**: no
Unix shell means most of this doesn't apply; point at the WSL2 warning on the
quickstart page.

## 4. Report, then offer to fix

1. A compact per-check summary, FAILs first, one line of reason each.
2. For each non-PASS, the fix. Config edits (the `env` block, `COMP4020_GROUP`)
   belong to **quickstart** — name the step rather than re-deriving it.
   Interactive logins (`gh auth login`, `flyctl auth login`) open a browser and
   can't be fully automated: run them for the student, or hand them the command.
3. **Confirm every fix before running it.** Never run one without an explicit
   yes.
4. If everything's green, say so plainly and stop. No busywork.

## Handing off

- Anything needing a settings change, a key, or an org invitation accepted → the
  **quickstart** skill
- "how much budget do I have" / over budget → **check-balance**
- Status line empty, stale, or saying `own plan` → the **statusline** skill in
  the companion `comp4020-statusline` plugin (it's opt-in: its absence is never
  a failure, so don't raise it unprompted)
- Course rules, deadlines, or what a tool is _for_ → **course-info**
