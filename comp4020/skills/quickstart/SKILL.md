---
name: quickstart
description:
  Walks a new COMP4020/COMP8020 student through first-time setup end to end —
  configuring their Claude Code strproxy API key (checking whether it's already
  set, guiding them to the key on Canvas, writing it safely into settings —
  user-global, or scoped to course repos for students with their own Claude
  subscription — and verifying the round-trip), accepting their invitation to
  the course GitHub org, recording their crit group so deadline-aware skills can
  quote their real cutoff, and optionally turning on the budget status line.
  Each step is independently re-runnable, so a student who is already set up can
  come back for just one of them. Use for first-time setup, quickstart, "set up
  my key", "Claude Code isn't using the course proxy", "join the course GitHub
  org", "how do I get started", "set my crit group" (or "studio group"), "which
  group am I in", "install the status line", "show my budget in the status
  line", "turn off the status line", "I have my own Claude subscription", "use
  my course credits in this repo", or "why does my status line say own plan".
---

# COMP4020 quickstart: get your key working

Get a student from nothing to a working, proxy-routed Claude Code. The end state
is settings carrying the course proxy base URL and their `sk-…` key — in
`~/.claude/settings.json` for most students, or scoped to their course repos if
they have their own Claude plan (step 3 decides which) — verified with a live
call.

## 0. What did they actually ask for?

The steps below are independent and safe to re-run. A student who asks for one
thing should get that thing, not the whole tour:

- "install the status line" / "show my budget in the status line" / "turn the
  status line off" → **step 7**, and stop.
- "use my course credits in this repo" / "why does my status line say own plan
  in here" → **step 3**, dual-plan branch, and stop. (This is the weekly re-run
  for dual-plan students in a fresh course repo.)
- "set my crit group" / "my cutoff is wrong" → **step 6**, and stop.
- "join the GitHub org" → **step 5**, and stop.
- anything open-ended ("set me up", "how do I get started") → start at step 1
  and work down.

## 1. Is it already set up?

Check before touching anything:

- Are `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` already in the environment
  or in `~/.claude/settings.json` under `env`? For a dual-plan student they may
  instead be in `.claude/settings.local.json` at a course repo's root — check
  there too if the current directory is inside one.
- If so, verify rather than reconfigure — jump to step 4. If it verifies, the
  key half is done: don't re-ask for it, don't rewrite settings. Move on to
  step 5.

## 2. Get the key from Canvas

If there's no key, the student gets theirs from Canvas (you can't fetch it for
them — it's behind an access quiz):

1. On [canvas.anu.edu.au](https://canvas.anu.edu.au), in the course, find the
   **"Start here"** module (it unlocks on Tuesday of week 1 — 28 July).
2. Work through it in order: tick off the VPN step, submit the pre-course
   survey, then take the short access quiz — unlimited attempts, so retake until
   100%.
3. Passing unlocks the **"Your Claude Code API key"** assignment. Open it and
   read the instructor comment on their submission — the key is the value
   starting with `sk-`.

They only ever see their own key. If the assignment stays locked, the comment is
missing, or it says "revoked", that's a convenor issue (not Anthropic support,
not the strproxy maintainers) — point them at the course support address,
comp4020@anu.edu.au.

Ask them to paste the key when they have it.

## 3. Write it into settings safely

**First, ask one question: do they have their own Claude subscription (Pro or
Max) or a personal Anthropic API key that they use outside this course?** The
answer decides where the key goes:

- **No — the course key is their only Claude access** (most students): write it
  user-global, into `~/.claude/settings.json`. Every session everywhere runs on
  course credits, which is exactly right for them.
- **Yes — they have their own plan**: scope the course key to course repos
  instead (the **dual-plan branch** below). Written user-global, these two env
  vars silently take over their personal subscription in _every_ project — they
  would burn course credits on their own side projects while their paid plan sat
  unused. If they've already done the global setup and then mention a personal
  plan, the fix is a move, not a copy: delete the two vars from
  `~/.claude/settings.json`, then set up the repo-scoped version.

