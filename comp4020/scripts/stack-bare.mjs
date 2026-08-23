#!/usr/bin/env node

// Strips a template-static-lineage repo to bare hand-written HTML/CSS — the
// stack skill's other arm. Handles the template's Vite state only; converting
// an Astro repo back to bare is rare enough to stay agent-assisted. Replaces
// the Vite build with two stdlib scripts written into the repo (a dist/ copy
// and a static file server), so `pnpm check` and the Pages deploy keep
// working unchanged. Relative URLs need no base handling, so the linkinator
// step stays as shipped.

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const skipInstall = process.argv.includes("--skip-install");
const report = { removed: [], rewritten: [], flagged: [] };

function die(code, msg) {
  console.error(`stack-bare: ${msg}`);
  process.exit(code);
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

function verify() {
  if (skipInstall) return true;
  console.log("\n=== verify: pnpm check ===");
  return spawnSync("pnpm", ["check"], { stdio: "inherit" }).status === 0;
}

// --- preconditions -----------------------------------------------------------

if (!fs.existsSync("package.json")) die(2, "no package.json in the current directory");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

if (pkg.dependencies?.astro || pkg.devDependencies?.astro)
  die(2, "this repo uses Astro — going from Astro back to bare is a manual job; ask your agent to unwind it");

if (!pkg.devDependencies?.vite && fs.existsSync("scripts/build-static.mjs")) {
  console.log("already bare — re-running the verify step only");
  process.exit(verify() ? 0 : 1);
}

if (sh("git status --porcelain") !== "")
  die(2, "working tree is dirty — commit your work first, so the change lands as one reviewable diff");

// --- helper scripts written into the repo ------------------------------------

const BUILD_STATIC = `#!/usr/bin/env node

// Bare-stack build: copy the site into dist/ as-is. Written by the course
// stack skill. Hand-written pages use relative URLs, so no base-path handling
// is needed for GitHub Pages.

import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", "dist", "spec", "scripts", "reflections"]);
const COPY_EXTS = new Set([
  ".html", ".css", ".js", ".mjs",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp",
  ".mp4", ".webm", ".mov", ".mp3", ".ogg", ".wav", ".flac",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf",
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) return [];
    const p = dir === "." ? entry.name : path.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

// public/ is the static directory Vite and Astro both flatten into the site
// root, so public/card.png is served at /card.png. Same here: a link written
// ./card.png has to keep working after the build.
const PUBLIC = "public" + path.sep;
const destOf = (file) =>
  path.join("dist", file.startsWith(PUBLIC) ? file.slice(PUBLIC.length) : file);

fs.rmSync("dist", { recursive: true, force: true });
let copied = 0;
for (const file of walk(".")) {
  if (!COPY_EXTS.has(path.extname(file).toLowerCase())) continue;
  const dest = destOf(file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  copied += 1;
}
console.log(\`build-static: copied \${copied} files to dist/\`);
`;

const SERVE = `#!/usr/bin/env node

// Bare-stack dev server: serve a directory of hand-written pages. Written by
// the course stack skill. Usage: node scripts/serve.mjs [dir] (default ".").

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = path.normalize(path.join(root, url));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory())
    file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" }).end("404 not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(\`serving \${root} on http://localhost:\${server.address().port}/\`);
});
`;

fs.writeFileSync("scripts/build-static.mjs", BUILD_STATIC);
fs.writeFileSync("scripts/serve.mjs", SERVE);
report.rewritten.push("scripts/build-static.mjs and scripts/serve.mjs written");

// --- package.json surgery ----------------------------------------------------

pkg.scripts.dev = "node scripts/serve.mjs .";
pkg.scripts.build = "node scripts/build-static.mjs";
pkg.scripts.preview = "node scripts/serve.mjs dist";
delete pkg.devDependencies.vite;
report.removed.push("vite devDependency");
if (fs.existsSync("vite.config.ts")) {
  fs.rmSync("vite.config.ts");
  report.removed.push("vite.config.ts");
}

// --- TypeScript: bare has no compile step -------------------------------------

const pristineIndex =
  fs.existsSync("index.html") &&
  fs.readFileSync("index.html", "utf8").includes("Replace this with your prototype");

if (pristineIndex && fs.existsSync("main.ts")) {
  // The template's own main.ts comment invites deleting it when the week
  // rules out JavaScript; bare does exactly that.
  fs.rmSync("main.ts");
  report.removed.push("main.ts");
  const index = fs.readFileSync("index.html", "utf8");
  fs.writeFileSync(
    "index.html",
    index.replace(/[ \t]*<script type="module" src="\.\/main\.ts"><\/script>\n?/, ""),
  );
  report.rewritten.push("index.html: starter script tag removed");
}

const SKIP = new Set(["node_modules", "dist", "spec", "scripts", "reflections", "src", "public"]);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) return [];
    const p = dir === "." ? entry.name : path.posix.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}
const looseTs = walk(".").filter((f) => f.endsWith(".ts"));
if (looseTs.length > 0) {
  for (const f of looseTs)
    report.flagged.push(`${f}: TypeScript has no compile step in the bare stack — it would ship uncompiled and 404; convert it to .js or remove it`);
} else {
  if (fs.existsSync("tsconfig.json")) {
    fs.rmSync("tsconfig.json");
    report.removed.push("tsconfig.json");
  }
  delete pkg.scripts.typecheck;
  pkg.scripts.check = pkg.scripts.check.replace(/pnpm typecheck && /, "");
  report.rewritten.push("package.json: typecheck dropped from the check chain");
}

fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

// --- install, stage, verify --------------------------------------------------

if (!skipInstall) run("pnpm", ["install", "--no-frozen-lockfile"]);
run("git", ["add", "-A"]);

console.log("\n=== stack-bare report ===");
for (const [kind, lines] of Object.entries(report)) {
  console.log(`\n${kind} (${lines.length}):`);
  for (const line of lines) console.log(`  ${line}`);
}

if (verify()) {
  console.log("\nbare stack ready — review the staged diff and commit it");
} else {
  die(1, "pnpm check failed — everything is staged; fix the reported errors, then re-run pnpm check");
}
