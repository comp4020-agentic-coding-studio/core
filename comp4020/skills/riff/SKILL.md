---
name: riff
description:
  Sets up a COMP4020/COMP8020 pod for the riff — the part of the crit session
  where a pod of four takes the crit agent's prototype further. Works out which
  crit is running, asks which pod number the room dealt them, clones
  `comp4020-riff<N>-<group>-<pod>`, and gets the pod pushing so the share-back
  is a live site. Use for /comp4020:riff, "start the riff", "I'm the pod
  leader", "clone our riff repo", or "which repo does my pod work in".
allowed-tools: Bash, Read, Edit, Write, WebFetch, Glob, Grep
---

# COMP4020 riff

The riff is the last part of the crit session. Every pod starts from the same
artefact — the crit agent's prototype for the week — and spends the session
taking it past where the agent left it. The repo is already made, already
public, already deployed: the pod's job is to push to it.

This runs in the room, on a clock, with three other people watching the screen.
Be quick, and don't ask anything the tutor has already said out loud.

## 1. Which crit, and which pod?

```sh
"$CLAUDE_PLUGIN_ROOT/scripts/next-deadline.sh"
```

The riff runs in **today's** crit, so the target is the `deliverable` row whose
`WEEK` matches the `teaching_week` header — not the row marked `next`, which is
next week's work. Then read
`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/crit-groups.json`
for that crit's `num`: the riff repos are numbered by the C-number, which is not
always the week.

Two things to settle:

- **the group** — `$COMP4020_GROUP`, and `status ok-no-group` means it's unset:
  ask, and offer **onboard** step 5 afterwards so it's never asked again.
- **the pod number, 1–6** — dealt in the room, so ask. Nothing about it is
  derivable and nothing else in this skill works without it.

The repo is `comp4020-riff<num>-<group>-<pod>` in the course org, live at
`https://comp4020-agentic-coding-studio.github.io/comp4020-riff<num>-<group>-<pod>/`.
Say both back before cloning — a pod that works in the wrong number wastes the
session, and it's the one mistake that's free to catch here.

## 2. Clone it

```sh
gh repo clone comp4020-agentic-coding-studio/comp4020-riff<num>-<group>-<pod>
```

It's a full copy of the agent's repo, history and all, with a `riff-start` tag
on the commit it was seeded at. Everyone in the cohort has push access to these
repos, so any of the four can push; the pod leader is just whoever has the
keyboard, and swapping mid-session is fine.

If it 404s, check the number and the group with the tutor before anything else,
and never `gh repo create` — a repo you make yourself isn't the one the room
looks at. If `git log --oneline riff-start..HEAD` already shows commits, another
pod has taken this number: stop and sort it out in the room.

## 3. Get it green, and read it

From the repo root, `mise install`, install dependencies, then run the checks
(`pnpm check` in the static template). Green before you start means a red check
later is yours.

This is someone else's harness. Read their `CLAUDE.md` and their spec tests
before you write anything — how they directed the agent is half of what's
interesting about starting from their repo, and it's the fastest way to see what
they'd already decided.

## 4. Decide the riff in the first few minutes

Agree out loud what this pod is taking further, and pick something the four of
you can land inside the session. The floor is one spec line with a first failing
test, or a first PR — a pod that ends with a sharp red test and a plan has done
the exercise.

Don't restart the prototype. The point is to take this one somewhere, and a
rewrite throws away the thing that made the starting point worth having.

## 5. Push early, and keep `main` green

A push to `main` runs `pnpm check` and then deploys to the Pages URL, so the
share-back is the live site with nothing to set up. Push something in the first
ten minutes so the pod proves that path while there's still time to fix it.

The deploy only runs on a green check, so a red test on `main` leaves the live
site sitting at the last commit that passed. Land work-in-progress on a branch
and open a PR — the checks run there too, and merging is what deploys.

## 6. The share-back

`git diff riff-start` is exactly what the pod added, and the live URL is what
the room looks at. Between them they're the whole report: what you changed, and
it running.

The riff isn't assessed and there's nothing to submit — no reflection entry, no
`PROCESS.md` for it. The repo stays public in the org afterwards.

## Notes

- Don't touch the agent's own submission repo. It's their marked artefact; the
  riff repo is the copy.
- Take ideas from the riff back into your own week if you want, but not the
  commits — your prototype answers its own provocation.

## Hand off

- "which repo do I work in for my own prototype?" → **start**
- "what's due this week?" → **radar**
- "make my repo public and deploy it" → **ship**
- "why won't this run on my machine?" → **doctor**
