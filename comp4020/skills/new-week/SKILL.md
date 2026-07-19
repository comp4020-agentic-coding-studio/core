---
name: new-week
description:
  Sets up a COMP4020/COMP8020 student's repo for a new deliverable — a weekly
  crit prototype or an assignment. Clones the repo the course provisioned for
  them, carries their CLAUDE.md / AGENTS.md harness forward from last week,
  pulls the spec from the course API, and helps them turn its checkable lines
  into tests. Use at the start of a crit week, or for "start this week's
  prototype", "start assignment 1", "set up week N", "clone this week's repo",
  "pull this week's spec", or "carry my CLAUDE.md forward".
---

# COMP4020 new week

Each weekly prototype is its own repo, generated for you from the course starter
template and waiting in the course org. The isolation is deliberate: a clean
thing to fork, a live URL per week, and a bad `git reset` that can only ever
cost you one week.

The template is **identical for every deliverable** — what changes each week is
the spec, and that lives on the course website, not in the repo. What shouldn't
reset is the **harness**: the `CLAUDE.md` you grow to direct the agent is meant
to accumulate across the whole course, and the gap between the starter's
boilerplate and your own version is read as evidence of how you work. This skill
runs that transition: new repo, harness carried forward, stack chosen on
purpose, and the week's spec pulled and turned into your own tests.

## 1. Which week, and which deliverable?

Get the real date from the machine (`date +%Y-%m-%d`) — never assume it. Then
fetch `/api/crit-groups.json` from the course site (base URL
`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio`). Its
`deliverables` array maps every crit and assessment to a `week` and a
`repoPrefix`; its `weeks` array maps each teaching week to the Monday it starts
(`teachingBreak` is the no-teaching gap between the halves); the student's repo
for a deliverable is `<repoPrefix>-<handle>`.

**The target is the next deliverable whose deadline is still ahead of now** —
never a raw "which week is it" match. A deliverable's `week` is when its crit
session runs; the work happens in the days before the cutoff, so C1 (`week: 2`)
is the week-1 job, and the thing to set up right after your week-N crit is week
N+1's. Resolve deadlines concretely:

- a **crit's** deadline is the student's group cutoff in the deliverable's week:
  the group's `cutoff` day and time (from `groups`, keyed by `$COMP4020_GROUP` —
  if it's unset, ask which group they're in; quickstart step 6 records it)
  anchored to that week's Monday from `weeks`.
- an **assessment's** deadline is its `due` date.

Pick the deliverable with the earliest deadline still ahead. If its repo is
already cloned and under way, the target is the next one after it. If two lie
equally ahead (an assignment finishing alongside a crit), say so and ask which
they're starting. And if the student names a target — "set up week 5", "start
assignment 2" — that wins over any date arithmetic. If nothing lies ahead at
all, the course's deliverables are done; say so and stop.

Then read the target's own JSON — `/api/crits/<slug>.json` for `kind: crit`,
`/api/assessments/<slug>.json` for `kind: assessment` — for the `spec` (the
published contract) and the `body` (the full brief).

Entries can share a prefix: the retro crits point at the assignment repo they
demo, and the final project's repo (`comp4020-final`) serves the week 9–11 crits
_and_ the A3 submission. Sharing a prefix means sharing a repo, so:

- a crit whose `repoPrefix` matches an assessment's is a **retro crit** (weeks 4
  and 7): the student presents the assignment that just landed, so there's no
  new prototype and no harness merge. Offer the retro prep instead — confirm
  which repo they're presenting, run **submission-preflight** against it, and
  check its deployed URL still serves — then stop.
