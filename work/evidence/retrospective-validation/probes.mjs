import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { acceptanceIds, sealEvidence, validateReceipt } from "../../../tools/lib/evidence.mjs";
import { closeSession } from "../../../tools/lib/memory.mjs";
import { planScaffold, applyScaffold } from "../../../tools/lib/scaffold.mjs";
import { parseFrontmatter, pathInside } from "../../../tools/lib/shared.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const product = "D:/projects/product-sales-management";
const base = resolve(tmpdir()), owned = [];
const results = [];
const output = (probe, data) => { const row = { probe, ...data }; results.push(row); console.log(JSON.stringify(row)); };
async function put(root, path, value) {
  const target = pathInside(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, typeof value === "string" ? value : JSON.stringify(value));
}
async function fixture() {
  const root = await mkdtemp(join(base, "harness-retrospective-probe-")); owned.push(root);
  await cp(join(repository, "tools"), join(root, "tools"), { recursive: true });
  for (const file of ["AGENTS.md", "harness.config.json", "harness/router.json", "harness/toolchain.lock.json"])
    await put(root, file, await readFile(join(repository, file), "utf8"));
  return root;
}
try {
  const actual = await readFile(join(product, "docs/product/requirements/product-sales-management-dev.md"), "utf8");
  const review = JSON.parse(await readFile(join(product, "work/reviews/2026-09-10-dev-review.json"), "utf8"));
  output("HIMP-01-actual-read-only", {
    requirementStatus: parseFrontmatter(actual).status,
    reviewIds: review.acceptance.map(ac => ac.id), recognizedIds: acceptanceIds(actual)
  });
  for (const [name, requirement, ids] of [
    ["supported", "- AC-01: Required fixture result\n", ["AC-01"]],
    ["unsupported-only", "- AC-D01: Required fixture result\n", ["AC-D01"]],
    ["mixed-omitted", "- AC-01: Reviewed fixture result\n- AC-D01: Unreviewed required result\n", ["AC-01"]],
    ["duplicate-requirement", "- AC-01: First required result\n- AC-01: Different required result\n", ["AC-01"]]
  ]) {
    const root = await fixture();
    await put(root, "docs/requirement.md", "---\nstatus: accepted\n---\n" + requirement);
    await put(root, "work/evidence/fixture.md", "Synthetic fixture observation; not production acceptance.\n");
    await put(root, "work/reviews/fixture.json", { reviewer: "fixture-independent-reviewer", provider: "manual", independent: true,
      acceptance: ids.map(id => ({ id, status: "pass", evidence: ["work/evidence/fixture.md"] })) });
    await put(root, "work/sessions/FIXTURE.md", "---\nid: FIXTURE\nstatus: active\nprovider: codex\ngate: none\ngate_status: not-applicable\nrequirement: docs/requirement.md\n---\n# Synthetic fixture\n");
    let receiptStatus = null, sessionStatus = "active", error = null;
    try {
      const receipt = await sealEvidence(root, { review: "work/reviews/fixture.json", session: "FIXTURE", requirement: "docs/requirement.md", output: "work/reviews/fixture.receipt.json" });
      receiptStatus = receipt.status;
      await validateReceipt(root, "work/reviews/fixture.receipt.json", { sessionId: "FIXTURE", requirement: "docs/requirement.md", implementer: "codex" });
      await closeSession(root, { id: "FIXTURE", outcome: "completed", summary: "Synthetic diagnostic only", verifier_evidence: "work/reviews/fixture.receipt.json" });
      sessionStatus = parseFrontmatter(await readFile(join(root, "work/sessions/FIXTURE.md"), "utf8")).status;
    } catch (failure) { error = failure.message; }
    output("HIMP-01-" + name, { recognizedIds: acceptanceIds(requirement), receiptStatus, sessionStatus, error });
  }
  {
    // Commands below are untrusted STRINGS sent to the policy hook, never executed.
    const root = await fixture();
    for (const provider of ["claude", "copilot"]) {
      const result = spawnSync(process.execPath, [join(root, "tools/agent-hook.mjs"), "policy", "--provider", provider], {
        cwd: root, shell: false, encoding: "utf8", timeout: 15000,
        env: { ...process.env, HARNESS_SESSION_ID: "", HARNESS_LOOP_ID: "" },
        input: JSON.stringify({ tool_name: "bash", tool_input: { command: "npm run tests-that-fail; databricks bundle deploy -t dev --profile DEV" } })
      });
      assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
      output("HIMP-02-hook-static-sequence", { provider, denied: result.stdout.includes('"deny"'), output: result.stdout.trim(),
        actualDeployCalls: 0, note: "Only policy inspection; absence of deny is not permission or a deployment result." });
    }
  }
  {
    const root = await fixture(), calls = [];
    const manifest = { version: "2.0", plugins: { server: { name: "server", requiredByTemplate: true, resources: { required: [], optional: [] } } } };
    const ok = value => ({ ok: true, status: 0, stdout: JSON.stringify(value ?? {}), stderr: "" });
    const run = async (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === "auth" && args[1] === "profiles") return ok({ profiles: [{ name: "DEV", host: "https://dev.cloud.databricks.com" }] });
      if (args[0] === "auth" && args[1] === "describe") return ok({ status: "success", username: "fixture-user", details: { host: "https://dev.cloud.databricks.com", auth_type: "databricks-cli" } });
      if (args[1] === "manifest") return ok(manifest);
      if (args[1] === "init") {
        const target = args[args.indexOf("--output-dir") + 1], name = args[args.indexOf("--name") + 1];
        await put(root, target + "/" + name + "/package.json", { name });
        return ok();
      }
      if (args[1] === "validate") {
        const target = args[args.indexOf("--path") + 1];
        try { await readFile(pathInside(root, target + "/package.json")); return ok(); }
        catch { return { ok: false, status: 1, stdout: "", stderr: "fixture validator: package.json missing at requested component root" }; }
      }
      throw new Error("Unexpected external invocation: " + command + " " + args.join(" "));
    };
    const plan = await planScaffold(root, { kind: "app", name: "fixture-app", purpose: "mock", profile: "DEV", host: "https://dev.cloud.databricks.com" }, { run });
    let error;
    try { await applyScaffold(root, { plan: "work/scaffolds/" + plan.id + ".json", yes: true }, { run }); }
    catch (failure) { error = failure.message; }
    const saved = JSON.parse(await readFile(join(root, "work/scaffolds/" + plan.id + ".json"), "utf8"));
    output("HIMP-08-nested-cli-output", { expectedRoot: plan.outputDir, actualRoot: plan.outputDir + "/" + plan.name,
      status: saved.status, failureStage: saved.failureStage, error, validationPath: saved.validation?.command,
      actualExternalCalls: 0, injectedCallCount: calls.length });
  }
  {
    const root = await fixture();
    // Use current tracked template bytes plus the new reader modules already copied above.
    // Deliberately add a synthetic initialized product to the *source fixture*, never this repo.
    const listed = spawnSync("git", ["ls-files", "-z"], { cwd: repository, shell: false, encoding: "utf8" });
    assert.equal(listed.status, 0, listed.stderr);
    for (const file of listed.stdout.split("\0").filter(Boolean)) {
      if (file.startsWith("work/") || file.startsWith(".harness/")) continue;
      const target = pathInside(root, file);
      await mkdir(dirname(target), { recursive: true });
      await cp(pathInside(repository, file), target);
    }
    await put(root, "product.config.json", { schemaVersion: 1, name: "existing-product", displayName: "Synthetic existing product", initializedAt: "2026-09-01T00:00:00Z" });
    const before = await readFile(join(root, "product.config.json"), "utf8");
    const result = spawnSync(process.execPath, ["--test", "--test-name-pattern=^fresh template setup", "tests/harness.test.mjs"], {
      cwd: root, shell: false, encoding: "utf8", timeout: 60000,
      env: { ...process.env, HARNESS_SESSION_ID: "", HARNESS_LOOP_ID: "" }
    });
    assert.ifError(result.error);
    output("HIMP-08-current-test-in-initialized-fixture", { exitCode: result.status,
      renameGuardObserved: /Setup will not rename an existing product/.test(result.stdout + result.stderr),
      sourceConfigUnchanged: before === await readFile(join(root, "product.config.json"), "utf8"),
      stdout: result.stdout, stderr: result.stderr });
  }
  console.log(JSON.stringify({ summary: "Diagnostic observations complete; not a passing implementation or real acceptance", probes: results.length }));
} finally {
  for (const root of owned) {
    assert.ok(root.startsWith(base + sep));
    assert.match(root.slice(base.length + 1), /^harness-retrospective-probe-/);
    assert.notEqual(root, base);
    await rm(root, { recursive: true, force: true });
  }
}

