import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { repository, installWorkloadCatalog } from "./helpers/workloads.mjs";
import { loadWorkloads, resolveWorkloads, resolveRoute } from "../tools/lib/workloads.mjs";
import { createIntake } from "../tools/lib/intake.mjs";
import { applyScaffold, planScaffold } from "../tools/lib/scaffold.mjs";
import { writeJson, readJson } from "../tools/lib/shared.mjs";
async function fixture(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "harness-platform-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => { assert.ok(root.startsWith(base + sep)); assert.match(root.slice(base.length + 1), /^harness-platform-/); await rm(root, { recursive: true, force: true }); });
  await installWorkloadCatalog(root);
  await cp(join(repository, "harness/templates/starters"), join(root, "harness/templates/starters"), { recursive: true });
  await writeJson(join(root, "harness/toolchain.lock.json"), { appkitTemplateVersion: "v0.69.1" });
  return root;
}
test("API-only intake has contract and transaction questions, not UI or Delta questions", async t => {
  const root = await fixture(t);
  const summary = "Databricks Appsで受注更新REST APIを作る。UIは不要。Lakebaseに登録する。";
  const route = await resolveRoute(root, summary);
  assert.notEqual(route.id, "mock-ui"); assert.equal(route.workload.executionAuthorized, false);
  const intake = await createIntake(root, { name: "orders-api", title: "受注API", summary });
  assert.deepEqual(intake.workloadSelection.selectedIds, ["api", "lakebase"]);
  assert.equal(intake.capabilities.ui, false); assert.equal(intake.capabilities.dataUpdate, false);
  assert.ok(intake.questions.some(q => q.id === "Q-40")); assert.ok(intake.questions.some(q => q.id === "Q-70"));
  assert.ok(!intake.questions.some(q => ["Q-10", "Q-20", "Q-21"].includes(q.id)));
  const design = await readFile(join(root, intake.artifacts.architecturePath), "utf8");
  assert.match(design, /CAN USE/); assert.doesNotMatch(design, /Rich UI:|Natural-language analytics:|Lakeflow Job/);
});
test("notebook MLflow registry and serving remain a mixed discussion, not data registration or deploy", async t => {
  const root = await fixture(t);
  const prompt = "Unity CatalogのデータをNotebookとSQLで探索し、需要予測モデルをMLflowに登録してModel Serving APIで公開・デプロイしたい。まず要件を議論したい。";
  const route = await resolveRoute(root, prompt);
  assert.equal(route.id, "define"); assert.equal(route.reason, "discussion-first");
  const intake = await createIntake(root, { title: "Forecast", summary: prompt });
  for (const id of ["analysis", "ml", "model-serving", "api", "governance"]) assert.ok(intake.workloadSelection.selectedIds.includes(id), id);
  assert.equal(intake.capabilities.dataUpdate, false); assert.equal(intake.capabilities.ui, false);
  for (const id of ["Q-50", "Q-100", "Q-110"]) assert.ok(intake.questions.some(q => q.id === id), id);
  assert.match(await readFile(join(root, intake.artifacts.architecturePath), "utf8"), /Classical ML/);
});
test("generic agents are not Genie, provider names/build do not match UI, explicit scope wins", async () => {
  assert.equal((await resolveWorkloads(repository, "MCPエージェントを作りたい")).selectedIds.includes("genie"), false);
  assert.equal((await resolveWorkloads(repository, "build CLI utility with Claude Code and GitHub Copilot")).selectedIds.includes("rich-app"), false);
  assert.deepEqual((await resolveWorkloads(repository, "UI app", { workload: ["api", "ml"] })).selectedIds, ["api", "ml"]);
  assert.deepEqual((await resolveWorkloads(repository, "AppKit API UI", { without: "rich-app" })).selectedIds, ["api"]);
  await assert.rejects(resolveWorkloads(repository, "test", { workload: "unknown" }), /Unknown workload/);
  await assert.rejects(resolveWorkloads(repository, "test", { workload: "api", without: "api" }), /both/);
  assert.equal((await resolveRoute(repository, "デプロイ手順", { intent: "investigate" })).id, "investigate");
});
test("unknown workloads require a material question and cannot authorize execution", async t => {
  const root = await fixture(t), intake = await createIntake(root, { title: "Unknown", summary: "A new capability to be identified." });
  assert.ok(intake.workloadSelection.unknown);
  assert.ok(intake.questions.some(q => q.id === "Q-00" && q.material));
  assert.equal(intake.status, "needs-answers");
});
test("every catalog entry has real official skill paths and validated unique question IDs", async t => {
  const root = await fixture(t), catalog = await loadWorkloads(root);
  assert.equal(catalog.workloads.length, 16);
  const file = join(root, "harness/workloads.json");
  catalog.workloads[1].questions[0].id = catalog.workloads[0].questions[0].id;
  await writeJson(file, catalog);
  await assert.rejects(loadWorkloads(root), /duplicate workload question/);
});