- **week 9** starts the **final-project repo**: created once and carried through
  to the A3 deadline. Run this skill for it as normal — harness carried forward,
  stack chosen deliberately (this is the stack you'll justify in A3).
- **weeks 10–11** run in that same repo: no new clone, no harness merge. Skip to
  step 6 and pull _that week's_ crit spec into the repo you already have — new
  tests alongside the old (don't delete a past week's), and a fresh reflection
  entry at the cutoff.
- **week 12** has no crit.

The template follows the half of the course — the static half (weeks 2–6) uses
`comp4020-agentic-coding-studio/template-static`, the full-stack half (week 8
onwards) uses the full-stack template — but within a half it's the same template
every week; nothing about the deliverable is baked into it. You never choose a
template: the course provisioned your repo from the right one.

## 2. Find last week's harness

The previous prototype repo is where `CLAUDE.md` and `AGENTS.md` come from.
Every repo lives in the course org and is named `<prefix>-<handle>`, so list
them with
`gh repo list comp4020-agentic-coding-studio --limit 100 --json name,createdAt`
and pick the most recent one ending in the student's own handle
(`gh api /user --jq .login`). **Confirm the repo with them before reading it** —
a harness carried forward from the wrong repo is worse than no harness.

If this is their first prototype, there's nothing to carry. The template's
boilerplate is the starting point; say so and skip to step 4.

## 3. Choose the stack, deliberately

The course lets you use a completely different stack each week, so long as it
deploys to that week's target. Ask once, and make the choice explicit:

- **keep** — the same framework and tooling as last week. Carry the build config
  forward (dependencies, scripts, tool config, lockfile), never the prototype
  source.
- **switch** — take the template as it ships and pick something new. Separate
  repos are what make this the cheapest possible switch; this is the week to use
  that.
- **bare** — the template minus its build tooling. Hand-written HTML and CSS is
  a legitimate answer in the static half.

**Never carry forward** the prototype source (`index.html`, `main.ts`,
`styles.css`, components), your spec tests from last week (the invariants ship
with the template; the week tests answer last week's contract), `PROCESS.md`, or
`reflections/`. Each week answers a new provocation. A student who drags last
week's source along ends up presenting last week's work.

## 4. Clone the repo

Your repo already exists. The course generates one per student per deliverable,
owned by the org and named `<prefix>-<handle>`. You are its admin — you can flip
it public and enable Pages at the cutoff — but you don't create it, and you
can't create repos in the org.

```sh
gh repo clone comp4020-agentic-coding-studio/<prefix>-<handle>
```

**Private, always.** It arrives private and goes public at the cutoff, not
before — until then peers can't read your source, your prompts or your harness.
Flipping it is a deliberate act two hours before the crit, and it belongs to
**ship**, not to this skill.

If the repo isn't there, don't invent one. Check org membership first, because
that's the common cause and the one the student can fix:

```sh
gh api /user/memberships/orgs/comp4020-agentic-coding-studio --jq .state
```

Anything but `active` and the repo was never provisioned for them — hand off to
**doctor**, which accepts a pending invitation in one call. If they are an
active member and the repo still isn't there, the week hasn't been provisioned
yet. Say which of the two it is, and stop.

## 5. Merge the harness

This is the part that matters, and it's a merge rather than a copy. The template
ships its own boilerplate `CLAUDE.md`, and that boilerplate can still evolve
between weeks. So:

- **diff** last week's `CLAUDE.md` against the template's, and show the student
  what differs before touching anything.
- **keep every rule they added** — the conventions they hold the agent to, the
  corrections that stuck, the facts about the stack the agent kept getting
  wrong. That accretion is theirs, and it's assessed.
- **take the template's new material** — new sections, anything describing the
  checks that changed.
- **drop only what no longer applies**, such as rules about a framework they've
  just switched away from. Ask first. A stale rule is much cheaper than a lost
  one.

Do the same for `AGENTS.md` if it exists. Commit the merged harness on its own,
before any prototype work, with a message that says where it came from
(`harness: carry forward from week N`). The first commit in the repo is then an
honest answer to "where did this CLAUDE.md come from".

## 6. Turn the spec into tests

The week's published `spec` (step 1) is the contract the tutor verifies at the
crit. Turning it into automated backpressure is the student's work — the
template deliberately ships only the invariants (`spec/invariants.test.ts`, true
of any good website) and leaves the week's contract to them.

Walk the spec with the student, line by line, and sort it:

- **mechanically checkable** — "deployed and live", "the core flow persists
  across a reload", "a navigation landmark". Write tests for these in their own
  file alongside the invariants (any `spec/*.test.ts` runs with `pnpm check`).
  Assert the **contract** — what the page must do, not how it's built — so the
  tests survive a change of approach, or of stack.
- **judged by a person** — "the look commits to an era", "yours is better in
  ways you can name". No test can hold these; name them out loud so the student
  knows they're still on the hook for them at the crit.

The new tests **start red** — there's no prototype yet, and that's the point.
Red-to-green across the week is the work, and the commits that turn each one
green are exactly the process evidence `PROCESS.md` wants to cite.

## 7. Land it

- install dependencies and run the checks (`pnpm check` in the static template).
  The invariants and everything carried forward should be green before the
  student starts — a red check later is then theirs, not inherited. Their fresh
  spec tests are the exception: red is their starting state.
- read them the week's spec and brief from the site, and stop there. Building
  the prototype is their work, not yours.
- remind them of the two things the checks can't enforce: commit as you go, and
  the repo stays private until the cutoff.

## Notes

- Confirm before pushing, and never `gh repo create`. The course provisions the
  repos; a repo you make yourself is in the wrong place, under the wrong owner,
  and is not the one your tutor will mark.
- If they've already cloned this week's repo, don't clone a second copy. Offer
  to run the harness merge into what they have.
- Assignments (A1–A3) run through this skill exactly like crits
  (`kind: assessment` in the deliverables map) — same repo anatomy, same harness
  carry, same spec pull. Don't invent a brief or a due date the site doesn't
  state.

## Hand off

- "what's due this week?" → **deadline-radar**
- "am I ready to submit?" → **submission-preflight**
- "make it public and deploy it" → **ship**
- "is my machine set up right?" → **doctor**
