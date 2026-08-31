import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugin-version.sh");
const run = promisify(execFile);

// A stand-in for ~/.claude/plugins: the registry records what is installed and
// the marketplace checkout records what is published, which is exactly the two
// numbers the script compares. --no-network throughout, so nothing here
// depends on a clone with an origin.
async function fakeHome({ installed, published }) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-version-"));
  const plugins = path.join(home, ".claude", "plugins");
  const manifest = path.join(plugins, "marketplaces", "comp4020", "comp4020", ".claude-plugin");
  await fs.mkdir(manifest, { recursive: true });

  // The real registry's shape: each id maps to an array of install records,
  // with "version" on its own line a few lines below the id. The top-level
  // "version": 2 sits above it all, which is why the parser keys on the id
  // first — a fixture that inlined the version would test a format that does
  // not exist.
  const entries = Object.entries(installed)
    .map(
      ([id, version]) =>
        `    "${id}@comp4020": [\n` +
        `      {\n` +
        `        "scope": "user",\n` +
        `        "version": "${version}",\n` +
        `        "installedAt": "2026-08-01T00:00:00.000Z"\n` +
        `      }\n` +
        `    ]`,
    )
    .join(",\n");
  await fs.writeFile(
    path.join(plugins, "installed_plugins.json"),
    `{\n  "version": 2,\n  "plugins": {\n${entries}\n  }\n}\n`,
  );
  if (published !== undefined) {
    await fs.writeFile(
      path.join(manifest, "plugin.json"),
      `{ "name": "comp4020", "version": "${published}" }\n`,
    );
  }
  return home;
}

async function rows(home, ...args) {
  const { stdout } = await run(SCRIPT, ["--no-network", ...args], {
    env: { ...process.env, HOME: home },
  });
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

test("a current install passes", async () => {
  const home = await fakeHome({ installed: { comp4020: "0.14.17" }, published: "0.14.17" });
  const [row] = await rows(home);
  assert.deepEqual(row.slice(0, 2), ["PASS", "plugin-comp4020"]);
});

test("a stale install warns and names the update command", async () => {
  const home = await fakeHome({ installed: { comp4020: "0.13.0" }, published: "0.14.17" });
  const [status, check, detail] = (await rows(home))[0];
  assert.equal(status, "WARN");
  assert.equal(check, "plugin-comp4020");
  assert.match(detail, /0\.13\.0 installed, 0\.14\.17 available/);
  assert.match(detail, /claude plugin update comp4020@comp4020/);
});

// The whole point of the flag: ship and preflight call this on every run, so a
// student whose plugin is current must not be told anything at all.
test("--quiet says nothing when current, and still warns when stale", async () => {
  const current = await fakeHome({ installed: { comp4020: "0.14.17" }, published: "0.14.17" });
  assert.deepEqual(await rows(current, "--quiet"), []);

  const stale = await fakeHome({ installed: { comp4020: "0.13.0" }, published: "0.14.17" });
  const warned = await rows(stale, "--quiet");
  assert.equal(warned.length, 1);
  assert.equal(warned[0][0], "WARN");
});

test("the optional status line is INFO when absent, the course plugin is FAIL", async () => {
  const home = await fakeHome({ installed: {}, published: "0.14.17" });
  const byCheck = Object.fromEntries((await rows(home)).map((r) => [r[1], r]));
  assert.equal(byCheck["plugin-comp4020"][0], "FAIL");
  assert.match(byCheck["plugin-comp4020"][2], /claude plugin install comp4020@comp4020/);
  assert.equal(byCheck["plugin-comp4020-statusline"][0], "INFO");
});

// No marketplace checkout to compare against: report the installed version and
// say the comparison could not be made, rather than claiming it is current.
test("an unknown published version is INFO, not PASS", async () => {
  const home = await fakeHome({ installed: { comp4020: "0.14.17" } });
  const [status, , detail] = (await rows(home))[0];
  assert.equal(status, "INFO");
  assert.match(detail, /could not check for a newer one/);
});

test("an unknown flag is a usage error", async () => {
  await assert.rejects(run(SCRIPT, ["--nope"]), (e) => e.code === 64);
});