test("catalog discovers each platform family and retains English API/dashboard composition", async () => {
  const cases = {
    "rich-app": "Build a dashboard with charts", api: "REST API", analysis: "Notebook SQL探索",
    "data-pipeline": "Lakeflow pipeline", ingestion: "Zerobus ingest", lakebase: "Lakebase PostgreSQL",
    genie: "Genie Space", dashboard: "AI/BI", "metric-view": "metric view KPI",
    ml: "MLflow training", "model-serving": "Model Serving", rag: "RAG AI Search", agent: "MCP agent",
    governance: "Unity Catalog権限", sharing: "Delta Sharing federation", automation: "Jobs SDK bundle",
  };
  for (const [id, prompt] of Object.entries(cases)) assert.ok((await resolveWorkloads(repository, prompt)).selectedIds.includes(id), id);
  const mixed = await resolveWorkloads(repository, "Build a REST API and dashboard with charts");
  assert.ok(mixed.selectedIds.includes("rich-app")); assert.ok(mixed.selectedIds.includes("api"));
});
for (const kind of ["api", "analysis"]) test(kind + " starter is isolated, hash-bound, executable and refuses overwrite", async t => {
  const root = await fixture(t), options = { kind, name: "trial" };
  const dependencies = { run: () => assert.fail("Fixture generation must never call Databricks") };
  const plan = await planScaffold(root, options, dependencies), path = "work/scaffolds/" + plan.id + ".json";
  assert.equal(plan.deployReady, false); assert.equal(plan.status, "ready"); assert.deepEqual(plan.command, []);
  const result = await applyScaffold(root, { plan: path, yes: true }, dependencies);
  assert.ok(result.generatedFiles.every(file => file.startsWith("tests/fixtures/" + kind + "/trial/")));
  assert.equal((await readJson(join(root, plan.outputDir, ".harness-fixture-only.json"))).deployReady, false);
  const run = kind === "api"
    ? spawnSync(process.execPath, ["--test", "contract.test.mjs"], { cwd: join(root, plan.outputDir), encoding: "utf8", timeout: 30000 })
    : spawnSync(process.env.HARNESS_TEST_PYTHON || "python", ["-m", "unittest", "discover", "-s", ".", "-p", "test_analysis.py", "-v"], { cwd: join(root, plan.outputDir), encoding: "utf8", timeout: 30000 });
  assert.equal(run.status, 0, run.stderr || run.stdout || run.error?.message);
  if (kind === "api") {
    const spec = await readJson(join(root, plan.outputDir, "openapi.json"));
    assert.equal(spec.openapi, "3.1.0"); assert.equal(spec["x-harness-fixture-only"], true);
  } else assert.equal((await readJson(join(root, plan.outputDir, "analysis.ipynb"))).cells.length, 2);
  const again = await planScaffold(root, options, dependencies);
  await assert.rejects(applyScaffold(root, { plan: "work/scaffolds/" + again.id + ".json", yes: true }, dependencies), /overwrite/);
  const stale = await planScaffold(root, { kind, name: "stale" }, dependencies);
  await writeFile(join(root, stale.evidenceFiles[0].path), "changed template");
  await assert.rejects(applyScaffold(root, { plan: "work/scaffolds/" + stale.id + ".json", yes: true }, dependencies), /evidence changed/);
});
