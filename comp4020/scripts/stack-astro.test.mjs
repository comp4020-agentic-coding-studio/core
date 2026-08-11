import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "stack-astro.mjs");

const TEMPLATE_PACKAGE = {
  name: "comp4020-static-prototype",
  private: true,
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    typecheck: "tsc --noEmit",
    check: "pnpm typecheck && pnpm build && vitest run",
  },
  devDependencies: {
    typescript: "^6.0.3",
    vite: "^8.1.5",
    vitest: "^4.1.10",
  },
};

const PRISTINE_INDEX = `<!doctype html>
<html lang="en-AU">
  <head>
    <title>COMP4020 prototype</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <p data-testid="intro">Replace this with your prototype.</p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
`;

const LINKINATOR_STEP = `      - name: Check internal links
        # Internal links only --- a real org's rate limiter shouldn't redden a build.
        run: pnpm dlx linkinator ./dist --silent --skip "^https?://(?!localhost|127)"
`;

// The shape fleets provisioned before the links sensor was scoped carry.
const LEGACY_LINKINATOR_STEP = `      - name: Check internal links
        run: pnpm dlx linkinator ./dist --silent
`;

function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stack-astro-"));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: dir, encoding: "utf8" });
  git("init -q");
  git("config user.email test@test.invalid");
  git("config user.name test");
  git("remote add origin https://github.com/fake-org/fake-repo.git");
  git("add -A");
  git("commit -qm fixture");
  return dir;
}

function convert(dir) {
  return spawnSync("node", [SCRIPT, "--skip-install"], { cwd: dir, encoding: "utf8" });
}

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

function baseFixture(extra = {}) {
  return {
    "package.json": `${JSON.stringify(TEMPLATE_PACKAGE, null, 2)}\n`,
    "vite.config.ts": "export default {};\n",
    "tsconfig.json": '{ "compilerOptions": {} }\n',
    ".gitignore": "node_modules\ndist\n",
    ".github/workflows/checks.yml": LINKINATOR_STEP,
    "spec/invariants.test.ts": "// shipped spec — must never change\n",
    "PROCESS.md": "# process log\n",
    "reflections/README.md": "# reflections\n",
    "scripts/check-evidence.ts": "// shipped evidence check\n",
    ...extra,
  };
}

test("pristine template gets the starter trio and derived config", () => {
  const dir = makeRepo(
    baseFixture({
      "index.html": PRISTINE_INDEX,
      "styles.css": "body { color: red; }\n",
      "main.ts": "console.log('hi');\n",
    }),
  );
  const r = convert(dir);
  assert.equal(r.status, 0, r.stderr);

  assert.ok(!fs.existsSync(path.join(dir, "index.html")));
  assert.ok(!fs.existsSync(path.join(dir, "vite.config.ts")));
  const index = read(dir, "src/pages/index.astro");
  assert.match(index, /import Layout from "\.\.\/layouts\/Layout\.astro"/);
  assert.match(index, /data-testid="intro"/);
  assert.match(index, /<script src="\.\.\/scripts\/main\.ts"><\/script>/);
  assert.match(read(dir, "src/layouts/Layout.astro"), /import "\.\.\/styles\/global\.css"/);
  assert.equal(read(dir, "src/styles/global.css"), "body { color: red; }\n");
  assert.equal(read(dir, "src/scripts/main.ts"), "console.log('hi');\n");

  const config = read(dir, "astro.config.ts");
  assert.match(config, /site: "https:\/\/fake-org\.github\.io"/);
  assert.match(config, /base: "\/fake-repo"/);
  assert.match(config, /format: "file"/);
  assert.match(config, /compressHTML: true/);

  const pkg = JSON.parse(read(dir, "package.json"));
  assert.equal(pkg.scripts.build, "astro build");
  assert.equal(pkg.scripts.typecheck, "astro check");
  assert.equal(pkg.devDependencies.vite, undefined);
  assert.ok(pkg.devDependencies.astro);
  assert.ok(pkg.devDependencies["@astrojs/check"]);
  assert.equal(pkg.devDependencies.typescript, "^6.0.3");

  assert.match(read(dir, "tsconfig.json"), /astro\/tsconfigs\/strict/);
  assert.ok(read(dir, ".gitignore").split("\n").includes(".astro/"));
  const workflow = read(dir, ".github/workflows/checks.yml");
  assert.match(workflow, /pnpm preview --port 4989/);
  // the internal-only scope survives the rewrite, and nothing of the old
  // command is left dangling after it
  assert.match(workflow, /linkinator "\$base" --recurse --silent --skip "\^https\?:\/\/\(\?!localhost\|127\)"/);
  assert.ok(!workflow.includes("linkinator ./dist"));
});

