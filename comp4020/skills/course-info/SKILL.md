---
name: course-info
description:
  Answers questions about COMP4020/COMP8020 Agentic Coding Studio (ANU) course
  admin and content — assignment due dates and weights, marking, policies,
  weekly schedule, crits, lectures, and teaching staff — by querying the live
  course website. Use whenever the user asks about COMP4020 logistics,
  deadlines, assessment, or "the course".
---

# COMP4020 course info

Answer course questions by fetching from the live course website. This skill
carries **routing knowledge only** — which endpoint answers which kind of
question. All course facts (dates, weights, policies, schedules) live on the
site, so always fetch fresh rather than answering from memory or from earlier
turns in a long conversation.

Base URL:

```
https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio
```

## Endpoints

| Endpoint                        | What it returns                                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/index.json`               | Every content node: `{id, type, title, description, tags, related, meta}`. `meta` carries the structured facts (`week`, `due`, `weight`, `draft`) — most factual questions are answerable from the index alone. Start here. |
| `/api/<collection>/<slug>.json` | One node in full: the fields above plus `links` and `body` (complete markdown of the page).                                                                                                                                 |
| `/llms.txt`                     | Annotated index of every page on the site (including pages not in the API, e.g. people). Draft pages are marked `(draft)`.                                                                                                  |
| `/llms-full.txt`                | Full text of every page inline (~100 kB). The fallback when you can't route a question to a specific node. Draft pages carry a `_Draft: …_` notice line.                                                                    |

Node collections in the API: `topics` (concepts, policies, how-to guides),
`assessments`, `crits`, `lectures`. The **people** collection (convenor, TAs,
guest lecturers) is _not_ in the API — people pages are plain HTML, not
JSON/markdown (see the people routing rule below).

Node ids are refs that map directly to page URLs: `assessments/assignment-1` ↔
`/assessments/assignment-1/` ↔ `/api/assessments/assignment-1.json`. A node's
`related` list includes connections declared from either end, so "what relates
to X" is answerable from X's entry alone.

One URL that looks like a node but isn't: the hall of fame at
`/crits/hall-of-fame/` is a listing page, so `/api/crits/hall-of-fame.json` does
not exist — read the HTML page instead.

## Routing

- **Due dates, weights, weeks** — fetch `/api/index.json` and read the node's
  `meta`: `{week, due, weight, draft}` for assessments, `{week, draft}` for
  crits. Always match by title in the index — never construct a slug by
  guessing, since an assignment's colloquial name ("assignment 3") may appear
  only parenthetically in the title of a differently-slugged node. Crit slug
  number ≠ week number (crits run weeks 2–11, so `01-…` is week 2) — trust
  `meta.week`, not the slug. `due` is an ISO date; the page `body` (per-node
  JSON) states the precise time-of-day and timezone rules, so fetch and quote
  those rather than assuming.
- **Policies and course admin** (extensions, academic integrity, marking,
  enrolment, conduct) and **how-to guides** (submitting work, tool setup) —
  topics nodes tagged `admin` in the index. Fetch the matching node's JSON and
  answer from its `body`.
- **What a lecture or week covers** — `lectures` nodes; their `related` edges
  list the topics each deck covers.
- **Who teaches the course / contact details** — fetch the `/people/` listing
  page (HTML): its cards carry each person's role (convenor, TA, guest), which
  `/llms.txt` does not. Then fetch the relevant `/people/<slug>/` page for
  contact details. These are HTML pages to read through, not clean
  JSON/markdown.
- **Anything you can't route** — `/llms-full.txt` and search the text.

## Answering rules

- Cite the human-facing page URL (base URL + `/<node-id>/`) in your answer so
  the user can verify.
- `meta.draft: true` means the page is placeholder or not-yet-finalised content
  — say so when answering from it ("the site currently lists X, but the page is
  marked draft").
- If an endpoint 404s or a fact isn't on the site, say the site doesn't answer
  it and point the user to the course convenor — don't guess or fill in from
  general knowledge.