Either way the block is the same, and the rule is the same: **merge, never
clobber** — read the existing file first (it may already hold other settings),
add or update just the two keys inside the `env` object, and write it back as
valid JSON:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://strproxy.comp.anu.edu.au",
    "ANTHROPIC_AUTH_TOKEN": "sk-…(their key)"
  }
}
```

Notes:

- The variable is `ANTHROPIC_AUTH_TOKEN`, **not** `ANTHROPIC_API_KEY` — the
  proxy authenticates on the `Authorization` header, which is what Claude Code
  sends for `AUTH_TOKEN`.
- If the file doesn't exist, create it. If it exists but has no `env` block, add
  one; preserve everything else verbatim.
- Confirm the write with the student before saving.
- Trim whitespace from the pasted key; a stray leading/trailing space is a
  common cause of a "revoked-looking" key that's actually fine.
- **Never echo the key back** in your response, and never suggest sending it
  anywhere except the strproxy host.
- **The key never goes in a repo.** `~/.claude/settings.json` sits outside every
  repo, which is the point. The course template repos also ship a pre-commit
  hook (activated by `pnpm install`) that blocks any commit containing something
  key-shaped — if a student hits that block, the fix is to take the key out of
  the file (env var or an untracked `.env`, which the templates already
  gitignore), never `git commit --no-verify`. A key that has already been pushed
  is leaked: private Ed thread to the teaching team to get it rotated.

### The dual-plan branch: scope the key to course repos

For a student with their own Claude plan, the same `env` block goes in
`.claude/settings.local.json` at the **course repo's root** instead of
`~/.claude/settings.json`. Project settings override user settings, so inside
the repo every session runs on course credits; everywhere else Claude Code falls
back to their own subscription or key, untouched. Claude Code keeps
`settings.local.json` out of version control automatically, and the template
pre-commit key guard backstops it — but it's still a file inside a repo, so
double-check it's ignored (`git check-ignore .claude/settings.local.json`)
before writing the key into it.

Course repos arrive weekly, so this step repeats: in each fresh repo, "use my
course credits in this repo" re-runs just this branch. The key is the same one
every time — copy the `env` block across from last week's repo rather than
sending the student back to Canvas.

Two things to tell them once:

- The settings are read when a session starts, so which credits a session uses
  is decided by **where it was launched**, not where they `cd` afterwards. Start
  a fresh `claude` inside the course repo for course work.
- The status line (step 7) is how they see the split at a glance:
  `comp4020 $41.20/$100 (41%)` in a course repo, a dim `own plan` everywhere
  else. For a dual-plan student, offer it more strongly than usual — it's the
  ambient "which wallet is this session burning" indicator.

## 4. Verify the round-trip

Two independent confirmations:

- **The proxy accepts the key** (also confirms VPN/network):
  ```sh
  curl -sf "https://strproxy.comp.anu.edu.au/api/me" \
    -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" >/dev/null && echo OK
  ```
  200/OK = the key is valid and they're on the ANU network. A connection failure
  or 403 here usually just means they're off the VPN — the `/api/*` endpoints
  are ANU-network-only, but _model traffic isn't_, so Claude Code will still
  work. Don't block setup on a VPN-only failure; note it and move on. A 401
  means the key didn't take — recheck the paste (step 3), then Canvas (step 2).
- **Claude Code itself routes through the proxy**: note that the setting takes
  effect for _new_ sessions. `claude --print "say hi"` in a fresh shell is the
  canonical smoke test; the current session may need a restart to pick up newly
  written settings. On the dual-plan setup, run it **from the course repo's
  root** — that's where the settings live, and running it elsewhere tests their
  personal plan instead.

## 5. Join the course GitHub org

The other thing that must be true before week 1. Your weekly repos are generated
for you inside `comp4020-agentic-coding-studio`, and until you accept the
invitation there is nothing to generate them into.

```sh
gh api /user/memberships/orgs/comp4020-agentic-coding-studio --jq .state
```

`active` and you're done. `pending` means the invitation is waiting — accept it
(offer to run this; it's their account, so confirm first):

```sh
gh api --method PATCH /user/memberships/orgs/comp4020-agentic-coding-studio \
  -f state=active
```

Do it now rather than later: **these invitations expire after seven days**, and
a lapsed one has to be re-sent by the convenor.

A `Not Found` means one of two different things. If `gh auth status` doesn't
list the `read:org` scope, the check can't see the membership even if it exists
— `gh auth refresh -h github.com -s read:org`, then re-check. If the scope is
there, no invitation is outstanding, and that's a convenor issue:
comp4020@anu.edu.au. Don't send them emailing about a problem on their own
laptop.

## 6. Record your crit group

The crit cutoff is two hours before **your group's** session, so it's a
different time for every group — and the skills that quote deadlines
(**submission-preflight**, **ship**, **deadline-radar**) can only name your
actual cutoff if they know which group you're in. Ask. Students know their group
by its agent's name — Shitao, Bada, Baishi, and so on — and the group table on
the
[crits page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/)
(also at `/api/crit-groups.json`) maps names to session times if they only know
their timetable slot.

Merge it into `~/.claude/settings.json` under `env`, with the same
merge-never-clobber rule as step 3:

```json
{
  "env": {
    "COMP4020_GROUP": "baishi"
  }
}
```

Lowercase, one of the agent names from the group table. Claude Code applies
`env` entries to every new session on every platform, so skills just read
`$COMP4020_GROUP` — no per-OS config file to manage. Takes effect in new
sessions, like everything else in this file. A student who switches groups
mid-semester re-runs this step.

## 7. Optional: your budget in the status line

Offer this once the key verifies — never install it unasked. It puts the week's
spend at the bottom of every Claude Code session, green → amber → red as the cap
approaches:

```
comp4020 $41.20/$100 (41%)
```

In a session that _isn't_ running on course credits (a personal subscription or
key, or no key at all) it shows a dim `own plan` instead, so which wallet a
session draws from is always visible. For a dual-plan student (step 3) that flip
is the main reason to want it.

**It needs `jq`** (and `curl`, which every supported platform already has).
Check with `command -v jq`; if it's missing, install it before going further:
`brew install jq` on macOS, `sudo apt install jq` on Debian/Ubuntu/WSL, or
`mise use -g jq` anywhere. Without `jq` the bar just reads `budget: needs jq`.

It's a Unix shell script: macOS, Linux and WSL. On native Windows there's
nothing to install — that's the WSL2 nudge the **doctor** skill already gives.

To install:

1. Install the companion plugin, which ships the script:

   ```sh
   claude plugin install comp4020-statusline@comp4020
   ```

   It's deliberately separate from the `comp4020` plugin. This one carries a
   `SessionStart` hook (that's what keeps the script current across updates),
   and a student who doesn't want the status line shouldn't be running a hook
   they never asked for. Installing it is the opt-in.

   The hook copies the script to `~/.claude/comp4020/statusline.sh` at the start
   of the **next** session. If it isn't there yet, don't hunt for it — carry on
   to step 2 and tell them it lights up when they restart. To have it now:

   ```sh
   mkdir -p ~/.claude/comp4020
   src=$(ls -t ~/.claude/plugins/cache/*/comp4020-statusline/*/scripts/statusline.sh 2>/dev/null | head -1)
   [ -n "$src" ] && cp "$src" ~/.claude/comp4020/statusline.sh &&
     chmod +x ~/.claude/comp4020/statusline.sh
   ```

2. Merge this into `~/.claude/settings.json` — **the same merge-never-clobber
   rule as step 3**. Installing the plugin never writes this for them; a plugin
   cannot set `statusLine`, which is why their consent is needed here:

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "$HOME/.claude/comp4020/statusline.sh"
     }
   }
   ```

   If they **already have a `statusLine`**, leave it alone and say so. The
   script reads nothing from stdin, so their existing one can append its output
   instead:

   ```sh
   printf ' %s' "$("$HOME/.claude/comp4020/statusline.sh" </dev/null)"
   ```

3. Tell them it appears in **new** sessions, not this one.

What to say if they ask how it works, or why the number looks stale:

- It reads a cached figure and refreshes at most once a minute in the
  background, so it never slows a session down or hammers the proxy — the number
  can lag real spend by up to a minute, on top of the proxy's own
  eventually-consistent accounting. It's an indicator, not a ledger; for the
  authoritative figure use **check-balance**.
- `/api/me` is ANU-network-only, so off the VPN it keeps showing the last figure
  it managed to fetch. `comp4020 budget: ?` means it has never reached the proxy
  — the usual cause is being off the VPN, and their Claude sessions still work
  fine. The `comp4020` tag itself never lies: if it's showing, the session is on
  course credits, whatever the figure next to it says.
- A key with no cap (rare) shows `comp4020 $3.50 this week` and no percentage.
- It contacts nobody unless `ANTHROPIC_BASE_URL` names the strproxy host and
  `ANTHROPIC_AUTH_TOKEN` holds a virtual key — the script won't send a
  credential to a host it wasn't explicitly given. In that case it prints the
  dim `own plan` tag instead: the session is running on the student's own
  subscription, key, or gateway, not course credits.

To turn it off: delete the `statusLine` block from `~/.claude/settings.json`. To
also stop the hook reinstalling the script,
`claude plugin uninstall comp4020-statusline@comp4020` and
`rm -rf ~/.claude/comp4020`. The `comp4020` skills plugin is unaffected either
way.

## 8. Hand off

Once the key verifies and the org membership is `active`, offer to run the
**doctor** skill to check the rest of the environment (Git, `gh`, flyctl,
Chrome), and mention **check-balance** for "how much budget do I have". Keep it
to a sentence — don't over-explain.
