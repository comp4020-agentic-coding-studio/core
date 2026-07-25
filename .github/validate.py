#!/usr/bin/env python3
"""Validate the course marketplace: manifests parse, skills and scripts line up.

Runs in CI on every push and PR, and locally via `python3 .github/validate.py`.
Standard library only — no install step, so it also runs on a bare laptop.

Checks structure and internal consistency only. Whether a skill reads well is a
human's call.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME_RE = re.compile(r"^[a-z][a-z0-9-]*$")
FRONTMATTER_KEY_RE = re.compile(r"^([a-z][a-z0-9-]*):\s*(.*)$")
PLUGIN_ROOT_REF_RE = re.compile(
    r"\$(?:\{)?CLAUDE_PLUGIN_ROOT(?:\})?/([A-Za-z0-9_./-]+)"
)
REFERENCE_REF_RE = re.compile(r"`(references/[A-Za-z0-9_.-]+\.md)`")

errors: list[str] = []


def error(where: Path | str, msg: str) -> None:
    rel = where.relative_to(ROOT) if isinstance(where, Path) else where
    errors.append(f"{rel}: {msg}")


def load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        error(path, "missing")
    except json.JSONDecodeError as exc:
        error(path, f"invalid JSON: {exc}")
    return None


def parse_frontmatter(text: str) -> dict[str, str] | None:
    """Pull `key: value` pairs out of a leading `---` block. Folded values join."""
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end == -1:
        return None

    fields: dict[str, str] = {}
    key = None
    for line in text[4:end].splitlines():
        if not line.strip():
            continue
        if match := FRONTMATTER_KEY_RE.match(line):
            key = match.group(1)
            fields[key] = match.group(2).strip()
        elif key and line.startswith((" ", "\t")):
            fields[key] = f"{fields[key]} {line.strip()}".strip()
    return fields


def check_skill(skill_dir: Path, plugin_dir: Path) -> None:
    md = skill_dir / "SKILL.md"
    if not md.is_file():
        error(skill_dir, "no SKILL.md")
        return

    if not NAME_RE.match(skill_dir.name):
        error(md, f"directory name '{skill_dir.name}' must be lowercase-hyphenated")

    body = md.read_text()
    fields = parse_frontmatter(body)
    if fields is None:
        error(md, "no YAML frontmatter (must open with a --- block)")
        return

    name = fields.get("name", "")
    if not name:
        error(md, "frontmatter is missing `name:`")
    elif name != skill_dir.name:
        error(md, f"name '{name}' does not match directory '{skill_dir.name}'")

    description = fields.get("description", "")
    if not description:
        error(md, "frontmatter is missing `description:`")
    elif len(description) < 40:
        error(md, "description is too short — say when the skill should be used")

    # Every $CLAUDE_PLUGIN_ROOT/... path a skill tells the model to run must exist.
    for ref in PLUGIN_ROOT_REF_RE.findall(body):
        target = plugin_dir / ref
        if not target.exists():
            error(md, f"references $CLAUDE_PLUGIN_ROOT/{ref}, which does not exist")
        elif target.suffix == ".sh" and not target.stat().st_mode & 0o111:
            error(target, "referenced as a command but is not executable")

    # Same for progressive-disclosure reference files.
    for ref in REFERENCE_REF_RE.findall(body):
        if not (skill_dir / ref).exists():
            error(md, f"references `{ref}`, which does not exist")


def check_scripts(plugin_dir: Path) -> None:
    scripts = sorted((plugin_dir / "scripts").glob("*.sh"))
    for script in scripts:
        if not script.stat().st_mode & 0o111:
            error(script, "not executable")
        if subprocess.run(["bash", "-n", script], capture_output=True).returncode:
            error(script, "bash syntax error")
    if scripts and (shellcheck := which("shellcheck")):
        result = subprocess.run(
            [shellcheck, "--severity=warning", *map(str, scripts)],
            capture_output=True,
            text=True,
        )
        if result.returncode:
            error("scripts", f"shellcheck:\n{result.stdout.strip()}")


def which(cmd: str) -> str | None:
    from shutil import which as _which

    return _which(cmd)


def check_plugin(plugin_dir: Path) -> int:
    manifest = load_json(plugin_dir / ".claude-plugin" / "plugin.json")
    if manifest and manifest.get("name") != plugin_dir.name:
        error(
            plugin_dir, f"plugin.json name does not match directory '{plugin_dir.name}'"
        )

    check_scripts(plugin_dir)

    skills_dir = plugin_dir / "skills"
    if not skills_dir.is_dir():
        return 0
    skills = sorted(d for d in skills_dir.iterdir() if d.is_dir())
    for skill_dir in skills:
        check_skill(skill_dir, plugin_dir)
    return len(skills)


def main() -> int:
    market_path = ROOT / ".claude-plugin" / "marketplace.json"
    market = load_json(market_path)
    if market is None:
        print("cannot continue without a marketplace manifest", file=sys.stderr)
        return 1

    total = 0
    for entry in market.get("plugins", []):
        plugin_dir = (ROOT / entry["source"]).resolve()
        if not plugin_dir.is_dir():
            error(market_path, f"plugin source does not exist: {entry['source']}")
            continue
        total += check_plugin(plugin_dir)

    print(f"checked {len(market.get('plugins', []))} plugin(s), {total} skill(s)")

    if errors:
        print(f"\n{len(errors)} problem(s):\n", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1

    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
