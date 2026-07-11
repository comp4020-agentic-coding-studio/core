---
name: doctor
description:
  Checks a COMP4020/COMP8020 student's machine against the course's required
  software environment — Git, the GitHub CLI (gh), membership of the course
  GitHub org, flyctl, Claude Code's proxy config, Chrome, mise — including
  whether the tools that talk to external services (gh, flyctl, the strproxy
  key) are actually authenticated and working, and offers to fix what's broken.
  Also diagnoses the optional budget status line and its dependencies. Use
  whenever the user asks to check their setup, "is everything installed", "why
  isn't gh/fly/claude working", "am I in the course GitHub org", "why is my
  status line empty / stuck / not showing my budget", or wants a
  setup/environment health check.
---

# COMP4020 environment doctor

Diagnose the student's local setup against the course's required tools, then
**offer to fix** what's wrong. This is a laptop health check — the tools they
need installed and, crucially, whether the ones that hit external services
(`gh`, `flyctl`, the strproxy key) are authenticated and reachable.

## Ground truth: fetch the required-tools list live

The canonical list of required and recommended tools lives on the course site's
quickstart page, so fetch it rather than trusting this file to stay current:

```
https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/topics/quickstart.json
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
  the WSL2 warning on the quickstart page and recommend installing WSL2 before
  going further; most other checks won't apply cleanly.

## Checks

Run these, classify each **PASS / WARN / FAIL**, and collect a suggested fix for
anything not PASS. Required tools that are missing or misconfigured are FAIL;
recommended tools (mise, package manager) are WARN.

### Git (required)

- `git --version` — installed? Assume a 4th-year student already has their name
  and email configured; don't check or offer to set `user.name`/`user.email`.

### GitHub CLI `gh` (required, hits an external service)

- `gh --version` — installed?
- `gh auth status` — authenticated to github.com? Exits non-zero when not logged
  in. This is the check that matters: an installed-but-unauthenticated `gh`
  fails the moment they try to clone or open a PR. Fix: `gh auth login` (walk
  them through the browser flow; suggest HTTPS + "Login with a web browser").

### Course GitHub org membership (required, hits an external service)

Every weekly prototype and every assignment repo is generated for you inside the
`comp4020-agentic-coding-studio` org, and you're added to your own as an admin.
Being an **active member** of that org is what makes that silent — a non-member
gets an invitation email per repo instead, and, more to the point, the course's
provisioning refuses to create a repo for anyone who hasn't joined. If this
check fails, you will have nothing to clone on Monday.

```sh
gh api /user/memberships/orgs/comp4020-agentic-coding-studio --jq .state
```

- `active` — PASS.
- `pending` — FAIL. The invitation is sitting there unaccepted. **Org
  invitations expire after seven days**, so don't leave it. One call accepts it,
  and you can offer to run it:
  ```sh
  gh api --method PATCH /user/memberships/orgs/comp4020-agentic-coding-studio \
    -f state=active
  ```
- `404` / "Not Found" — FAIL, but work out which kind before advising. If
  `gh auth status` doesn't list the `read:org` scope, the check itself is blind:
  `gh auth refresh -h github.com -s read:org` and try again. If the scope is
  there, then either no invitation was ever sent, or it lapsed. That's the
  convenor's end, not theirs — comp4020@anu.edu.au.

Never guess between those two. Telling a student to email the convenor about a
scope problem on their own laptop wastes everyone's week.

### flyctl (required for the full-stack half, hits an external service)

The binary is `flyctl` (also symlinked as `fly`). Only hard-FAIL this in the
full-stack half of the course; in the static half a missing flyctl is a WARN
("you'll need this from week 7").

- `flyctl version` — installed?
- `flyctl auth whoami` — logged in?
- `flyctl orgs list` — are they a member of the course-managed org? The org name
  is on the
  [software and platforms](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/software-and-platforms/)
  page; fetch it if you need to name the expected org. Not being in it is a WARN
  (they may not have accepted the invite yet).
- **Payment method**: the course covers billing, so students must not add their
  own card. There's no reliable CLI check for this, so don't assert it — just
  remind them, if flyctl is set up, not to add a payment method and to point any
  billing prompts at the software-and-platforms page.
- Fixes: `flyctl auth login`; for org membership, check for the invite email or
  contact the convenor.

### Claude Code + strproxy (required, hits an external service)

They're running inside Claude Code, so it's installed. What matters is that it's
routed through the course proxy and the key works:

- `ANTHROPIC_BASE_URL` set to the strproxy host (default
  `https://strproxy.comp.anu.edu.au`) and `ANTHROPIC_AUTH_TOKEN` set to an
  `sk-…` key? These normally live in `~/.claude/settings.json` under `env`.
  Missing means they're either on their own Anthropic billing or unconfigured —
  route them to the **quickstart** skill.
