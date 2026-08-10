import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "verify-deploy.sh");

// A stand-in for GitHub Pages: every route the fixture declares serves 200,
// everything else 404s — which is the whole failure this script exists to
// catch, since the page itself is one of the routes that serves.
function serve(routes) {
  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const body = routes[url];
    if (body === undefined) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": url.endsWith(".css") ? "text/css" : "text/html" });
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// Async, not spawnSync: the fixture server runs in this process, and a
// synchronous child blocks the event loop that would answer its requests.
const exec = promisify(execFile);

async function verify(server, urlPath) {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}${urlPath}`;
  try {
    return { status: 0, ...(await exec("bash", [SCRIPT, url])) };
  } catch (err) {
    return { status: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

async function withServer(routes, urlPath, assertions) {
  const server = await serve(routes);
  try {
    assertions(await verify(server, urlPath));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("a page whose assets resolve passes", async () => {
  await withServer(
    {
      "/comp4020-crit2-someone/": `<link rel="stylesheet" href="/comp4020-crit2-someone/_astro/index.css">`,
      "/comp4020-crit2-someone/_astro/index.css": "body{}",
    },
    "/comp4020-crit2-someone/",
    (run) => {
      assert.equal(run.status, 0);
      assert.match(run.stdout, /asset {2}200/);
      assert.match(run.stdout, /all resolve/);
    },
  );
});

// The regression that prompted this script: Astro configured with `site` but no
// `base` emits a root-absolute stylesheet, which 404s under a project Pages
// subpath while the page itself serves 200 — three green lights and an unstyled
// site at the URL the crit sweep reads.
test("a root-absolute asset under a project base path fails", async () => {
  await withServer(
    {
      "/comp4020-crit2-someone/": `<link rel="stylesheet" href="/_astro/index.DKxPCf8X.css">`,
    },
    "/comp4020-crit2-someone/",
    (run) => {
      assert.equal(run.status, 2);
      assert.match(run.stdout, /page {3}200/);
      assert.match(run.stdout, /asset {2}404 {2}\/_astro\/index\.DKxPCf8X\.css/);
      assert.match(run.stderr, /base path/);
    },
  );
});

test("a relative asset resolves against the page's directory", async () => {
  await withServer(
    {
      "/comp4020-crit2-someone/": `<script type="module" src="./assets/main.js"></script>`,
      "/comp4020-crit2-someone/assets/main.js": "export {};",
    },
    "/comp4020-crit2-someone/",
    (run) => {
      assert.equal(run.status, 0);
      assert.match(run.stdout, /asset {2}200 {2}\.\/assets\/main\.js/);
    },
  );
});

// An off-site font or CDN is not the student's deploy to police, and a flaky
// third party must not read as a broken submission.
test("an off-site asset is not checked", async () => {
  await withServer(
    {
      "/comp4020-crit2-someone/": `<link rel="stylesheet" href="https://cdn.invalid/x.css">`,
    },
    "/comp4020-crit2-someone/",
    (run) => {
      assert.equal(run.status, 0);
      assert.match(run.stdout, /nothing to resolve/);
    },
  );
});

// `.js` must match as an extension, not as a prefix of `.json`.
test("a json reference is not mistaken for a script", async () => {
  await withServer(
    {
      "/comp4020-crit2-someone/": `<link rel="manifest" href="/comp4020-crit2-someone/site.json">`,
    },
    "/comp4020-crit2-someone/",
    (run) => {
      assert.equal(run.status, 0);
      assert.match(run.stdout, /nothing to resolve/);
    },
  );
});
