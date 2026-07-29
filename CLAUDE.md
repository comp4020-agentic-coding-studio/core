# COMP4020 skills marketplace

Two plugins in one marketplace repo: `comp4020` (the student skills) and
`comp4020-statusline` (the opt-in budget status line). What each skill does, and
the conventions that hold them together — one owner per mechanic, the site as
ground truth, dependency-light scripts — live in README.md under "Working on
this repo". Don't restate them here.

## Cutting a release

Students float on `main` and pick a release up with
`claude plugin update <plugin>@comp4020` (doctor's `plugin-*` rows nudge them
when they're behind), so a release is a version bump plus a tag.

1. Land the content commits bare, with no version change. A bump in the same
   commit as the work hides the release in the log.
2. Bump `version` in `<plugin>/.claude-plugin/plugin.json` as its own commit,
   subject `plugin: 0.11.0 — what changed`. Both plugins moving together share
   one commit: `plugin: 0.10.0 / statusline 0.3.2 — what changed`.
3. Push, and let CI go green first: the tag should name a commit that passed
   `python3 .github/validate.py` and the script tests.
4. `claude plugin tag <plugin> --push` — it writes an annotated
   `{name}--v{version}` tag, refuses to run on a dirty tree, and checks
   plugin.json against the marketplace entry before writing anything.

Pre-1.0 the bump is a judgement call: patch for corrected facts and
documentation, minor for a renamed, added or removed skill, because those change
what a student types.

The tag command reads the version from `plugin.json` at HEAD, so it can only tag
the current commit. A bump that was pushed earlier needs the escape hatch:
`git tag -a <name>--v<version> <sha>`.

Tags are documentation, not machinery — an install records a `gitCommitSha`
and the plugin.json version, never a tag. They exist so a bug reported against
whatever version a student happens to be running is checkoutable, which matters
most early in the semester when the skills churn.
