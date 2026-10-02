---
name: riff
description:
  Sets up a COMP4020/COMP8020 pod for the riff — the part of the crit session
  where a pod writes the prompt the group's crit agent runs after the session.
  Works out which crit is running, asks which pod number they were dealt, clones
  the pod's riff repo, and helps the pod draft, test and push `prompt.md`. Use
  for /comp4020:riff, "start the riff", "I'm the pod leader", "clone our riff
  repo", "help us write the prompt", or "which repo does my pod work in".
allowed-tools: Bash, Read, Edit, Write, WebFetch, Glob, Grep
model: sonnet
effort: medium
---

# COMP4020 riff

The riff is the last part of the crit session. Each pod has a repo holding the
group's crit agent's final project, live on its own Fly app. The pod doesn't
build anything in it. It writes one file, `prompt.md`, aimed at the **next**
brief. After the session the group's crit agent runs that prompt once,
unattended, and the next crit opens by looking at where each pod's repo ended
up.

So the work is the prompt: what the app should become, what good looks like,
what to leave alone, all said clearly enough that an agent with nobody to ask
can act on it.

This runs in the session, on a clock, with the rest of the pod watching the
screen. Be quick, and don't ask anything the tutor has already said out loud.

## 1. Which crit, and which pod?

```sh
"$CLAUDE_PLUGIN_ROOT/scripts/next-deadline.sh"
```

The riff runs in **today's** crit, so the target is the `deliverable` row whose
`WEEK` matches the `teaching_week` header — not the row marked `next`. Then read
`https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/crit-groups.json`
and find that crit's entry in `deliverables`:

- `riffPrefix` names the repos. It can belong to an earlier crit (the crit 8
  repos carry on through crits 9 and 10), so read it rather than building it
  from the crit number.
- `promptFor` is the slug of the deliverable the prompt aims at. Its brief is
  `https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/crits/<slug>.json`,
  or `.../api/assessments/<slug>.json` when that slug's `kind` is `assessment`.

Two things to settle:

- **the group** — `$COMP4020_GROUP`, and `status ok-no-group` means it's unset:
  ask, and offer **onboard** step 5 afterwards so it's never asked again.
- **the pod number**, 1 to the payload's `riffPods` — dealt on the day, so ask.

The repo is `<riffPrefix>-<group>-<pod>` in the course org, live at
`https://<riffPrefix>-<group>-<pod>.fly.dev/`. Say both back before cloning.

## 2. Clone it and look

```sh
gh repo clone comp4020-agentic-coding-studio/<riffPrefix>-<group>-<pod>
```

If it 404s, check the number and the group with the tutor, and never
`gh repo create`. If `prompt.md` already exists at the root, another pod has
taken this number this week: stop and sort it out in the session.

Then get oriented fast, and in parallel: open the live app, read `CLAUDE.md`
(the block at the top governs this repo), `README.md` (what the agent thinks
good means for this app) and `git log --oneline | head -30`. From crit 9 on the
history includes the last pod's run: `git show prompt-crit<N>:prompt.md` is the
prompt that drove it, for the latest `prompt-crit<N>` tag.

Fetch the target brief from step 1 and read it with the pod.

## 3. Write the prompt

The prompt is the only file the pod changes. Draft it together, with the pod
leader at the keyboard. A good one usually covers:

- **the goal**, in terms of the target brief, and what would make this app's
  answer interesting rather than just compliant
- **what good looks like** — how anyone could tell the run succeeded, ideally
  something checkable
- **what to keep and what to leave alone** — the parts of the app that already
  work, and any pod opinions about the stack or the data
- **pointers** — files, issues, docs or examples in the repo or on the web the
  agent should read first

The agent runs it once, with no follow-up questions, so ambiguity turns into
guesses. Read the draft back as the agent would and cut anything it could take
two ways. Don't write the code into the prompt: the pod's leverage is direction,
and the run is where the work happens.

You can try ideas against the code while drafting (read files, run the app
locally), but leave every file except `prompt.md` untouched, and don't run the
prompt yourself.

## 4. Push before you leave

```sh
git add prompt.md && git commit -m "prompt: pod <pod>" && git push
```

Everyone in the cohort has push access to these repos, so anyone in the pod can
push. A prompt that isn't on `main` when the session ends doesn't get run.

Nothing here is assessed and there's nothing to submit — no reflection entry, no
`PROCESS.md` for it.

## Notes

- Don't touch the agent's own submission repo. It's their marked artefact; the
  riff repo is the copy.
- Take ideas from the riff into your own final project if you want, but not the
  agent's commits.

## Hand off

- "which repo do I work in for my own project?" → **start**
- "what's due this week?" → **radar**
- "make my repo public and deploy it" → **ship**
- "why won't this run on my machine?" → **doctor**
