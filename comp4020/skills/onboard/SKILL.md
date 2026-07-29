---
name: onboard
description:
  Sets up a new COMP4020/COMP8020 student — the Claude Code strproxy API key
  (from Canvas, written safely into settings, verified with a live call),
  joining the course GitHub org, and recording their crit group. Students with
  their own Claude subscription get the dual-plan setup, with the course key
  scoped to course repos. Every step re-runs independently. Use for "how do I
  get started", "set up my key", "join the course GitHub org", "set my crit
  group", "use my course credits in this repo", or removing the course setup
  when semester ends.
allowed-tools: Bash, Read, Edit, Write, WebFetch
---

# COMP4020 onboard: get your key working

Take a student from nothing to a working, proxy-routed Claude Code. The end
state is settings carrying the course proxy base URL and their `sk-…` key — in
`~/.claude/settings.json` for most students, or scoped to their course repos if
they have their own Claude plan (step 2 decides which) — verified with a live
call.

This skill **makes changes**; **doctor** reports state. If you don't know what's
already configured, run doctor first: one call prints the whole picture, and
these steps are then targeted rather than a tour.

## 0. What did they actually ask for?

The steps below are independent and safe to re-run. A student who asks for one
thing should get that thing:

- "use my course credits in this repo" / "why does my status line say own plan
  in here" → **step 2**, dual-plan branch, and stop. (This is the weekly re-run
  for dual-plan students in a fresh course repo.)
- "set my crit group" / "my cutoff is wrong" → **step 5**, and stop.
- "join the GitHub org" → **step 4**, and stop.
- "install the status line" → not this skill. It's the opt-in companion plugin:
  `claude plugin install comp4020-statusline@comp4020`, then ask it to set the
  status line up.
- "remove the course setup" / "the course is over" → `references/teardown.md`.
- anything open-ended ("set me up", "how do I get started") → start at step 1.

## 1. Get the key from Canvas

The student gets theirs from Canvas — you can't fetch it for them, it's behind
an access quiz:

