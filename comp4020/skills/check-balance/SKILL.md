---
name: check-balance
description:
  Checks the user's Claude Code budget on the COMP4020 proxy (strproxy) — how
  much of the weekly allowance is spent, what's left, and when it resets — by
  querying the proxy's /api/me endpoint with the key already in the environment.
  Use whenever the user asks about their balance, budget, spend, usage, quota,
  or why their key seems blocked or out of budget.
---

# Check my Claude Code balance

Your Claude Code traffic in this course runs through strproxy, the course proxy
that enforces a weekly per-student dollar budget. The proxy exposes a student
endpoint, `GET /api/me`, and it accepts the same credential Claude Code is
already using — so checking the balance needs no extra setup or login.

## The call

The student's virtual key is in `ANTHROPIC_AUTH_TOKEN` (that's how Claude Code
authenticates to the proxy). The API host is the same host as
`ANTHROPIC_BASE_URL`; default to `https://strproxy.comp.anu.edu.au` if the
variable is unset or you can't parse it.

```sh
curl -sf "https://strproxy.comp.anu.edu.au/api/me" \
  -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN"
```

For a per-request breakdown of the current week (useful for "what cost so
much?"), add `?detail=requests`.

Response fields that matter:

- `current_week_spend` / `max_budget` — dollars spent this week vs the weekly
  cap. Both USD.
- `week_starts_at` / `week_resets_at` — the current budget week's bounds.
  `week_resets_at` is authoritative for "when do I get my budget back".
- `recent_sessions` — per-session aggregates; `requests` (with
  `detail=requests`) has per-request model/cost/token rows.

## How to interpret the numbers

- **The budget is a flat weekly allowance.** It resets every Monday at 00:00
  Canberra time (`week_resets_at` says exactly when); unused budget does not
  carry over. Don't describe it as "7 days from your first request" — it's a
  calendar boundary.
- **Spend can lag slightly.** Budget accounting is eventually consistent, so
  right after a burst of requests the reported spend may be a little behind.
  Treat near-the-cap readings as approximate, not to-the-cent.
- **Local-model traffic is free.** If the course has a local-model fallback
  (e.g. `local-qwen`), those requests are rate-limited but cost $0 against the
  dollar budget — they won't show up in spend.
- **Cold starts dominate cost.** A fresh Claude Code session pays for the full
  ~35k-token system prompt (roughly $0.10 on Sonnet); follow-up turns in the
  same session hit the prompt cache and cost under half a cent. Many short
  sessions burn budget much faster than a few long ones — worth mentioning when
  the user asks why their spend is high.

## When the call fails

- **Connection refused / timeout / 403** — the `/api/*` endpoints only accept
  traffic from the ANU network. The user is probably off-campus: tell them to
  connect to the ANU VPN. Their actual Claude Code sessions are unaffected (the
  model-traffic path has no such restriction), so a working Claude and a failing
  balance check almost always means "not on the VPN", not a broken key.
- **401** — the key itself was rejected: `ANTHROPIC_AUTH_TOKEN` is unset,
  mistyped, or the key has been revoked/rotated. Have them check the env var
  against the key in the "Your Claude Code API key" assignment comment on
  Canvas, and contact the course support address if it still fails.

## When they're over budget

- The budget comes back at `week_resets_at` — say when that is in local time.
- If the course has a local-model fallback, they can keep working now:
  `export ANTHROPIC_MODEL=<the course's local model name>` in the shell that
  runs Claude Code. (The 90%/100% warning emails name the model.)
- If a deadline makes the cap a real problem, the fix is human: email the course
  support address (for COMP4020 that's comp4020@anu.edu.au) — convenors can
  arrange a one-off bump for the cohort. Don't suggest workarounds like sharing
  keys.

## Answering rules

- Lead with the headline: spent $X.XX of $Y.YY this week (Z%), resets <weekday>
  <local time>. Convert `week_resets_at` to the user's local time rather than
  echoing the raw ISO timestamp.
- Don't dump raw JSON unless asked; summarise, and only fetch `detail=requests`
  when the question is about _what_ cost money.
- Never print the full `ANTHROPIC_AUTH_TOKEN` value back to the user in your
  answer, and never suggest sending it anywhere other than the proxy host.
