---
name: onboarding
description:
  Walks a new COMP4020/COMP8020 student through configuring their Claude Code
  strproxy API key end to end — checking whether it's already set, guiding them
  to the key on Canvas, writing it safely into ~/.claude/settings.json, and
  verifying the round-trip works. Use for first-time setup, "set up my key",
  "Claude Code isn't using the course proxy", or "how do I get started".
---

# COMP4020 onboarding: get your key working

Get a student from nothing to a working, proxy-routed Claude Code. The end state
is `~/.claude/settings.json` carrying the course proxy base URL and their `sk-…`
key, verified with a live call.

## 1. Is it already set up?

Check before touching anything:

- Are `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` already in the environment
  or in `~/.claude/settings.json` under `env`?
- If so, verify rather than reconfigure — jump to step 4. If it verifies,
  they're done; say so and stop.

## 2. Get the key from Canvas

If there's no key, the student gets theirs from Canvas (you can't fetch it for
them — it's behind an access quiz):

1. On [canvas.anu.edu.au](https://canvas.anu.edu.au), in the course, find the
   **"Claude Code API key"** module.
2. Take the short access quiz — unlimited attempts, so retake until 100%.
3. Passing unlocks the **"Your Claude Code API key"** assignment. Open it and
   read the instructor comment on their submission — the key is the value
   starting with `sk-`.

They only ever see their own key. If the assignment stays locked, the comment is
missing, or it says "revoked", that's a convenor issue (not Anthropic support,
not the strproxy maintainers) — point them at the course support address,
comp4020@anu.edu.au.

Ask them to paste the key when they have it.

## 3. Write it into settings safely

Target `~/.claude/settings.json`. **Merge, never clobber** — read the existing
file first (it may already hold other settings), add or update just the two keys
inside the `env` object, and write it back as valid JSON:

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

For a project-specific key instead of the user-wide one, the same block goes in
`.claude/settings.local.json` at the project root (project settings override
user settings) — offer this only if they ask.

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
  work. Don't block onboarding on a VPN-only failure; note it and move on. A 401
  means the key didn't take — recheck the paste (step 3), then Canvas (step 2).
- **Claude Code itself routes through the proxy**: note that the setting takes
  effect for _new_ sessions. `claude --print "say hi"` in a fresh shell is the
  canonical smoke test; the current session may need a restart to pick up a
  newly written `settings.json`.

## 5. Hand off

Once the key verifies, offer to run the **doctor** skill to check the rest of
the environment (Git, `gh`, flyctl, Chrome), and mention **check-balance** for
"how much budget do I have". Keep it to a sentence — don't over-explain.
