---
name: help
description:
  Lists what the COMP4020/COMP8020 course plugin can do and routes the student
  to the right skill. Use when the user asks "what can you help with", "what
  does the comp4020 plugin do", invokes /comp4020:help, or asks a course-related
  question that doesn't clearly match one specific skill.
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
| First-time setup — your strproxy key, and joining the course GitHub org     | **quickstart**           |
| Showing your budget in the status line (optional, opt-in)                   | **quickstart**, step 6   |
| Whether your machine is set up right (Git, `gh`, the org, flyctl, Chrome)   | **doctor**               |
| What's due / what to work on this week                                      | **deadline-radar**       |
| Cloning this week's prototype repo, carrying your CLAUDE.md forward         | **new-week**             |
| Whether your work is ready to submit before a deadline                      | **submission-preflight** |
| Making your repo public and getting it deployed at the cutoff               | **ship**                 |

A natural first-week path is **quickstart** → **doctor**; a natural crit-week
path is **deadline-radar** → **new-week** → **submission-preflight** → **ship**.

All course facts come from the live site
(`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio`) and the
course proxy, so answers stay current. If nothing here fits and it's a
course-admin question, fall back to **course-info**; if it's a
personal/enrolment matter, the answer is a human — comp4020@anu.edu.au.
