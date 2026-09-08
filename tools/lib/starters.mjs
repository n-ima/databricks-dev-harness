import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "./shared.mjs";

const FILES = {
  api: ["model.mjs", "server.mjs", "contract.test.mjs"],
  analysis: ["analysis.py", "test_analysis.py", "fixture.json", "fixture.sql"],
};
export async function planStarter(root, kind, base) {
  const evidenceFiles = await Promise.all(FILES[kind].map(async file => {
    const path = "harness/templates/starters/" + kind + "/" + file;
    return { path, sha256: sha256(await readFile(join(root, path))) };
  }));
  return { ...base, kind, purpose: "fixture", status: "ready", missing: [], command: [],
    deployReady: false, evidenceFiles,
    outputDir: "tests/fixtures/" + kind + "/" + base.name,
    remainingWork: kind === "api"
      ? ["Confirm API contract and identity", "Choose Apps HTTP or Model Serving runtime", "Replace in-memory receipts with atomic durable transactions", "Verify real OAuth/CAN USE, authorization, expiry, concurrency, scale and rollback in dev"]
      : ["Confirm analysis question, source contract and quality rules", "Select approved read-only compute and matching local environment", "Run real SQL/notebook, record data version and reproducibility", "Separate training/registry/serving requirements if in scope"] };
}
function openapi() {
  const order = { type: "object", additionalProperties: false, required: ["orderId", "quantity"],
    properties: { orderId: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,40}$" }, quantity: { type: "integer", minimum: 1, maximum: 1000000 } } };
  const error = { description: "Stable error body", content: { "application/json": { schema: { type: "object", required: ["error"], properties: { error: { type: "string" } } } } } };
  return { openapi: "3.1.0", info: { title: "Fixture-only order API: replace with accepted product contract", version: "0.0.0" },
    "x-harness-fixture-only": true,
    components: { securitySchemes: { fixtureBearer: { type: "http", scheme: "bearer", description: "Literal fixture-only value; NOT Databricks OAuth validation." } } },
    paths: { "/api/orders": { post: { operationId: "writeOrderFixture", security: [{ fixtureBearer: [] }],
      parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,80}$" } }],
      requestBody: { required: true, content: { "application/json": { schema: order } } },
      responses: { "200": { description: "Same key/body replays identical response; same key/different body returns 409.",
        content: { "application/json": { schema: { ...order, required: ["orderId", "quantity", "revision"], properties: { ...order.properties, revision: { type: "integer", minimum: 1 } } } } } },
        ...Object.fromEntries(["400", "401", "409", "413", "415", "429"].map(status => [status, error])) } } } } };
}
export async function starterArtifacts(root, plan) {
  if (plan.purpose !== "fixture" || plan.outputDir !== "tests/fixtures/" + plan.kind + "/" + plan.name)
    throw new Error("Invalid fixture-only output contract.");
  const files = await Promise.all(FILES[plan.kind].map(async file =>
    [plan.outputDir + "/" + file, await readFile(join(root, "harness/templates/starters", plan.kind, file), "utf8")]));
  const json = value => JSON.stringify(value, null, 2) + "\n";
  files.push([plan.outputDir + "/.harness-fixture-only.json", json({ schemaVersion: 1, deployReady: false, purpose: "contract-fixture" })]);
  if (plan.kind === "api") files.push([plan.outputDir + "/openapi.json", json(openapi())]);
  else {
    files.push([plan.outputDir + "/analysis.ipynb", json({ nbformat: 4, nbformat_minor: 5,
      metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" } },
      cells: [{ id: "intent", cell_type: "markdown", metadata: {}, source: ["# Fixture-only analysis\n", "Run from this directory. No production data or trained model. Define the accepted question, source version, quality rules and decision before integration."] },
        { id: "analyze", cell_type: "code", metadata: {}, execution_count: null, outputs: [], source: ["import json\n", "from pathlib import Path\n", "from analysis import analyze\n", "rows = json.loads(Path('fixture.json').read_text())\n", "analyze(rows, '2026-01-01', '2026-01-03')"] }] })]);
    files.push([plan.outputDir + "/databricks-query.draft.sql", "-- DRAFT; never automatically executed. Bind parameters with SDK/SQL editor.\n-- Validate source schema/quality/ACL and scan budget first. LIMIT alone does not bound scanning.\nSELECT day, SUM(quantity) AS quantity\nFROM IDENTIFIER(:source_table)\nWHERE day >= :start_day AND day < :end_day\nGROUP BY day ORDER BY day;\n"]);
  }
  const command = plan.kind === "api" ? "node --test contract.test.mjs" : 'python -m unittest discover -s . -p "test_analysis.py" -v';
  files.push([plan.outputDir + "/README.md", "# " + plan.name + ": fixture-only contract\n\nNot a deployed product, not approval, and not a Databricks runtime test. Generated files live under tests/fixtures and no app.yaml / databricks.yml / live credentials are created.\n\nRun from repository root:\n\n```text\ncd " + plan.outputDir + "\n" + command + "\n```\n\n" +
    (plan.kind === "api" ? "Start the optional loopback HTTP fixture with node server.mjs. It prints its ephemeral local URL. Authentication is a literal mock value, not real OAuth. Receipts are process-local, single-process only, capped at 1000 and lost on restart. No tenant authorization, expiry, durable transaction, rate control or production server is implemented. Do not copy this server into deployment. Use the official Apps endpoint/runtime guide after contract approval.\n" : "The notebook uses synthetic rows. SQLite validates only the portable fixture SELECT, not Databricks SQL dialect, Spark or Connect. The draft Databricks query is parameterized but unexecuted. Validate the source's uniqueness/null/date rules before querying; never substitute this fixture for a trained model.\n") +
    "\n## Remaining product work\n\n" + plan.remainingWork.map(item => "- " + item).join("\n") + "\n"]);
  return files;
}

