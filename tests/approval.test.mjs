import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { atomicWrite, parseFrontmatter, readJson, writeJson } from "../tools/lib/shared.mjs";
import { createApproval } from "../tools/lib/approval.mjs";

async function fixture(t, gate = "ui-mock") {
  t.mock.method(console, "log", () => {});
  const root = await mkdtemp(join(tmpdir(), "harness-approval-"));
  t.after(async () => { assert.ok(root.startsWith(resolve(tmpdir()) + sep)); assert.match(root, /harness-approval-/); await rm(root, { recursive: true, force: true }); });
  await writeJson(join(root, "harness.config.json"), { humanGates: ["product-intent", "ui-mock"] });
  await atomicWrite(join(root, "work/sessions/session.md"), `---\nid: session\nstatus: active\ngate: ${gate}\ngate_status: pending\nrequirement: docs/product/requirements/demo.md\n---\nSession\n`);
  await atomicWrite(join(root, "docs/product/requirements/demo.md"), "---\nstatus: accepted\n---\n- AC-01: observable outcome\n");
  await atomicWrite(join(root, "work/evidence/human.md"), "Human reviewed the executable fixture and approved this snapshot.\n");
  await atomicWrite(join(root, "apps/demo/mock.tsx"), "export const fixture = 'synthetic';\n");
  return root;
}
const options = { session: "session", gate: "ui-mock", actor: "owner", evidence: "work/evidence/human.md", artifact: ["apps/demo/mock.tsx"] };
test("mock approval binds executable artifacts and updates the active session", async (t) => {
  const root = await fixture(t);
  const result = await createApproval(root, options);
  assert.ok(result.artifactHashes[options.artifact[0]]);
  assert.equal(parseFrontmatter(await readFile(join(root, "work/sessions/session.md"), "utf8")).gate_status, "approved");
  assert.equal((await readJson(join(root, "work/approvals/session/ui-mock.json"))).actor, "owner");
});
test("mock approval cannot skip pending product intent", async (t) => {
  const root = await fixture(t, "product-intent");
  await assert.rejects(createApproval(root, options), /existing gate/);
});
test("mock approval requires a real session, human evidence, and executable artifacts", async (t) => {
  const root = await fixture(t);
  await assert.rejects(createApproval(root, { ...options, artifact: [] }), /artifact/);
  await assert.rejects(createApproval(root, { ...options, session: "missing" }), /ENOENT/);
  await assert.rejects(createApproval(root, { ...options, evidence: "missing" }), /ENOENT/);
});
test("existing accepted requirements can be approved but intake questions cannot be bypassed", async (t) => {
  const root = await fixture(t, "product-intent");
  const result = await createApproval(root, { ...options, gate: "product-intent" });
  assert.ok(result.artifactHashes["docs/product/requirements/demo.md"]);
  await atomicWrite(join(root, "docs/product/requirements/demo.md"), "---\nstatus: accepted\nintake: docs/product/intake/demo/intake.json\n---\nRequirement\n");
  await assert.rejects(createApproval(root, { ...options, gate: "product-intent" }), /intake approve/);
});