1. On [canvas.anu.edu.au](https://canvas.anu.edu.au), in the course, find the
   **"Start here"** module (open from 10am Wednesday of week 1; the
   [course access page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/llm-access/#step-2-get-your-key)
   carries the current release detail).
2. Work through it in order — Canvas unlocks each item only as the one before it
   is finished, so a step that looks locked is usually just waiting on the
   previous one. Tick off the VPN step. Next is a **research participation**
   page: that one is voluntary, carries no completion requirement, and gates
   nothing — taking it or skipping it leaves the rest of the module unaffected.
   Then submit the pre-course survey (not assessed — no right answers, and
   nothing in it affects their key), and take the short access quiz, which is
   the step that gates the key — unlimited attempts, so retake until 100%.
3. Passing unlocks the **"Your Claude Code API key"** assignment. Open it and
   read the instructor comment on their submission — the key is the value
   starting with `sk-`.

They only ever see their own key. If the assignment stays locked, the comment is
missing, or it says "revoked", that's a convenor issue — not Anthropic support,
not the strproxy maintainers — so point them at comp4020@anu.edu.au.

Ask them to paste the key when they have it.

## 2. Write it into settings safely

**First, ask one question: do they have their own Claude subscription (Pro or
Max) or a personal Anthropic API key that they use outside this course?** The
answer decides where the key goes:

- **No — the course key is their only Claude access** (most students): write it
  user-global, into `~/.claude/settings.json`. Every session everywhere runs on
  course credits, which is exactly right for them.
- **Yes — they have their own plan**: scope the course key to course repos
  instead. Written user-global, these env vars silently take over their personal
  subscription in _every_ project, so they'd burn course credits on their own
  side projects while their paid plan sat unused. Read `references/dual-plan.md`
  and follow it.

Either way the block is the same, and the rule is the same: **merge, never
clobber** — read the existing file first (it may already hold other settings),
add or update just the three keys inside the `env` object, and write it back as
valid JSON:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://strproxy.comp.anu.edu.au",
    "ANTHROPIC_AUTH_TOKEN": "sk-…(their key)",
    "ANTHROPIC_MODEL": "claude-sonnet-5"
  }
}
```

Notes:

- The variable is `ANTHROPIC_AUTH_TOKEN`, **not** `ANTHROPIC_API_KEY` — the
  proxy authenticates on the `Authorization` header, which is what Claude Code
  sends for `AUTH_TOKEN`.
- The `ANTHROPIC_MODEL` pin matters for their budget: on an API key, Claude Code
  otherwise defaults to Opus — several times Sonnet's price per token — and can
  burn a week's allocation in a day. Don't drop it; a different tier for a
  specific task is a deliberate per-session choice, not a settings change.
- If the file doesn't exist, create it. If it exists but has no `env` block, add
  one; preserve everything else verbatim.
- Confirm the write with the student before saving.
- Trim whitespace from the pasted key; a stray leading or trailing space is a
  common cause of a "revoked-looking" key that's actually fine.
- **Never echo the key back**, and never suggest sending it anywhere except the
  strproxy host.
- **The key never goes in a tracked file.** Most students use
  `~/.claude/settings.json`, outside every repo. The dual-plan branch uses only
  the template's explicitly ignored `.claude/settings.local.json`, after
  `git check-ignore` proves it is protected. The templates also ship a
  pre-commit hook (activated by `pnpm install`) that blocks any commit
  containing something key-shaped — if a student hits that block, the fix is to
  take the key out of the file, never `git commit --no-verify`. A key that has
  already been pushed is leaked: private Ed thread to the teaching team to get
  it rotated.

## 3. Verify the round-trip

Two independent confirmations:

- **The proxy accepts the key** — `doctor`'s `proxy-probe` check does exactly
  this, so run doctor rather than hand-rolling a curl. A connection failure or
  403 usually means they're off the VPN: **all strproxy traffic, model calls
  included, is ANU-network-only**. Reconnect before continuing. A 401 means the
  key didn't take — recheck the paste, then Canvas.
- **Claude Code itself routes through the proxy** — settings take effect for
  _new_ sessions, so `claude --print "say hi"` in a fresh shell is the canonical
  smoke test. On the dual-plan setup, run it **from the course repo's root**;
  anywhere else tests their personal plan instead.

## 4. Join the course GitHub org

The other thing that must be true before week 1. Weekly repos are generated for
students inside `comp4020-agentic-coding-studio`, and until the invitation is
accepted there is nothing to generate them into. Doctor's `org` check reports
the state; if it's `pending`, one call accepts it (their account, so confirm
first):

```sh
gh api --method PATCH /user/memberships/orgs/comp4020-agentic-coding-studio \
  -f state=active
```

Do it now rather than later: **these invitations expire after seven days**, and
a lapsed one has to be re-sent by the convenor. A `Not Found` needs the triage
doctor does — a missing org-readable scope (`read:org` or `admin:org`) and a
never-sent invitation look identical from here and have different fixes.

## 5. Record your crit group

The crit cutoff is two hours before **your group's** session, so it's a
different time for every group — and the skills that quote deadlines can only
name the real one if they know the group. Ask. Students know their group by its
agent's name — Shitao, Bada, Baishi, and so on — and the group table on the
[crits page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/)
maps names to session times if they only know their timetable slot.

Merge it into `~/.claude/settings.json` under `env`, same merge-never-clobber
rule as step 2:

```json
{
  "env": {
    "COMP4020_GROUP": "baishi"
  }
}
```

Lowercase, one of the agent names from the group table. Claude Code applies
`env` entries to every new session on every platform, so skills just read
`$COMP4020_GROUP` — no per-OS config to manage. A student who switches groups
mid-semester re-runs this step.

## 6. Hand off

Once the key verifies and org membership is `active`, run **doctor** to check
the rest of the environment, and mention that `/comp4020:help` lists what else
the plugin does. Keep it to a sentence — don't over-explain.

Two things worth offering once, never installing unasked: the optional
`comp4020-statusline` plugin, which keeps the week's spend at the bottom of
every session (offer it more strongly to a dual-plan student — it's the ambient
"which wallet is this?" indicator), and **balance** for the authoritative
figure on demand.
