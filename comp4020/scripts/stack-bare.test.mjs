import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "stack-bare.mjs");

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
  <body>
    <p>Replace this with your prototype.</p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
`;

function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stack-bare-"));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: dir, encoding: "utf8" });
  git("init -q");
  git("config user.email test@test.invalid");
  git("config user.name test");
  git("add -A");
  git("commit -qm fixture");
  return dir;
}

function strip(dir) {
  return spawnSync("node", [SCRIPT, "--skip-install"], { cwd: dir, encoding: "utf8" });
}

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

function pristineFixture(extra = {}) {
  return {
    "package.json": `${JSON.stringify(TEMPLATE_PACKAGE, null, 2)}\n`,
    "vite.config.ts": "export default {};\n",
    "tsconfig.json": '{ "compilerOptions": {} }\n',
    "index.html": PRISTINE_INDEX,
    "styles.css": "body { color: red; }\n",
    "main.ts": "console.log('hi');\n",
    "spec/invariants.test.ts": "// shipped spec — must never change\n",
    "PROCESS.md": "# process log\n",
    "scripts/check-evidence.ts": "// shipped evidence check\n",
    ...extra,
  };
}

test("pristine template goes bare: vite, main.ts, tsconfig and typecheck all gone", () => {
  const dir = makeRepo(pristineFixture());
  const r = strip(dir);
  assert.equal(r.status, 0, r.stderr);

  const pkg = JSON.parse(read(dir, "package.json"));
  assert.equal(pkg.scripts.dev, "node scripts/serve.mjs .");
  assert.equal(pkg.scripts.build, "node scripts/build-static.mjs");
  assert.equal(pkg.scripts.preview, "node scripts/serve.mjs dist");
  assert.equal(pkg.scripts.typecheck, undefined);
  assert.equal(pkg.scripts.check, "pnpm build && vitest run");
  assert.equal(pkg.devDependencies.vite, undefined);

  assert.ok(!fs.existsSync(path.join(dir, "vite.config.ts")));
  assert.ok(!fs.existsSync(path.join(dir, "main.ts")));
  assert.ok(!fs.existsSync(path.join(dir, "tsconfig.json")));
  assert.ok(!read(dir, "index.html").includes("<script"));
  // the evidence checker under scripts/ is shipped material, never counted
  // as loose TypeScript
  assert.equal(read(dir, "scripts/check-evidence.ts"), "// shipped evidence check\n");
});

test("the written build script copies pages and assets but not course files", () => {
  const dir = makeRepo(
    pristineFixture({
      "about.html": "<!doctype html>\n<html><body>about</body></html>\n",
      "img/photo.jpg": "jpg-bytes",
      "public/card.png": "card-bytes",
    }),
  );
  assert.equal(strip(dir).status, 0);
  const build = spawnSync("node", ["scripts/build-static.mjs"], { cwd: dir, encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr);

  assert.equal(read(dir, "dist/index.html"), read(dir, "index.html"));
  assert.equal(read(dir, "dist/about.html"), "<!doctype html>\n<html><body>about</body></html>\n");
  assert.equal(read(dir, "dist/styles.css"), "body { color: red; }\n");
  assert.equal(read(dir, "dist/img/photo.jpg"), "jpg-bytes");
  assert.ok(!fs.existsSync(path.join(dir, "dist/PROCESS.md")));
  assert.ok(!fs.existsSync(path.join(dir, "dist/spec")));
  assert.ok(!fs.existsSync(path.join(dir, "dist/package.json")));

  // public/ flattens into the site root the way Vite and Astro both do it, so
  // a link written ./card.png still resolves after the build.
  assert.equal(read(dir, "dist/card.png"), "card-bytes");
  assert.ok(!fs.existsSync(path.join(dir, "dist/public")));
});

test("the written server serves pages, assets, and 404s honestly", async () => {
  const dir = makeRepo(pristineFixture());
  assert.equal(strip(dir).status, 0);
  const { spawn } = await import("node:child_process");
  const server = spawn("node", ["scripts/serve.mjs", "."], {
    cwd: dir,
    env: { ...process.env, PORT: "0" },
  });
  try {
    const port = await new Promise((resolve, reject) => {
      server.stdout.on("data", (d) => {
        const m = String(d).match(/localhost:(\d+)/);
        if (m) resolve(m[1]);
      });
      server.on("error", reject);
      setTimeout(() => reject(new Error("server did not start")), 5000);
    });
    const page = await fetch(`http://localhost:${port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Replace this with your prototype/);
    const css = await fetch(`http://localhost:${port}/styles.css`);
    assert.equal(css.headers.get("content-type"), "text/css; charset=utf-8");
    const missing = await fetch(`http://localhost:${port}/nope.html`);
    assert.equal(missing.status, 404);
  } finally {
    server.kill();
  }
});

test("loose TypeScript is flagged and left, and typecheck survives", () => {
  const dir = makeRepo(
    pristineFixture({
      "index.html": '<!doctype html>\n<html><body><script type="module" src="./app.ts"></script></body></html>\n',
      "app.ts": "export {};\n",
    }),
  );
  const r = strip(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /app\.ts: TypeScript has no compile step/);
  assert.ok(fs.existsSync(path.join(dir, "app.ts")));
  assert.ok(fs.existsSync(path.join(dir, "tsconfig.json")));
  const pkg = JSON.parse(read(dir, "package.json"));
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
});

test("refuses an Astro repo and a dirty tree", () => {
  const astro = makeRepo(
    pristineFixture({
      "package.json": `${JSON.stringify(
        { ...TEMPLATE_PACKAGE, devDependencies: { astro: "^7.0.0" } },
        null,
        2,
      )}\n`,
    }),
  );
  const r1 = strip(astro);
  assert.equal(r1.status, 2);
  assert.match(r1.stderr, /Astro/);

  const dirty = makeRepo(pristineFixture());
  fs.appendFileSync(path.join(dirty, "index.html"), "<!-- wip -->\n");
  const r2 = strip(dirty);
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /dirty/);
});