test("a pre-scoping workflow still converts, and gains the skip", () => {
  const dir = makeRepo(
    baseFixture({
      ".github/workflows/checks.yml": LEGACY_LINKINATOR_STEP,
      "index.html": PRISTINE_INDEX,
      "styles.css": "body { color: red; }\n",
      "main.ts": "console.log('hi');\n",
    }),
  );
  const r = convert(dir);
  assert.equal(r.status, 0, r.stderr);

  const workflow = read(dir, ".github/workflows/checks.yml");
  assert.match(workflow, /pnpm preview --port 4989/);
  assert.match(workflow, /--skip "\^https\?:\/\/\(\?!localhost\|127\)"/);
  assert.ok(!workflow.includes("linkinator ./dist"));
});

test("an unrecognised links step is flagged, not silently mangled", () => {
  const step = '      - name: Check internal links\n        run: npx linkinator ./build\n';
  const dir = makeRepo(
    baseFixture({
      ".github/workflows/checks.yml": step,
      "index.html": PRISTINE_INDEX,
      "styles.css": "body { color: red; }\n",
      "main.ts": "console.log('hi');\n",
    }),
  );
  const r = convert(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, ".github/workflows/checks.yml"), step);
  assert.match(r.stdout, /linkinator step not in the expected shape/);
});

const ABOUT_PAGE = `<!doctype html>
<html lang="en-AU">
  <head>
    <title>About</title>
    <link rel="stylesheet" href="./css/site.css" />
  </head>
  <body>
    <main>
      <h1>About &mdash; hand-written</h1>
      <img src="./img/photo.jpg" alt="a photo" />
      <img src="/logo.png" alt="root absolute, must be flagged not touched" />
      <a href="./index.html">home</a>
    </main>
    <script type="module" src="./code/app.ts"></script>
  </body>
</html>
`;

function multiPageRepo() {
  return makeRepo(
    baseFixture({
      "index.html": '<!doctype html>\n<html><body><a href="./about.html">about</a></body></html>\n',
      "about.html": ABOUT_PAGE,
      "css/site.css": "main { background: url(./bg/tile.png); }\n",
      "css/bg/tile.png": "png-bytes",
      "code/app.ts": "export {};\n",
      "img/photo.jpg": "jpg-bytes",
    }),
  );
}

test("multi-page conversion rewrites only the two tag shapes and homes assets", () => {
  const dir = multiPageRepo();
  const r = convert(dir);
  assert.equal(r.status, 0, r.stderr);

  const about = read(dir, "src/pages/about.astro");
  // frontmatter import replaces the stylesheet link
  assert.match(about, /^---\nimport "\.\.\/styles\/css\/site\.css";\n---\n/);
  assert.ok(!about.includes("<link"));
  // module script rewritten to the moved file, type attribute dropped
  assert.ok(about.includes('<script src="../scripts/code/app.ts"></script>'));
  // everything else byte-identical
  assert.ok(about.includes("<h1>About &mdash; hand-written</h1>"));
  assert.ok(about.includes('<img src="./img/photo.jpg" alt="a photo" />'));
  assert.ok(about.includes('<a href="./index.html">home</a>'));

  // asset homes: linked css with its url() companion, linked ts, plain image
  assert.equal(read(dir, "src/styles/css/site.css"), "main { background: url(./bg/tile.png); }\n");
  assert.equal(read(dir, "src/styles/css/bg/tile.png"), "png-bytes");
  assert.equal(read(dir, "src/scripts/code/app.ts"), "export {};\n");
  assert.equal(read(dir, "public/img/photo.jpg"), "jpg-bytes");

  // root-absolute ref flagged, not touched
  assert.match(r.stdout, /about\.html: root-absolute src="\/logo\.png"/);
  assert.ok(about.includes('<img src="/logo.png"'));
});

test("second run detects the converted repo and changes nothing", () => {
  const dir = multiPageRepo();
  assert.equal(convert(dir).status, 0);
  execSync("git add -A && git commit -qm converted", { cwd: dir });
  const r = convert(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /already converted/);
  assert.equal(execSync("git status --porcelain", { cwd: dir, encoding: "utf8" }), "");
});

test("refuses a dirty tree", () => {
  const dir = multiPageRepo();
  fs.appendFileSync(path.join(dir, "index.html"), "<!-- wip -->\n");
  const r = convert(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /dirty/);
});

test("never touches the shipped spec, process log, or reflections", () => {
  const dir = multiPageRepo();
  assert.equal(convert(dir).status, 0);
  assert.equal(read(dir, "spec/invariants.test.ts"), "// shipped spec — must never change\n");
  assert.equal(read(dir, "PROCESS.md"), "# process log\n");
  assert.equal(read(dir, "reflections/README.md"), "# reflections\n");
  assert.equal(read(dir, "scripts/check-evidence.ts"), "// shipped evidence check\n");
});
