import assert from "node:assert/strict";
import test from "node:test";

import { findSecretKinds, safeLabel } from "./secret-scan.mjs";

test("detects course, vendor, and private-key credential shapes", () => {
  const samples = [
    ["sk-abcdefghijklmnopqrstuvwxyz", "COMP4020 course key"],
    ["sk-ant-abcdefghijklmnopqrstuvwxyz", "Anthropic API key"],
    ["ghp_abcdefghijklmnopqrstuvwxyz1234", "GitHub token"],
    ["github_pat_abcdefghijklmnopqrstuvwxyz", "GitHub token"],
    ["FlyV1 abcdefghijklmnopqrstuvwxyz", "Fly.io token"],
    ["AKIAABCDEFGHIJKLMNOP", "AWS access key"],
    ["-----BEGIN OPENSSH PRIVATE KEY-----", "private key"],
    ['ANTHROPIC_AUTH_TOKEN="abcdefghijklmnopqrstuvwxyz"', "credential assignment"],
  ];

  for (const [sample, expected] of samples) {
    assert.ok(findSecretKinds(sample).includes(expected), expected);
  }
});

test("does not flag the placeholders used in course documentation", () => {
  const placeholders = [
    "sk-...(your key)",
    "sk-…(their key)",
    "ANTHROPIC_AUTH_TOKEN",
    "password: replace-me",
    "token = <token>",
  ];

  for (const placeholder of placeholders) {
    assert.deepEqual(findSecretKinds(placeholder), [], placeholder);
  }
});

test("redacts secret values and terminal control characters from labels", () => {
  const label = safeLabel("file-sk-abcdefghijklmnopqrstuvwxyz\nname");
  assert.equal(label, "file-[REDACTED]?name");
  assert.ok(!label.includes("abcdefghijklmnopqrstuvwxyz"));
});
