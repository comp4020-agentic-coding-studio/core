---
name: new-week
description:
  Sets up a COMP4020/COMP8020 student's repo for a new weekly crit prototype —
  clones the repo the course provisioned for them from that week's starter
  template, carries their CLAUDE.md / AGENTS.md harness forward from last week,
  and helps them keep or switch stack. Use at the start of a crit week, or when
  the user asks to "start this week's prototype", "set up week N", "clone this
  week's repo", or "carry my CLAUDE.md forward".
---

# COMP4020 new week

Each weekly prototype is its own repo, generated for you from that week's
starter template and waiting in the course org. The isolation is deliberate: a
clean thing to fork, a live URL per week, and a bad `git reset` that can only
ever cost you one week.

What shouldn't reset is the **harness**. The `CLAUDE.md` you grow to direct the
agent is meant to accumulate across the whole course, and the gap between the
starter's boilerplate and your own version is read as evidence of how you work.
This skill runs that transition: new repo from the template, harness carried
forward, stack chosen on purpose rather than by default.

## 1. Which week, and which template?

Get the real date from the machine (`date +%Y-%m-%d`) — never assume it. Then
fetch `/api/index.json` from the course site (base URL
`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio`) and find the
crit for the current week. Read that node's own JSON for the `body`: it names
what's being built and where it deploys.

Not every week starts a fresh prototype. Before creating anything:

- **weeks 4 and 7** are retro crits — you present the assignment that just
  landed, so there's no new prototype. Say so and stop.
- **week 9** starts the **final-project repo**: created from that week's starter
  and carried through to the A3 deadline, with every late-crit week's spec tier
  shipped in it up front. Run this skill for it as normal — harness carried
  forward, stack chosen deliberately (this is the stack you'll justify in A3).
- **weeks 10–11** run in that same repo. The crit deliverable is the in-flight
  A3 through that week's lens, so there's no new repo and no harness to carry.
  Say so and stop.
- **week 12** has no crit.

The template follows the half of the course: the static half (weeks 2–6) uses
`comp4020-agentic-coding-studio/template-static`; the full-stack half (week 8
onwards) uses the full-stack template named on the crit page. Confirm the
template exists with `gh repo view` before you rely on it. If you can't, ask
rather than guessing a name.

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

**Never carry forward** the prototype source (`index.html`, `main.js`,
`styles.css`, components), the `spec/` directory, `OVERVIEW.md`, or
`reflections/`. Each week answers a new provocation, and `spec/` is this week's
contract with the marker. A student who drags last week's source along ends up
presenting last week's work.

## 4. Clone the repo

Your repo already exists. The course generates one per student per deliverable,
from that week's template, owned by the org and named `<prefix>-<handle>`. You
are its admin — you can flip it public and enable Pages at the cutoff — but you
don't create it, and you can't create repos in the org.

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
ships its own boilerplate `CLAUDE.md`, and that boilerplate moves through the
course — week 6's documents the accessibility and performance sensors that
arrive with it. So:

- **diff** last week's `CLAUDE.md` against the template's, and show the student
  what differs before touching anything.
- **keep every rule they added** — the conventions they hold the agent to, the
  corrections that stuck, the facts about the stack the agent kept getting
  wrong. That accretion is theirs, and it's assessed.
- **take the template's new material** — new sensors, new sections, anything
  describing this week's checks.
- **drop only what no longer applies**, such as rules about a framework they've
  just switched away from. Ask first. A stale rule is much cheaper than a lost
  one.

Do the same for `AGENTS.md` if it exists. Commit the merged harness on its own,
before any prototype work, with a message that says where it came from
(`harness: carry forward from week N`). The first commit in the repo is then an
honest answer to "where did this CLAUDE.md come from".

## 6. Land it

- install dependencies and run the checks (`pnpm check` in the static template).
  Confirm green before the student starts, so a red check later is theirs and
  not inherited.
- read them `spec/README.md`, this week's brief, and stop there. Building the
  prototype is their work, not yours.
- remind them of the two things the checks can't enforce: commit as you go, and
  the repo stays private until the cutoff.

## Notes

- Confirm before pushing, and never `gh repo create`. The course provisions the
  repos; a repo you make yourself is in the wrong place, under the wrong owner,
  and is not the one your tutor will mark.
- If they've already cloned this week's repo, don't clone a second copy. Offer
  to run the harness merge into what they have.
- Assignment repos (A1, A2, A3) have the same anatomy, and the harness carries
  into them the same way. If a student asks, do it — just don't invent a brief
  or a due date that the site doesn't state.

## Hand off

- "what's due this week?" → **deadline-radar**
- "am I ready to submit?" → **submission-preflight**
- "make it public and deploy it" → **ship**
- "is my machine set up right?" → **doctor**
