---
name: help
description:
  Lists what the COMP4020/COMP8020 course plugin can do and routes the student
  to the right skill. Use when the user asks "what can you help with", "what
  does the comp4020 plugin do", invokes /comp4020:help, or asks a course-related
  question that doesn't clearly match one specific skill.
allowed-tools: Bash, WebFetch
---

# COMP4020 plugin — what's here

This plugin bundles the course's student-facing skills. Most trigger
automatically on the right kind of question; this is the menu and the router.
Point the student at the one that fits, or just answer if their question already
matches a skill's job.

| Ask about…                                                                  | Skill                    |
| --------------------------------------------------------------------------- | ------------------------ |
| Deadlines, marking, policies, what a lecture covers, who teaches the course | **course-info**          |
| Your weekly Claude Code budget — spent, left, when it resets                | **check-balance**        |
| First-time setup: your strproxy key, the course GitHub org, your crit group | **onboard**              |
| Using course credits alongside your own Claude subscription                 | **onboard**, step 2      |
| Whether your machine is set up right, and why a tool isn't working          | **doctor**               |
| What's due / what to work on this week                                      | **deadline-radar**       |
| Starting this week's prototype or an assignment, carrying CLAUDE.md forward | **start**                |
| Whether your work is ready to submit before a deadline                      | **submission-preflight** |
| Making your repo public and getting it deployed at the cutoff               | **ship**                 |

A natural first-week path is **onboard** → **doctor**; a natural crit-week path
is **deadline-radar** → **start** → **submission-preflight** → **ship**.

The split worth knowing: **doctor** diagnoses, **onboard** changes settings. If
something looks wrong, doctor first — it prints the whole picture in one call.

Showing your weekly budget in the status line is a separate, optional plugin, so
it's only there if you asked for it:

```sh
claude plugin install comp4020-statusline@comp4020
```

Then ask it to set the status line up. It carries its own **statusline** skill
for installing, diagnosing and removing it.

All course facts come from the live site
(`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio`) and the
course proxy, so answers stay current. If nothing here fits and it's a
course-admin question, fall back to **course-info**; if it's a
personal/enrolment matter, the answer is a human — comp4020@anu.edu.au.
