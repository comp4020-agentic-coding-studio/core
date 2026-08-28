#!/usr/bin/env node

// Converts a template-static-lineage repo to Astro, the course default stack
// from C2. The deterministic floor under the `stack` skill: the skill carries
// the judgement (fixing flagged refs, build errors), this script carries the
// parts that must not vary across 130 student repos — config shape, tag
// rewrites, asset homes, the CI link-check patch. See the skill for the
// contract; run on a clean tree, everything staged, nothing committed.

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Same exclusion set as the template's old vite.config.ts, plus the two
// directories this script writes into. spec/, scripts/ and reflections/ being
// here is what makes them untouchable by every sweep below.
const SKIP = new Set(["node_modules", "dist", "spec", "scripts", "reflections", "src", "public"]);
const ASSET_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".mp4",
  ".webm",
  ".mov",
  ".mp3",
  ".ogg",
  ".wav",
  ".flac",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".pdf",
]);
// typescript stays at the template's ^6: typescript@7 is outside
// @astrojs/check's peer range (^5 || ^6).
const ASTRO_VERSION = "^7.1.6";
const CHECK_VERSION = "^0.9.10";

const skipInstall = process.argv.includes("--skip-install");
const report = { converted: [], moved: [], rewritten: [], flagged: [] };

function die(code, msg) {
  console.error(`stack-astro: ${msg}`);
  process.exit(code);
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

function printReport() {
  console.log("\n=== stack-astro report ===");
  for (const [kind, lines] of Object.entries(report)) {
    console.log(`\n${kind} (${lines.length}):`);
    for (const line of lines) console.log(`  ${line}`);
  }
}

function verify() {
  if (skipInstall) return true;
  console.log("\n=== verify: pnpm check ===");
  return spawnSync("pnpm", ["check"], { stdio: "inherit" }).status === 0;
}

// --- preconditions -----------------------------------------------------------

if (!fs.existsSync("package.json")) die(2, "no package.json in the current directory");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

// Already converted? Check before the dirty-tree gate: a student re-invoking
// the skill mid-week with WIP in the tree gets a verify, not a refusal.
const hasAstro = Boolean(pkg.dependencies?.astro || pkg.devDependencies?.astro);
if (hasAstro && fs.existsSync("src/pages")) {
  console.log("already converted — re-running the verify step only");
  process.exit(verify() ? 0 : 1);
}

if (sh("git status --porcelain") !== "")
  die(
    2,
    "working tree is dirty — commit your work first, so the conversion lands as one reviewable diff",
  );

const remote = sh("git remote get-url origin");
const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
if (!m) die(2, `cannot derive org and repo from the origin remote: ${remote}`);
const [, org, repo] = m;

// --- config files ------------------------------------------------------------

fs.writeFileSync(
  "astro.config.ts",
  `import { defineConfig } from "astro/config";

// Written by the course stack skill; values derived from this repo's origin
// remote. The dev server serves under the base too, so a path bug reproduces
// locally instead of only on the live URL. build.format "preserve" maps each
// page to the same output path it had before the conversion --- about.html
// stays /about.html and notes/index.html stays /notes/index.html --- so
// hand-written relative links and asset paths keep working. Astro's default
// ("directory") would move every root page to /about/, and "file" would
// collapse notes/index.html to /notes.html; either way half the pages get a
// URL one level off from the one their relative links were written against.
// compressHTML true because the default ("jsx") strips the space before
// line-broken inline elements in hand-written prose.
export default defineConfig({
  site: "https://${org}.github.io",
  base: "/${repo}",
  build: { format: "preserve" },
  compressHTML: true,
});
`,
);

fs.writeFileSync(
  "tsconfig.json",
  `${JSON.stringify(
    {
      extends: "astro/tsconfigs/strict",
      include: [".astro/types.d.ts", "**/*"],
      exclude: ["dist"],
    },
    null,
    2,
  )}\n`,
);

const gitignore = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf8") : "";
if (!gitignore.split("\n").includes(".astro/"))
  fs.writeFileSync(".gitignore", `${gitignore.replace(/\n?$/, "\n")}.astro/\n`);

// --- package.json surgery ----------------------------------------------------

pkg.scripts.dev = "astro dev";
pkg.scripts.build = "astro build";
pkg.scripts.preview = "astro preview";
pkg.scripts.typecheck = "astro check";
delete pkg.devDependencies.vite;
pkg.devDependencies.astro = ASTRO_VERSION;
pkg.devDependencies["@astrojs/check"] = CHECK_VERSION;
pkg.devDependencies = Object.fromEntries(
  Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
);
fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

if (fs.existsSync("vite.config.ts")) fs.rmSync("vite.config.ts");

// --- page sweep --------------------------------------------------------------

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) return [];
    const p = dir === "." ? entry.name : path.posix.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

