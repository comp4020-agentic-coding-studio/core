---
name: start
description:
  Sets up a COMP4020/COMP8020 student's repo for a new deliverable — a weekly
  crit prototype or an assignment. Clones the repo the course provisioned for
  them, carries their CLAUDE.md / AGENTS.md harness forward from last week,
  pulls the spec from the course API, and helps them turn its checkable lines
  into tests. Use at the start of a crit week, or for "start this week's
  prototype", "start assignment 1", "set up week N", "clone this week's repo",
  "pull this week's spec", or "carry my CLAUDE.md forward".
allowed-tools: Bash, Read, Edit, Write, WebFetch, Glob, Grep
---

# COMP4020 start

Each weekly prototype is its own repo, generated for you from the course starter
template and waiting in the course org. The isolation is deliberate: a clean
thing to fork, a live URL per week, and a bad `git reset` that can only ever
cost you one week.

Most deliverables use the template for their half of the course. Assignment 2
is the deliberate exception: its provisioned repo comes from the specialised
`template-course-site`, whose Slop University content model is part of the
published contract. What shouldn't
reset is the **harness**: the `CLAUDE.md` you grow to direct the agent is meant
to accumulate across the whole course, and the gap between the starter's
boilerplate and your own version is read as evidence of how you work. This skill
runs that transition: new repo, harness carried forward, stack chosen on
purpose, and the week's spec pulled and turned into your own tests.

## 1. Which week, and which deliverable?

```sh
"$CLAUDE_PLUGIN_ROOT/scripts/next-deadline.sh"
```

The row marked **`next`** is the target: the deliverable whose deadline is still
ahead, which is never a raw "which week is it" match. A deliverable's `week` is
when its crit session runs, but the work happens in the days before the cutoff,
so C1 (`week: 2`) is the week-1 job, and the thing to set up right after your
week-N crit is week N+1's. The script does that arithmetic — the week calendar,
the teaching break, and the group-relative cutoff — so don't re-derive it.

Four cases where `next` isn't the answer:

- the student **names a target** ("set up week 5", "start assignment 2") — that
  wins over any date arithmetic
- its repo is **already cloned and under way** — the target is the row after it
- **two rows share the `next` deadline** (an assignment finishing alongside a
  crit) — say so and ask which they're starting
- **no `next` row at all** — the course's deliverables are done; say so and stop

The student's repo for a deliverable is `<repoPrefix>-<handle>`, and
`$COMP4020_GROUP` being unset shows up as `status ok-no-group`: ask which group
they're in and offer **onboard** step 5 so it's never asked again.

Then read the target's own JSON — `/api/crits/<slug>.json` for `kind: crit`,
`/api/assessments/<slug>.json` for `kind: assessment` — for the `spec` (the
published contract) and the `body` (the full brief).

Keep that course vocabulary intact when speaking to the student: the **brief**
poses the problem and leaves room for their response; the **spec** is the fixed
contract every response must satisfy. Their prompt, plan and task list record
their decisions. Do not call any of those a "working spec" or create a second
spec document in the repo.

Entries can share a prefix: the retro crits point at the assignment repo they
demo, and the final project's repo prefix (`comp4020-final` — the actual repo is
`comp4020-final-<handle>`, per the `<repoPrefix>-<handle>` convention above)
serves the week 9–11 crits _and_ the A3 submission. Sharing a prefix means
sharing a repo, so:

- a crit whose `repoPrefix` matches an assessment's is a **retro crit** (weeks 4
  and 7): the student presents the assignment that just landed, so there's no
  new prototype and no harness merge. Offer the retro prep instead — confirm
  which repo they're presenting, run **preflight** against it, and check its
  deployed URL still serves — then stop.
