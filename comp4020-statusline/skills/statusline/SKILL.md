---
name: statusline
description:
  Sets up and diagnoses the COMP4020/COMP8020 budget status line — the segment
  at the bottom of every Claude Code session showing the week's strproxy spend
  on course credits, or a dim "own plan" tag otherwise. Use for "install the
  status line", "show my budget in the status line", "turn the status line off",
  "why is my status line empty / stuck / blank", "why does it say own plan", or
  "remove the status line".
---

# COMP4020 budget status line

This plugin ships the script; the student's `settings.json` points at it. Both
halves have to be in place, which is the source of nearly every "it isn't
working" report.

```
comp4020 $41.20/$100 (41%)
```

Green through amber to red as the weekly cap approaches. In a session that
_isn't_ running on course credits — a personal subscription or key, or no key at
all — it shows a dim `own plan` instead, so which wallet a session draws from is
always visible. For a student running the course key alongside their own Claude
plan, that flip is the main reason to want it.

## Install

**It needs `jq`** (and `curl`, which every supported platform already has).
Check with `command -v jq`; if it's missing, install it first with
`mise use -g jq` (the course's install path — see quickstart step 2). Without
`jq` the segment just reads `comp4020 budget: needs jq`.

It's a Unix shell script, so macOS, Linux and WSL. On native Windows there is
nothing to install — that's the WSL2 nudge `/comp4020:doctor` already gives.

1. The plugin is installed (you're running its skill), and its `SessionStart`
   hook copies the script to `~/.claude/comp4020/statusline.sh` at the start of
   the **next** session. If it isn't there yet, don't hunt for it — carry on and
   tell them it lights up when they restart.

2. Merge this into `~/.claude/settings.json` — **read the file first and add
   just this key**, preserving everything else verbatim. Installing the plugin
   never writes it: a plugin cannot set `statusLine`, which is exactly why the
   student's consent is needed here.

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

## When it isn't working

The script always prints one of two tags, so the first question is which of
three states they're in. Work down in this order:

- **completely empty segment** — the script isn't running at all. Check, in
  order: `command -v jq`; `claude plugin list` shows `comp4020-statusline`;
  `test -x ~/.claude/comp4020/statusline.sh` (if the plugin is installed but the
  script is missing, its `SessionStart` hook hasn't run yet — restarting Claude
  Code installs it); and `statusLine.command` in `~/.claude/settings.json`
  actually points at that path. That last one is the step people miss, because
  installing the plugin does not write it.
- **`own plan`** — the script works, but the session isn't routed through
  strproxy. It shows the budget only when `ANTHROPIC_BASE_URL` names the
  strproxy host and `ANTHROPIC_AUTH_TOKEN` holds a virtual key, by design, so it
  never sends a credential to a host it wasn't given. Whether that's correct
  depends on the setup: on someone's own Claude subscription outside course work
  it's exactly right, and for a student running both plans it's right everywhere
  _except_ inside a course repo. Seeing it there means the repo's
  `.claude/settings.local.json` is missing — usually a fresh weekly clone. Fix:
  `/comp4020:quickstart`, the dual-plan branch.
- **`comp4020` with a stale or missing figure** — not a broken setup.
  `budget: ?` means the script has never reached `/api/me`, nearly always the
  ANU VPN; a number that won't move is the 60-second cache, which off the VPN
  sits on the last figure it fetched indefinitely. Their Claude sessions are
  unaffected either way.

A student who already had their own status line may have it pointing elsewhere —
that's fine and deliberate; check whether their script calls ours (the append
recipe above).

## What it is, and isn't

It reads a figure cached and refreshed at most once a minute in the background:
an indicator, not a ledger. The authoritative number is
`/comp4020:check-balance` — say so if the two disagree, rather than trusting the
bar.

## Turning it off

Delete the `statusLine` block from `~/.claude/settings.json`. To also stop the
hook reinstalling the script:

```sh
claude plugin uninstall comp4020-statusline@comp4020
rm -rf ~/.claude/comp4020
```

The `comp4020` skills plugin is unaffected either way.