const pages = walk(".").filter((f) => f.endsWith(".html"));
const cssMoves = new Map();
const jsMoves = new Map();

// Strip query/fragment, refuse externals and root-absolute, resolve against
// the referencing file's directory, and require the target to exist in-repo.
function resolveRef(fromDir, ref) {
  const bare = ref.replace(/[?#].*$/, "");
  if (/^(?:[a-z]+:|\/\/|#|$)/i.test(bare) || bare.startsWith("/")) return null;
  const p = path.posix.normalize(path.posix.join(fromDir, bare));
  return !p.startsWith("..") && fs.existsSync(p) ? p : null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The starter's own <head> is lifted into the layout below rather than
// written fresh: whatever the template keeps there --- the description, the
// card meta, the comments explaining them --- arrives without this script
// knowing any of it exists. A copy here would drift the first time the
// template changed, and drift silently.
const starter =
  pages.length === 1 && pages[0] === "index.html" ? fs.readFileSync("index.html", "utf8") : "";
const starterHead = starter.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
const pristine = starterHead !== undefined && starter.includes("Replace this with your prototype");

if (pristine) {
  // Fresh starter instead of a mechanical conversion: a layout from day one,
  // because C2 is multi-page and 130 improvised layout extractions is the
  // alternative. global.css stays a separate file so the styles keep a home
  // any sensor the student adds later can point at.
  fs.mkdirSync("src/pages", { recursive: true });
  fs.mkdirSync("src/layouts", { recursive: true });
  const hasMain = fs.existsSync("main.ts");
  if (fs.existsSync("styles.css")) {
    fs.mkdirSync("src/styles", { recursive: true });
    fs.renameSync("styles.css", "src/styles/global.css");
    report.moved.push("styles.css -> src/styles/global.css");
  }
  if (hasMain) {
    fs.mkdirSync("src/scripts", { recursive: true });
    fs.renameSync("main.ts", "src/scripts/main.ts");
    report.moved.push("main.ts -> src/scripts/main.ts");
  }
  // Both files nest the head the same depth, so the lifted indentation
  // carries over as-is. Four targeted rewrites, bytes elsewhere untouched:
  // the stylesheet link goes (the styles are a frontmatter import here), the
  // title and description become props (a head shared across pages would
  // otherwise give every page one description), and the card path goes
  // root-absolute under the base --- this head now serves every page, so a
  // page-relative card would break on any page below the site root.
  const defaultDescription = starterHead
    .match(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i)?.[0]
    ?.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
  let cardRewritten = false;
  const head = starterHead
    .replace(/[ \t]*<link\b(?=[^>]*rel\s*=\s*["']stylesheet["'])[^>]*>\n?/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>{title}</title>")
    .replace(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i, (tag) =>
      tag.replace(/content\s*=\s*["'][^"']*["']/i, "content={description}"),
    )
    .replace(/<meta\b[^>]*property\s*=\s*["']og:image["'][^>]*>/i, (tag) => {
      const out = tag.replace(
        /(content\s*=\s*["'])(?!(?:[a-z]+:|\/))(?:\.\/)?([^"']+)(["'])/i,
        `$1/${repo}/$2$3`,
      );
      cardRewritten = out !== tag;
      return out;
    })
    .replace(/\s*$/, "\n  ");
  if (defaultDescription !== undefined)
    report.rewritten.push("layout head: description -> prop, starter text as the default");
  if (cardRewritten)
    report.rewritten.push(
      `layout head: og:image -> /${repo}/... (the shared head serves nested pages too)`,
    );
  fs.writeFileSync(
    "src/layouts/Layout.astro",
    `---
${fs.existsSync("src/styles/global.css") ? 'import "../styles/global.css";\n' : ""}
interface Props {
  title: string;${defaultDescription === undefined ? "" : "\n  description?: string;"}
}

const { title${defaultDescription === undefined ? "" : `, description = ${JSON.stringify(defaultDescription)}`} } = Astro.props;
---

<!doctype html>
<html lang="en-AU">
  <head>${head}</head>
  <body>
    <slot />
  </body>
</html>
`,
  );
  fs.writeFileSync(
    "src/pages/index.astro",
    `---
import Layout from "../layouts/Layout.astro";
---

<Layout title="COMP4020 prototype">
  <header>
    <nav aria-label="Primary">
      <a href="./">Home</a>
    </nav>
  </header>
  <main>
    <h1>COMP4020 prototype</h1>
    <p>
      Replace this with your prototype. This week's brief is on the course
      website; <code>spec/README.md</code> explains how the checks in this repo
      relate to it.
    </p>
  </main>
${hasMain ? '  <script src="../scripts/main.ts"></script>\n' : ""}</Layout>
`,
  );
  fs.rmSync("index.html");
  report.converted.push(
    "index.html -> starter trio (src/pages/index.astro, src/layouts/Layout.astro)",
  );
} else {
  // Mechanical conversion: rename each page verbatim to src/pages/*.astro
  // (a full HTML document is valid .astro page content; the rename is what
  // buys full processing). Exactly two tag rewrites, bytes elsewhere
  // untouched.
  for (const page of pages) {
    let content = fs.readFileSync(page, "utf8");
    const pageDir = path.posix.dirname(page);
    const newPage = path.posix.join("src/pages", page.replace(/\.html$/, ".astro"));
    const newPageDir = path.posix.dirname(newPage);
    const imports = [];

    for (const tag of content.match(/<link\b[^>]*>/g) ?? []) {
      if (!/rel\s*=\s*["']stylesheet["']/.test(tag)) continue;
      const href = tag.match(/href\s*=\s*["']([^"']+)["']/)?.[1];
      if (href?.startsWith("/")) continue; // the root-absolute scan flags it
      const target = href && resolveRef(pageDir, href);
      if (!target || !target.endsWith(".css")) {
        report.flagged.push(`${page}: stylesheet link left as-is (unresolved href "${href}")`);
        continue;
      }
      const dest = path.posix.join("src/styles", target);
      cssMoves.set(target, dest);
      imports.push(path.posix.relative(newPageDir, dest));
      content = content.replace(new RegExp(`[ \\t]*${escapeRegExp(tag)}\\n?`), "");
      report.rewritten.push(`${page}: stylesheet link -> frontmatter import of ${target}`);
    }

    content = content.replace(/<script\b([^>]*)>\s*<\/script>/g, (whole, attrs) => {
      if (!/type\s*=\s*["']module["']/.test(attrs)) return whole;
      const src = attrs.match(/src\s*=\s*["']([^"']+)["']/)?.[1];
      if (src?.startsWith("/")) return whole;
      const target = src && resolveRef(pageDir, src);
      if (!target || !/\.(ts|js|mjs)$/.test(target)) {
        report.flagged.push(`${page}: module script left as-is (unresolved src "${src}")`);
        return whole;
      }
      const dest = path.posix.join("src/scripts", target);
      jsMoves.set(target, dest);
      report.rewritten.push(
        `${page}: module script -> ${dest} (Astro compiles TS and adds type="module")`,
      );
      return `<script src="${path.posix.relative(newPageDir, dest)}"></script>`;
    });

    for (const [, attr, val] of content.matchAll(/(href|src)\s*=\s*["'](\/[^/"'][^"']*)["']/g))
      report.flagged.push(
        `${page}: root-absolute ${attr}="${val}" breaks under the base path — make it relative or prefix import.meta.env.BASE_URL`,
      );

    if (imports.length)
      content = `---\n${imports.map((i) => `import "${i}";`).join("\n")}\n---\n${content}`;
    fs.mkdirSync(newPageDir, { recursive: true });
    fs.writeFileSync(newPage, content);
    fs.rmSync(page);
    report.converted.push(`${page} -> ${newPage}`);
  }
}

// --- asset moves -------------------------------------------------------------

function moveFile(from, to) {
  fs.mkdirSync(path.posix.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  report.moved.push(`${from} -> ${to}`);
}

for (const [from, to] of cssMoves) {
  // A moved stylesheet's relative url() refs resolve against its new home, so
  // each referenced file moves with it, same path relative to the stylesheet.
  const css = fs.readFileSync(from, "utf8");
  for (const [, ref] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(ref)) continue;
    if (ref.startsWith("/")) {
      report.flagged.push(`${from}: root-absolute url(${ref}) breaks under the base path`);
      continue;
    }
    const companion = resolveRef(path.posix.dirname(from), ref);
    if (!companion) {
      report.flagged.push(`${from}: unresolved url(${ref})`);
      continue;
    }
    moveFile(
      companion,
      path.posix.normalize(
        path.posix.join(
          path.posix.dirname(to),
          path.posix.relative(path.posix.dirname(from), companion),
        ),
      ),
    );
  }
  moveFile(from, to);
}
for (const [from, to] of jsMoves) moveFile(from, to);

// Everything else static goes to public/ preserving relative structure: with
// build.format "preserve", page-relative references then resolve unchanged.
for (const f of walk(".")) {
  if (ASSET_EXTS.has(path.posix.extname(f).toLowerCase()))
    moveFile(f, path.posix.join("public", f));
}

// --- CI link-check patch -----------------------------------------------------

// Built asset URLs carry the base prefix, so linkinator can't serve dist/ at
// the server root any more. Serving a staged directory doesn't work either —
// linkinator's globber refuses symlinks and nested paths, and maps files to
// URLs relative to the glob base, not --server-root. astro preview serves
// dist/ under the base with full fidelity, so crawl that.
const workflow = ".github/workflows/checks.yml";
if (fs.existsSync(workflow)) {
  const yml = fs.readFileSync(workflow, "utf8");
  // Two shapes in the wild: fleets provisioned once the links sensor was
  // scoped to internal links carry the --skip, earlier ones don't. Longest
  // first — the bare command is a prefix of the other, so matching it first
  // would leave the skip dangling after the replacement.
  const SKIP = '--skip "^https?://(?!localhost|127)"';
  const old = [
    `run: pnpm dlx linkinator ./dist --silent ${SKIP}`,
    "run: pnpm dlx linkinator ./dist --silent",
  ].find((candidate) => yml.includes(candidate));
  if (old) {
    fs.writeFileSync(
      workflow,
      yml.replace(
        old,
        [
          "run: |",
          "          # serve dist/ under the Pages base path and crawl the URL",
          "          pnpm preview --port 4989 &",
          '          base="http://localhost:4989/${GITHUB_REPOSITORY##*/}/"',
          "          for i in $(seq 1 20); do",
          '            curl -sf -o /dev/null "$base" && break; sleep 1',
          "          done",
          // Same internal-only scope as the pre-Astro command: preview serves
          // on localhost, so the skip leaves the crawl intact while a real
          // org's rate limiter can't redden a build.
          `          pnpm dlx linkinator "$base" --recurse --silent ${SKIP}`,
        ].join("\n"),
      ),
    );
    report.rewritten.push(`${workflow}: linkinator now crawls astro preview under the base path`);
  } else {
    report.flagged.push(
      `${workflow}: linkinator step not in the expected shape — patch it by hand`,
    );
  }
}

// --- install, stage, verify --------------------------------------------------

if (!skipInstall) run("pnpm", ["install", "--no-frozen-lockfile"]);
run("git", ["add", "-A"]);
printReport();

if (verify()) {
  console.log("\nconversion complete — review the staged diff and commit it");
} else {
  die(
    1,
    "pnpm check failed — everything is staged; fix the reported errors, then re-run pnpm check",
  );
}
