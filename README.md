# COMP4020 skills

Claude Code skills for students in
[COMP4020/COMP8020 Agentic Coding Studio](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
at the ANU. This repo is a
[Claude Code plugin marketplace](https://docs.anthropic.com/en/docs/claude-code/plugins):
you subscribe once, and skill updates flow to you automatically.

## Install

From any Claude Code session:

```
/plugin marketplace add comp4020-agentic-coding-studio/skills
/plugin install comp4020@comp4020
```

Or from the shell:

```sh
claude plugin marketplace add comp4020-agentic-coding-studio/skills
claude plugin install comp4020@comp4020
```

To pick up updates later: `/plugin marketplace update comp4020`.

## What's in the plugin

### course-info

Answers course-admin questions — "when is assignment 3 due and how much is it
worth?", "what's the extension policy?", "what does the week 4 lecture cover?" —
by querying the live course website (its JSON content-graph API and `llms.txt`
endpoints). The skill holds no course facts itself, only knowledge of where to
look, so its answers are always as current as the site. It triggers
automatically on questions about the course, or invoke it directly with
`/comp4020:course-info`.

### check-balance

Answers "check my balance", "how much budget do I have left?", "why is my key
not working?" by querying the course proxy's `/api/me` endpoint with the same
key Claude Code is already using — no extra setup or login. Reports weekly spend
against the cap and when the budget resets, explains the common failure modes
(off-campus without the ANU VPN, revoked key), and knows what to suggest when
the budget runs out. Triggers automatically on budget/usage questions, or invoke
it directly with `/comp4020:check-balance`.
