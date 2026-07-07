---
name: doctor
description:
  Checks a COMP4020/COMP8020 student's machine against the course's required
  software environment — Git, the GitHub CLI (gh), flyctl, Claude Code's proxy
  config, Chrome, mise — including whether the tools that talk to external
  services (gh, flyctl, the strproxy key) are actually authenticated and
  working, and offers to fix what's broken. Use whenever the user asks to check
  their setup, "is everything installed", "why isn't gh/fly/claude working", or
  wants a setup/environment health check.
---

# COMP4020 environment doctor

Diagnose the student's local setup against the course's required tools, then
**offer to fix** what's wrong. This is a laptop health check — the tools they
need installed and, crucially, whether the ones that hit external services
(`gh`, `flyctl`, the strproxy key) are authenticated and reachable.

## Ground truth: fetch the required-tools list live

The canonical list of required and recommended tools lives on the course site,
so fetch it rather than trusting this file to stay current:

```
https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/topics/software-environment.json
```

Read its `body`. The checks below cover every tool that page currently lists. If
the fetched page names a tool this skill doesn't know how to check, report it as
"listed on the site — verify manually" rather than skipping it silently: that
gap is a signal the skill has drifted from the site, worth flagging to the
convenor.

## Detect the platform first

Run `uname -s` (and check for WSL). Tailor every check and fix to the result:

- **macOS** (`Darwin`) — Homebrew-first fixes.
- **Linux** (`Linux`, no WSL marker) — distro package manager.
- **WSL** (`Linux` with `microsoft` in `/proc/version`) — treat as Linux; this
  is the supported Windows path.
- **Native Windows** (no Unix shell) — this is off the supported path. Point at
  the WSL2 warning on the software-environment page and recommend installing
  WSL2 before going further; most other checks won't apply cleanly.

## Checks

Run these, classify each **PASS / WARN / FAIL**, and collect a suggested fix for
anything not PASS. Required tools that are missing or misconfigured are FAIL;
recommended tools (mise, package manager) are WARN.

### Git (required)

- `git --version` — installed?
- `git config --get user.name` and `git config --get user.email` — both set?
  Unset means commits will be u(mis)attributed. Fix:
  `git config --global user.name "…"` / `user.email "…"`.

### GitHub CLI `gh` (required, hits an external service)

- `gh --version` — installed?
- `gh auth status` — authenticated to github.com? Exits non-zero when not logged
  in. This is the check that matters: an installed-but-unauthenticated `gh`
  fails the moment they try to clone or open a PR. Fix: `gh auth login` (walk
  them through the browser flow; suggest HTTPS + "Login with a web browser").

### flyctl (required for the full-stack half, hits an external service)

The binary is `flyctl` (also symlinked as `fly`). Only hard-FAIL this in the
full-stack half of the course; in the static half a missing flyctl is a WARN
("you'll need this from week 7").

- `flyctl version` — installed?
- `flyctl auth whoami` — logged in?
- `flyctl orgs list` — are they a member of the course-managed org? The org name
  is on the
  [platforms](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/platforms/)
  page; fetch it if you need to name the expected org. Not being in it is a WARN
  (they may not have accepted the invite yet).
- **Payment method**: the course covers billing, so students must not add their
  own card. There's no reliable CLI check for this, so don't assert it — just
  remind them, if flyctl is set up, not to add a payment method and to point any
  billing prompts at the platforms page.
- Fixes: `flyctl auth login`; for org membership, check for the invite email or
  contact the convenor.

### Claude Code + strproxy (required, hits an external service)

They're running inside Claude Code, so it's installed. What matters is that it's
routed through the course proxy and the key works:

- `ANTHROPIC_BASE_URL` set to the strproxy host (default
  `https://strproxy.comp.anu.edu.au`) and `ANTHROPIC_AUTH_TOKEN` set to an
  `sk-…` key? These normally live in `~/.claude/settings.json` under `env`.
  Missing means they're either on their own Anthropic billing or unconfigured —
  route them to the **onboarding** skill.
- **Live probe**: `GET /api/me` with the key confirms three things at once — the
  key is valid, the proxy is reachable, and they're on the ANU network/VPN:
  ```sh
  curl -sf "${ANTHROPIC_BASE_URL:-https://strproxy.comp.anu.edu.au}/api/me" \
    -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" >/dev/null && echo OK
  ```
  A 200 is PASS. A connection failure/403 almost always means "not on the ANU
  VPN" (their actual Claude sessions still work — only `/api/*` is
  network-restricted); a 401 means the key is wrong or revoked → onboarding /
  Canvas. Don't treat a VPN-only failure as a broken setup.
- **Permission mode**: the course recommends auto mode. If you can see they're
  in default/plan mode, mention auto mode as a flow improvement (not a FAIL).
  Never nudge toward `--dangerously-skip-permissions`.
- Never print the key value back to the user.

### Chrome ≥ 140 (required)

Version detection is per-OS:

- macOS:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version`
- Linux/WSL: `google-chrome --version` or `google-chrome-stable --version`

Parse the major version; below 140 is a WARN with an "update Chrome" nudge.
Can't find it at all → WARN (they may have it elsewhere; ask).

### mise (recommended)

`mise --version`. Missing is a WARN — it's recommended, not required. Fix per
platform (`brew install mise`, or the install script).

### System package manager (recommended)

macOS: `brew --version`. Debian/Ubuntu/WSL: `apt --version`. Missing is a WARN.

## Report, then offer to fix

1. Print a compact per-tool summary: `PASS` / `WARN` / `FAIL` with a one-line
   reason. Lead with the FAILs.
2. For each non-PASS item, state the exact fix command.
3. **Offer to run the fixes, confirming each one before you run it.** Safe
   config edits (setting `git config`, merging into `settings.json` via the
   onboarding flow) you can do directly on confirmation; interactive external
   logins (`gh auth login`, `flyctl auth login`) open a browser and can't be
   fully automated — run them for the user (they'll complete the browser step)
   or hand them the command, whichever the situation calls for. Never run a fix
   without an explicit yes.
4. If everything's green, say so plainly and stop — no busywork.

## Handing off

- No proxy key configured → the **onboarding** skill.
- "How much budget do I have" / over-budget → the **check-balance** skill.
- Anything about course rules, deadlines, or what a tool is _for_ → the
  **course-info** skill.
