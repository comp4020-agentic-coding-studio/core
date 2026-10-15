import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const groupId = (name, env = {}) =>
  execFileSync("bash", [path.join(HERE, "group-id.sh"), name], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

test("tone-marked names copied off the site fold to the published ids", () => {
  const names = { Shítāo: "shitao", Bādà: "bada", Báishí: "baishi", Dàchī: "dachi", Yúnlín: "yunlin", Liùrú: "liuru" };
  for (const [name, id] of Object.entries(names)) assert.equal(groupId(name), id);
});

test("case, surrounding whitespace and the C locale don't matter", () => {
  assert.equal(groupId("  LIÙRÚ "), "liuru");
  assert.equal(groupId("liùrú", { LC_ALL: "C" }), "liuru");
  assert.equal(groupId("liuru"), "liuru");
  assert.equal(groupId(""), "");
});

// The bug this exists for: a tone-marked COMP4020_GROUP matched no group, so
// every crit fell back to a date-only deadline.
test("next-deadline resolves a tone-marked group to its session", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "group-id-"));
  const json = path.join(dir, "crit-groups.json");
  fs.writeFileSync(
    json,
    JSON.stringify({
      timezone: "Australia/Canberra",
      room: "",
      teachingBreak: { start: "2026-09-07", end: "2026-09-21" },
      weeks: [{ week: 10, monday: "2026-10-12" }],
      groups: [{ agent: "liuru", day: "Wed", session: "Wed 15:30–17:00", cutoff: "Wed 13:30", cutoffTime: "13:30", exceptions: [], tutor: { name: "Bill", slug: "bill" } }],
      deliverables: [],
    }),
  );
  const out = execFileSync("bash", [path.join(HERE, "next-deadline.sh"), "--group", "Liùrú", "--today", "2026-10-12", "--json", json], {
    encoding: "utf8",
  });
  const rows = Object.fromEntries(out.trim().split("\n").map((line) => line.split("\t")));
  assert.equal(rows.status, "ok");
  assert.equal(rows.group, "liuru");
  assert.equal(rows.cutoff, "Wed 13:30");
});