- **Live probe**: `GET /api/me` with the key confirms three things at once — the
  key is valid, the proxy is reachable, and they're on the ANU network/VPN:
  ```sh
  curl -sf "${ANTHROPIC_BASE_URL:-https://strproxy.comp.anu.edu.au}/api/me" \
    -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" >/dev/null && echo OK
  ```
  A 200 is PASS. A connection failure/403 almost always means "not on the ANU
  VPN" (their actual Claude sessions still work — only `/api/*` is
  network-restricted); a 401 means the key is wrong or revoked → quickstart /
  Canvas. Don't treat a VPN-only failure as a broken setup.
- **Permission mode**: the course recommends auto mode. If you can see they're
  in default/plan mode, mention auto mode as a flow improvement (not a FAIL).
  Never nudge toward `--dangerously-skip-permissions`.
- Never print the key value back to the user.

### Crit group (recommended)

- `COMP4020_GROUP` set — in the environment, backed by `~/.claude/settings.json`
  under `env` — and equal to one of the group ids (the agent's name, lowercase,
  e.g. `shitao`) listed at `/api/crit-groups.json`? Missing or misspelled is a
  WARN, not a FAIL: nothing breaks, but the deadline-aware skills
  (**submission-preflight**, **ship**, **deadline-radar**) can only say "two
  hours before your session" instead of quoting the student's actual crit
  cutoff. Fix: the **quickstart** skill, step 6 (ask which group, merge the
  variable into settings).

### Budget status line (optional)

Opt-in, so **absence is not a failure**. If `~/.claude/settings.json` has no
`statusLine` block and the `comp4020-statusline` plugin isn't installed, the
student never asked for it: say nothing and move on. Only diagnose it if they've
turned it on, or if they're asking why it isn't working. (Don't read
`~/.claude/comp4020/` as consent — the plugin's hook creates that directory on
install, before any status line exists.)

Once it _is_ on, the failure modes are quiet — an empty or frozen bar, never an
error. Check in this order:

- **`jq` installed?** `command -v jq`. This is the one dependency that isn't
  already on a stock macOS or minimal Ubuntu, and without it the bar reads
  `budget: needs jq`. WARN, not FAIL. Fix: `brew install jq` (macOS),
  `sudo apt install jq` (Debian/Ubuntu/WSL), or `mise use -g jq` (any platform,
  and mise is already recommended below).
- **Companion plugin installed?** The script ships in `comp4020-statusline`, a
  separate opt-in plugin, not in `comp4020`. `claude plugin list` should show
  it. If not: `claude plugin install comp4020-statusline@comp4020`.
- **Script installed and executable?**
  `test -x ~/.claude/comp4020/statusline.sh`. If the plugin is installed but the
  script isn't there, its `SessionStart` hook hasn't run yet — restarting Claude
  Code installs it.
- **`settings.json` points at it?** The `statusLine.command` should be
  `$HOME/.claude/comp4020/statusline.sh`. Installing the plugin does **not**
  write this (no plugin can set `statusLine`), so this is the step people miss.
  A student who already had their own status line may have it pointing elsewhere
  — that's fine and deliberate; check whether their script calls ours (see the
  **quickstart** skill, step 7).
- **Routed through strproxy?** The script stays silent unless
  `ANTHROPIC_BASE_URL` names the strproxy host and `ANTHROPIC_AUTH_TOKEN` holds
  a virtual key — by design, so it never sends a credential to a host it wasn't
  given. On someone's own Claude subscription there is nothing to show and an
  empty segment is correct, not a fault.
- **Native Windows** — there's no Unix shell to run it in. Not a FAIL; it's the
  same WSL2 story as everything else.

Two symptoms worth naming, because neither is a broken setup:

- **`budget: ?`** means the script has never once reached `/api/me`. Nearly
  always the ANU VPN, exactly as with the live probe above. Their Claude
  sessions are unaffected.
- **A number that won't move.** Expected: the figure is cached for 60 seconds
  and refreshed in the background, so it always lags a little. Off the VPN it
  will sit on the last figure it managed to fetch, indefinitely. If they want
  the authoritative number now, that's the **check-balance** skill.

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
   config edits (merging into `settings.json` via the quickstart flow) you can
   do directly on confirmation; interactive external logins (`gh auth login`,
   `flyctl auth login`) open a browser and can't be fully automated — run them
   for the user (they'll complete the browser step) or hand them the command,
   whichever the situation calls for. Never run a fix without an explicit yes.
4. If everything's green, say so plainly and stop — no busywork.

## Handing off

- No proxy key configured → the **quickstart** skill.
- "How much budget do I have" / over-budget → the **check-balance** skill.
- Anything about course rules, deadlines, or what a tool is _for_ → the
  **course-info** skill.
