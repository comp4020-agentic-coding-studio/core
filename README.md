# COMP4020 skills

Claude Code skills for students in
[COMP4020/COMP8020 Agentic Coding Studio](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
at the ANU. This repo is a
[Claude Code plugin marketplace](https://docs.anthropic.com/en/docs/claude-code/plugins):
you subscribe once, and skill updates flow to you automatically.

## Install

From any Claude Code session:

```
/plugin marketplace add comp4020-agentic-coding-studio/core
/plugin install comp4020@comp4020
```

Or from the shell:

```sh
claude plugin marketplace add comp4020-agentic-coding-studio/core
claude plugin install comp4020@comp4020
```

## Keeping it up to date

Refreshing the marketplace only re-reads the catalogue --- it installs nothing.
Updating the plugin is the second step, and the new version loads on the next
restart:

```sh
claude plugin marketplace update comp4020
claude plugin update comp4020@comp4020
```

`/comp4020:doctor` says when your copy is behind, and so do **ship** and
**preflight** — a stale copy runs whatever steps the version you installed
happened to carry, which is worst at a cutoff. If the update reports the plugin
isn't installed at that scope, re-run it with the `--scope` you installed under
(`local` or `project`) from inside that repo.

## What's in the plugin

### handbook

Answers course-admin questions — "when is assignment 3 due and how much is it
worth?", "what's the extension policy?", "what does the week 4 lecture cover?" —
by querying the live course website (its JSON content-graph API and `llms.txt`
endpoints). The skill holds no course facts itself, only knowledge of where to
look, so its answers are always as current as the site. It triggers
automatically on questions about the course, or invoke it directly with
`/comp4020:handbook`.

### balance

Answers "check my balance", "how much budget do I have left?", "why is my key
not working?" by querying the course proxy's `/api/me` endpoint with the same
key Claude Code is already using — no extra setup or login. Reports weekly spend
against the cap and when the budget resets, explains the common failure modes
(off-campus without the ANU VPN, revoked key), and knows what to suggest when
the budget runs out. Triggers automatically on budget/usage questions, or invoke
it directly with `/comp4020:balance`.

### onboard

The setup **fixer**: points a first-time student at their key on Canvas, merges
it safely into settings (never clobbering what's there, never echoing the key),
joins the course GitHub org, and records their crit group. Students with their
own Claude subscription or API key get the dual-plan setup instead — the course
key scoped to course repos via `.claude/settings.local.json`, so course work
runs on course credits and everything else stays on their own plan. Each step
re-runs independently, so `/comp4020:onboard` later with "use my course credits
in this repo" does just that. Or ask to "set up my key".

### doctor

The setup **diagnostician**, and onboard's counterpart: one `scripts/doctor.sh`
run reports Git, the GitHub CLI and its auth, course org membership, flyctl, the
proxy config and a live `/api/me` probe (which doubles as an "am I on the VPN?"
check), the crit group, the template's pre-commit key guard, Claude Code,
Chrome, `jq` and mise. The script gathers facts on any machine — no `jq`, no
configuration, macOS or Linux or WSL or Git Bash — and the skill interprets
them, cross-checks the site's own tool list, and **offers to fix** what's
broken, confirming each step. Invoke with `/comp4020:doctor` or ask "is my setup
right?".

### radar

The proactive view of the schedule: what's due this week and next, sorted by
date with weights, leading with the single most urgent thing. The cutoff
arithmetic — the teaching-week calendar, the mid-semester break, the crit cutoff
two hours before _your_ group's session, and the weeks a group's session moves
(a public holiday) so that its cutoff moves too — lives in
`scripts/next-deadline.sh`, which **start**, **preflight** and **ship** call
too, so every skill quotes the same deadline. Invoke with `/comp4020:radar` or
ask "what's due?" / "what should I work on?".

### start

Sets up the repo for a new weekly crit prototype or an assignment. The course
provisions each repo (private, from the starter template); this skill clones it,
then **merges the student's `CLAUDE.md` / `AGENTS.md` harness forward** from
last week's repo rather than resetting them to boilerplate, keeping the rules
they've accreted and taking the template's new material. Asks whether they're
keeping their stack or switching, refuses to carry the prototype source or
reflections across, and pulls the week's spec so the student can turn it into
their own tests. Knows which weeks don't start a fresh prototype (the retro
crits, and weeks 9–11, which run on the final-project repo). Invoke with
`/comp4020:start` or ask to "start this week's prototype".

### preflight

Checks that work is actually submittable before a crit or assignment deadline:
cross-references the assessment spec (from the site) with the local repo — clean
tree, everything pushed to GitHub, marker can see it, required structure present
— and, in the full-stack half, that the deploy is healthy and reachable. Offers
to run the safe fixes (commit, push), but leaves the actual submission to the
student. Invoke with `/comp4020:preflight` or ask "am I ready to submit?".

### ship

The one irreversible act in the course, treated accordingly: re-runs preflight,
scans the working tree **and history** for secrets, then — with explicit
confirmation — flips the repo public, enables GitHub Pages (as a workflow site),
and verifies the live URL actually serves. In the final-project run (weeks 9–11)
it also tags the crit-cutoff state. Invoke with `/comp4020:ship` or say "ship
it" / "make my repo public".

### riff

Sets a pod up for the riff, the part of the crit session that starts from the
crit agent's prototype. The repos are provisioned per group per crit and
numbered, because pods are dealt on the day — this skill works out which crit is
running, asks which number the pod was dealt, clones
`comp4020-riff<N>-<group>-<pod>` (a full copy of the agent's repo, tagged
`riff-start`), gets the checks green, and pushes early so the share-back is the
live Pages URL. Invoke with `/comp4020:riff` or ask to "start the riff".

### help

Lists everything above and routes to the right skill. Invoke with
`/comp4020:help`.

## Working on this repo

Two conventions hold the skills together, and both are enforced in CI
(`python3 .github/validate.py`, which needs nothing installed):

- **one owner per mechanic.** A fact or procedure that more than one skill needs
  lives in exactly one place, and the others point at it: the setup checks in
  `scripts/doctor.sh`, the deadline arithmetic in `scripts/next-deadline.sh`,
  the deploy check in `scripts/verify-deploy.sh` and the staleness check in
  `scripts/plugin-version.sh` (which **ship** and **preflight** both call, and
  which **doctor** folds into its own report), settings changes in **onboard**,
  diagnosis in **doctor**, the status line in the companion plugin. Restating
  one in a second skill is how they drift.
- **the site is ground truth.** Course facts — dates, weights, groups, tool
  lists, policies — are fetched from
  `comp.anu.edu.au/courses/comp4020-agentic-coding-studio`, never hardcoded
  here. Skills carry routing knowledge, not course data.

Scripts stay dependency-light so they run on a student's unprepared laptop:
POSIX-ish bash that works on macOS's bash 3.2 and on Linux, `shellcheck`-clean,
no `jq` in `doctor.sh` or `plugin-version.sh` (the machine being diagnosed may
have nothing installed), and `jq` in `next-deadline.sh` only with a clean
fallback message when it's missing.

### The loop

A session loads an installed copy of the plugin, never this checkout, so an edit
here reaches you the same way it reaches a student: land it, cut a release, then
pick it up with the two commands under
[keeping it up to date](#keeping-it-up-to-date). `CLAUDE.md` has the release
steps.

## The status line (a separate, optional plugin)

`comp4020-statusline` shows which credits every Claude Code session is burning,
at the bottom of the screen. On course credits it's your week's spend against
the cap — `comp4020 $41.20/$100 (41%)`, green through amber to red as the cap
approaches. In a session running on your own Claude subscription or API key
instead, it reads `own plan` — so if you have both, one glance tells you which
wallet the session draws from.

```
claude plugin install comp4020-statusline@comp4020
```

It's a second plugin rather than part of `comp4020` because it ships a
`SessionStart` hook (which keeps the script current across updates), and nobody
should run a hook they didn't ask for. Installing it is the opt-in; the skills
plugin above ships no hooks at all.

Installing it doesn't switch the status line on by itself — no plugin can set
`statusLine`. It ships its own **statusline** skill for that: ask it to install
the status line and it writes the one-line `settings.json` block for you,
merging rather than clobbering an existing one. The same skill diagnoses an
empty, stale, or `own plan` segment, and removes the whole thing when semester
ends. Keeping it here rather than in `comp4020` means students who never install
the status line never carry its instructions.

It reads a cached figure and refreshes in the background at most once a minute,
so it never slows a session down or hammers the proxy — an indicator, not a
ledger. It needs `jq` and a Unix shell (macOS, Linux, WSL), and it contacts
nobody unless you're actually routed through strproxy: the `own plan` tag is
rendered entirely locally, and your own credentials are never sent anywhere they
weren't already going.
