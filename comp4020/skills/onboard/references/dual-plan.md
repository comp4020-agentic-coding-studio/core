# The dual-plan setup: course key scoped to course repos

For a student who already has their own Claude subscription (Pro or Max) or a
personal Anthropic API key. Read this from step 2 of the onboard skill.

## Why not user-global

Written into `~/.claude/settings.json`, the course env vars take over Claude
Code in _every_ project on the machine. The student would burn course credits on
their own side projects while the plan they pay for sat unused. So the course
key goes somewhere narrower.

If they've **already** done the global setup and only then mention a personal
plan, the fix is a move, not a copy: delete the three vars from
`~/.claude/settings.json` first, then set up the repo-scoped version.

## Where the key goes instead

The same `env` block from step 2, but in `.claude/settings.local.json` at the
**course repo's root**:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://strproxy.comp.anu.edu.au",
    "ANTHROPIC_AUTH_TOKEN": "sk-…(their key)",
    "ANTHROPIC_MODEL": "claude-sonnet-5"
  }
}
```

Project settings override user settings, so inside the repo every session runs
on course credits; everywhere else Claude Code falls back to their own
subscription or key, untouched.

The course templates ignore the whole `.claude/` directory, this path included,
and the pre-commit key guard backstops it. Do not assume that protection in any
other repo: **before writing the file**, prove Git ignores it:

```sh
git check-ignore .claude/settings.local.json
```

The command must print the path and exit successfully. If it does not, add the
exact path to that repo's `.gitignore`, run the check again, and only then write
the key. Never display the key while copying the settings from another course
repo.

## It repeats every week

Course repos arrive per deliverable, so this is a weekly step, not a one-off:
"use my course credits in this repo" in a fresh clone means running just this
branch again. The key is the same one every time — copy the `env` block across
from last week's repo rather than sending the student back to Canvas.

## Two things to tell them once

- Settings are read when a session **starts**, so which credits a session uses
  is decided by where it was launched, not where they `cd` afterwards. Start a
  fresh `claude` inside the course repo for course work.
- The optional status line is how they see the split at a glance:
  `comp4020 $41.20/$100 (41%)` in a course repo, a dim `own plan` everywhere
  else. Worth offering more strongly than usual here — it is the ambient "which
  wallet is this session burning" indicator, and `own plan` showing up _inside_
  a course repo is the signal that this file is missing.