- **week 9** starts the **final-project repo**: created once and carried through
  to the A3 deadline. Run this skill for it as normal — harness carried forward,
  stack chosen deliberately (this is the stack you'll justify in A3).
- **weeks 10–11** run in that same repo: no new clone, no harness merge. Skip to
  step 6 and pull _that week's_ crit spec into the repo you already have — new
  tests alongside the old (don't delete a past week's), and a fresh reflection
  entry at the cutoff.
- **week 12** has no crit.

The template normally follows the half of the course — the static half (weeks 2–6) uses
`comp4020-agentic-coding-studio/template-static`; week 7 is the A2 retro, so it
reuses the Assignment 2 repo generated from
`comp4020-agentic-coding-studio/template-course-site` rather than a fresh
template (the retro-crit case above); the full-stack half (week 8 onwards) uses
`comp4020-agentic-coding-studio/template-dynamic`. Within a half it's the same
template every week; nothing about the deliverable is baked into it. You never
choose a template: the course provisioned your repo from the right one.

## 2. Find last week's harness

The previous prototype repo is where `CLAUDE.md` and `AGENTS.md` come from. Use
the ordered deliverable rows from step 1, not GitHub creation time: starting
immediately before the selected target, walk backwards to the first row with a
**different `repoPrefix`** whose exact `<repoPrefix>-<current-handle>`
repository exists. Resolve the current handle with `gh api /user --jq .login`
and check an exact name with `gh repo view`. Skip repeated rows for the same
repo (retros and the shared final-project crits), and never select the target
repo itself. This stays deterministic when the course provisions several future
repos in one batch or GitHub reports equal creation times.

**Confirm that exact prior repo with the student before reading it** — a harness
carried forward from the wrong repo is worse than no harness. Do not fall back
to “the most recently created repo”; if none of the earlier published rows has a
repository, treat this as their first prototype and say so.

If this is their first prototype, there's nothing to carry. The template's
boilerplate is the starting point; say so and skip to step 4.

## 3. Choose the stack, deliberately

**Assignment 2 exception:** skip the stack choice and conversion. The supplied
Astro/Slop architecture is mandatory and is itself part of the assignment.
Tell the student this is a stable platform, not a prescribed page design: they
still choose the course, visual treatment, authored content, semantic checks,
and the visible name of their teaching sessions.

The course lets you use a completely different stack each week, so long as it
deploys to that week's target. Ask once, and make the choice explicit — offer to
set it up now, with the course default named first:

- **course default (Astro, from C2)** — invoke the `stack` skill right now, in
  this session. It runs the tested conversion script, and the repo comes out
  `pnpm check`-green with the Pages base path handled. From C2 the published
  specs assume this stack, so a fresh repo should be one "yes" away from it.
- **keep** — the same stack as last week. If that stack is the course default,
  invoke the `stack` skill again in the fresh repo: the script detects the
  pristine template and derives the Pages base from **this** repo's remote, and
  any additions from last week (integrations, extra dependencies) are carried
  forward on top. Never copy `astro.config.ts` between repos — its `base` embeds
  last week's repo name, which works on localhost and 404s every asset on the
  live site. For a non-default stack, carry the build config forward
  (dependencies, scripts, tool config, lockfile) but re-derive anything
  repo-specific the same way; never carry the prototype source.
- **switch to something else** — take the template as it ships and pick
  something new. Separate repos are what make this the cheapest possible switch;
  this is the week to use that.
- **bare** — the template minus its build tooling. Hand-written HTML and CSS is
  a legitimate answer in the static half; the `stack` skill's bare arm sets it
  up.

**Never carry forward** the prototype source (`index.html`, `main.ts`,
`styles.css`, components), your spec tests from last week (the invariants ship
with the template; the week tests answer last week's contract), `PROCESS.md`, or
`reflections/`. Each week answers a new provocation. A student who drags last
week's source along ends up presenting last week's work.

Tell the student the reflection filename for this deliverable while you're here
— it's the `reflection` column of the row you picked in step 1, and it is what
the marker reads. It's named for the deliverable, so the number in it matches
the number in the repo name (`crit-1.md` in `comp4020-crit1-<handle>`); the one
to say out loud is the assignment repo, where the entry is `assignment-1.md` and
the week-4 retro crit reads that rather than asking for a second one.
`pnpm check:evidence` fails on any other name.

## 4. Clone the repo

Your repo already exists. The course generates one per student per deliverable,
owned by the org and named `<prefix>-<handle>`. You are its admin — you can flip
it public and enable Pages at the cutoff — but you don't create it, and you
can't create repos in the org.

```sh
gh repo clone comp4020-agentic-coding-studio/<prefix>-<handle>
```

`gh repo clone` writes into the current directory, so `cd` to wherever they keep
the course first — one folder holding every course repo, `~/comp4020/` or their
own choice. Offer to create it on the first run. By November there are a dozen
repos, and scattered ones make step 2 harder than it needs to be.

**Private, always.** It arrives private and goes public at the cutoff, not
before — until then peers can't read your source, your prompts or your harness.
Flipping it is a deliberate act two hours before the crit, and it belongs to
**ship**, not to this skill.

If the repo isn't there, don't invent one. Run **doctor** and read its `org`
row, because inactive membership is the common cause and the one the student can
fix — the course's provisioning refuses to create a repo for anyone who hasn't
joined. If they are an active member and the repo still isn't there, the week
hasn't been provisioned yet. Say which of the two it is, and stop.

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

For Assignment 2, compare the prior harness with the specialised course-site
template rather than `template-static`. Preserve the template's course schema,
API, base-path, deck and content-graph guidance. Carry forward only the
student's applicable additions; do not transplant old prototype source or
framework instructions that contradict this architecture.

## 6. Turn the checkable spec lines into tests

The week's published `spec` (step 1) is the contract the tutor verifies at the
crit. Turning its course-specific promises into automated backpressure is the
student's work. Assignment 2 also ships `spec/data-integrity.test.ts` for shared
catalogue plumbing plus a replaceable worked example; keep the integrity test
and adapt or replace the example.

There is nothing to record locally about which deliverable this is:
`pnpm check:evidence` works the current deliverable out live, from the repo's
name and the course API, so an old but well-named reflection cannot accidentally
satisfy the current one.

Walk the fixed spec with the student, line by line, and sort it:

- **mechanically checkable** — "deployed and live", "the core flow persists
  across a reload", "a navigation landmark". Write tests for these in their own
  file alongside the invariants (any `spec/*.test.ts` runs with `pnpm check`).
  Assert the **contract** — what the page must do, not how it's built — so the
  tests survive a change of approach, or of stack.
- **judged by a person** — "the look commits to an era", "yours is better in
  ways you can name". No test can hold these; name them out loud so the student
  knows they're still on the hook for them at the crit.

For Assignment 2, help the student select and justify the checks that protect
their actual course rather than imposing a test count or mechanically demanding
lint, tests, accessibility and performance tools all at once. Keep every
selected check reachable through `pnpm check`. Learning-outcome coverage, if
outcomes are used, and the coherence promises peculiar to their course are good
semantic candidates; the starter already checks refs, dates and API shape.

The new tests **start red** — there's no prototype yet, and that's the point.
Red-to-green across the week is the work, and the commits that turn each one
green are exactly the process evidence `PROCESS.md` wants to cite.

## 7. Land it

- from the repo root, run `mise install` then install dependencies and run the
  checks (`pnpm check` in the static template). Mise is the supported runtime
  path and the template pins its tested Node and pnpm versions there. Another
  runtime manager is fine if it provides those versions; do not treat that alone
  as off piste. The invariants and everything carried forward should be green
  before the student starts — a red check later is then theirs, not inherited.
  Their fresh spec tests are the exception: red is their starting state.
- for Assignment 2, direct them first to the brief's code generator: they choose
  the level digit, generate the remaining three digits, and put the resulting
  `SLOPxxxx` record in `src/course-config.ts`. Work through placeholders
  incrementally. `pnpm check:evidence` is the separate final gate that rejects
  starter copy and unchanged starter imagery.
- read them the week's brief and spec from the site, name what is open in the
  brief and what is fixed in the spec, and stop there. Their next step is to
  interrogate both and agree a plan with the agent. Do not supply that plan or
  begin building inside **start**.
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

- "what's due this week?" → **radar**
- "am I ready to submit?" → **preflight**
- "make it public and deploy it" → **ship**
- "is my machine set up right?" → **doctor**
