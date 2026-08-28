#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_OUTPUT = 128 * 1024 * 1024;

const PATTERNS = [
  {
    // Real keys are random base64url and always carry an uppercase letter;
    // requiring one (case-sensitively) spares lowercase kebab-case identifiers
    // like CSS's .sk-loading-placeholder-wrapper. The pre-commit hook and
    // doctor apply the same rule.
    name: "COMP4020 course key",
    source: String.raw`\bsk-(?!ant-)(?=[A-Za-z0-9_-]*[A-Z])[A-Za-z0-9_-]{20,}\b`,
    flags: "",
  },
  {
    name: "Anthropic API key",
    source: String.raw`\bsk-ant-[A-Za-z0-9_-]{20,}\b`,
  },
  {
    name: "GitHub token",
    source: String.raw`\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b`,
  },
  {
    name: "Fly.io token",
    source: String.raw`\bFlyV1\s+[A-Za-z0-9_,.-]{20,}`,
  },
  {
    name: "AWS access key",
    source: String.raw`\b(?:AKIA|ASIA)[A-Z0-9]{16}\b`,
  },
  {
    name: "private key",
    source: String.raw`-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----`,
  },
  {
    name: "credential assignment",
    source: String.raw`(?:ANTHROPIC_(?:AUTH_TOKEN|API_KEY)|OPENAI_API_KEY|GITHUB_TOKEN|FLY_API_TOKEN|AWS_SECRET_ACCESS_KEY|api[_-]?key|secret|token|password)\s*["']?\s*[:=]\s*["']?[A-Za-z0-9_./+=,-]{16,}`,
  },
];

export function findSecretKinds(text) {
  return PATTERNS.filter(({ source, flags = "i" }) => new RegExp(source, flags).test(text)).map(
    ({ name }) => name,
  );
}

export function safeLabel(text) {
  let label = String(text).replaceAll(/[\u0000-\u001f\u007f]/g, "?");
  for (const { source } of PATTERNS) {
    label = label.replaceAll(new RegExp(source, "gi"), "[REDACTED]");
  }
  return label.length > 200 ? `${label.slice(0, 197)}...` : label;
}

class ScanError extends Error {}

function command(commandName, args, cwd, allowedStatuses = [0]) {
  const result = spawnSync(commandName, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || !allowedStatuses.includes(result.status)) {
    throw new ScanError(
      `${commandName} could not complete safely (exit ${result.status ?? "unknown"})`,
    );
  }
  return result;
}

function scanText(findings, text, surface) {
  const kinds = findSecretKinds(text);
  if (kinds.length > 0) {
    findings.push({ surface, kinds });
  }
}

function scanWorktree(findings, root) {
  const listed = command(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    root,
  ).stdout;

  for (const relativePath of listed.split("\0").filter(Boolean)) {
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) continue;

    let content;
    try {
      const stat = lstatSync(absolutePath);
      if (stat.isDirectory()) continue;
      content = stat.isSymbolicLink()
        ? readlinkSync(absolutePath, "utf8")
        : readFileSync(absolutePath).toString("utf8");
    } catch {
      throw new ScanError(
        `could not read a publishable worktree file (${safeLabel(relativePath)})`,
      );
    }
    scanText(findings, content, `worktree: ${safeLabel(relativePath)}`);
  }

  const localSettings = join(root, ".claude", "settings.local.json");
  if (existsSync(localSettings)) {
    const ignored = command(
      "git",
      ["check-ignore", "--quiet", "--", ".claude/settings.local.json"],
      root,
      [0, 1],
    );
    if (ignored.status !== 0) {
      findings.push({
        surface: "worktree: .claude/settings.local.json is not ignored",
        kinds: ["unprotected repo-local settings"],
      });
    }
  }
}

function scanHistory(findings, root) {
  const history = command(
    "git",
    ["log", "--all", "--full-history", "--patch", "--no-ext-diff", "--text", "--format=fuller"],
    root,
  ).stdout;
  scanText(findings, history, "reachable Git history");
}

function main() {
  const root = command("git", ["rev-parse", "--show-toplevel"], process.cwd()).stdout.trim();
  if (!root) throw new ScanError("not inside a Git repository");

  const remotes = command("git", ["remote"], root).stdout.trim();
  if (!remotes) throw new ScanError("repository has no remote to fetch");

  process.stdout.write("secret-scan: fetching remote refs and tags\n");
  command("git", ["fetch", "--all", "--tags"], root);

  const findings = [];
  process.stdout.write("secret-scan: scanning publishable worktree files\n");
  scanWorktree(findings, root);
  process.stdout.write("secret-scan: scanning all reachable Git history\n");
  scanHistory(findings, root);

  if (findings.length > 0) {
    process.stderr.write(
      `secret-scan: STOP — ${findings.length} publishable surface(s) need review\n`,
    );
    for (const finding of findings) {
      process.stderr.write(`- ${finding.surface}: ${finding.kinds.join(", ")} (value withheld)\n`);
    }
    process.exitCode = 2;
    return;
  }

  process.stdout.write("secret-scan: clean — worktree and reachable history scanned\n");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const message = error instanceof ScanError ? error.message : "unexpected scanner failure";
    process.stderr.write(`secret-scan: STOP — scan incomplete: ${safeLabel(message)}\n`);
    process.exitCode = 1;
  }
}
