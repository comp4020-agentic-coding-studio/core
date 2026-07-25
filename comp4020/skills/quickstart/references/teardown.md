# Removing the course setup

For a student who asks to remove the course setup, or is handing back a machine,
at the end of semester. Read this from step 0 of the quickstart skill.

A leftover global config keeps routing every session at a proxy that will
eventually stop serving them. The classic symptom is "Claude Code stopped
working after semester".

## Settings

Remove `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL` and
`COMP4020_GROUP` from the `env` block of `~/.claude/settings.json`, leaving the
rest of the file untouched. Then:

- any `.claude/settings.local.json` in course repos (the dual-plan setup)
- the `statusLine` block, but **only** if it points at the course script; if
  they had their own status line before the course, leave it

## Plugins

```sh
claude plugin uninstall comp4020@comp4020
claude plugin uninstall comp4020-statusline@comp4020   # if installed
rm -rf ~/.claude/comp4020
```

If they also installed the student-contributed skills, remove those too:

```sh
claude plugin uninstall contrib@comp4020-contrib
claude plugin marketplace remove comp4020-contrib
```

## What stays

Their repos, their GitHub org membership (the convenor off-boards the org at the
end of semester), and any tools they installed for the course — `gh`, `flyctl`,
`mise`, `jq` are all generally useful and none of them are course-specific.
