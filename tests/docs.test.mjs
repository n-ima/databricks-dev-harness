import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDocsServer } from "../tools/docs-server.mjs";
import { validateSchema } from "../tools/lib/schema.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("guide serves locally with working links, CSP and no workspace-file exposure", async () => {
  const server = createDocsServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/site/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /script-src 'self'/);
    const html = await response.text();
    assert.match(html, /<html lang="ja">/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (match[1].startsWith("#")) assert.ok(ids.includes(match[1].slice(1)), match[1]);
      else if (!match[1].startsWith("https:")) assert.equal((await fetch(new URL(match[1], `${base}/site/`))).status, 200, match[1]);
    }
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 404);
    assert.equal((await fetch(`${base}/site/`, { method: "POST" })).status, 405);
  } finally { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
});

test("durable schema validator rejects malformed states and unsupported assertion vocabulary", async () => {
  const schema = JSON.parse(await readFile(join(root, "harness/schemas/loop.schema.json"), "utf8"));
  assert.ok(validateSchema(schema, {}).some((e) => e.includes("missing")));
  assert.ok(validateSchema({ type: "integer", minimum: 1 }, 0).length);
  assert.ok(validateSchema({ type: "object", additionalProperties: false }, { unknown: 1 }).length);
  assert.ok(validateSchema({ anyOf: [] }, {}).some((e) => e.includes("unsupported")));
  assert.deepEqual(validateSchema({ type: ["number", "null"], exclusiveMinimum: 0 }, null), []);
  assert.ok(validateSchema({ type: "string", format: "date-time" }, "not-a-date").length);
});
