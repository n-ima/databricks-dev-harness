#!/usr/bin/env node

import {
  access,
  appendFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { connectDatabricks, doctorDatabricks } from "./lib/databricks.mjs";
import { createIntake, answerIntake, approveIntake, showIntake } from "./lib/intake.mjs";
import { initLoop, showLoop, setLoopGate, approveLoopGate, recordLoop, runLoopIteration, stopLoop } from "./lib/loop.mjs";
import { planScaffold, applyScaffold } from "./lib/scaffold.mjs";
import * as memory from "./lib/memory.mjs";
import { sessionRecords as readSessionRecords } from "./lib/session-state.mjs";
import { workState, renderWorkState, writeStatus } from "./lib/work-state.mjs";
import { createTask, updateTask, listTasks, taskRecords } from "./lib/tasks.mjs";
import { sealEvidence } from "./lib/evidence.mjs";
import { instructionAssets } from "./lib/assets.mjs";
import { createApproval } from "./lib/approval.mjs";
import { validateDurableArtifacts } from "./lib/schema.mjs";
import { prepareEvaluation, recordEvaluation, compareEvaluations } from "./lib/evaluation.mjs";
import { createRelease, registerBaseline, normalizeManagedText, planUpdate, applyUpdate } from "./lib/distribution.mjs";
import { writeJson as atomicWriteJson } from "./lib/shared.mjs";
import { stageVendorLegal, verifyVendorLegal } from "./lib/vendor-legal.mjs";
import { loadWorkloads, resolveWorkloads, resolveRoute } from "./lib/workloads.mjs";
import { deploymentCommand } from "./lib/deployment-simulation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalSkills = join(root, "harness", "skills");
const vendorSkills = join(root, "vendor", "databricks-skills");
const skillTargets = [join(root, ".claude", "skills"), join(root, ".github", "skills")];

const requiredFiles = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "ARCHITECTURE.md",
  ".github/copilot-instructions.md",
  ".github/hooks/harness.json",
  ".github/agents/independent-verifier.agent.md",
  ".claude/settings.json",
  ".claude/agents/independent-verifier.md",
  "docs/USAGE.md",
  "docs/harness/design/ARCHITECTURE.md",
  "docs/harness/operations/OPERATING_MODEL.md",
  "docs/harness/operations/IMPROVEMENT_LOOP.md",
  "docs/harness/operations/SESSION_AND_KNOWLEDGE.md",
  "docs/product/README.md",
  "docs/product/standards/DATABRICKS.md",
  "docs/product/standards/FRONTEND.md",
  "docs/product/standards/QUALITY.md",
  "docs/product/standards/SECURITY.md",
  "harness/router.json",
  "harness/evals/golden-tasks.json",
  "harness/templates/session.md",
  "harness/templates/product-requirement.md",
  "harness/templates/product-architecture.md",
  "harness/templates/execution-plan.md",
  "harness/templates/evidence.md",
  "harness/templates/knowledge.md",
  "harness.config.json",
  "package-lock.json",
  "vendor/databricks-skills.lock.json",
];

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(base, current = base) {
  if (!(await exists(base))) return [];
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(base, path)));
    else files.push(relative(base, path).replaceAll("\\", "/"));
  }
  return files.sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseOptions(args) {
  const options = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      options._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.replaceAll("-", "_");
    let value;
    if (inlineValue !== undefined) value = inlineValue;
    else if (args[index + 1] && !args[index + 1].startsWith("--")) value = args[++index];
    else value = true;
    if (Object.hasOwn(options, key)) {
      options[key] = Array.isArray(options[key]) ? [...options[key], value] : [options[key], value];
    } else options[key] = value;
  }
  return options;
}

function cleanInline(value, fallback = "") {
  return String(value ?? fallback).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  const slug = cleanInline(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "work";
}

function projectSlug(value) {
  const slug = cleanInline(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  if (!slug) throw new Error("Project name must contain an ASCII letter or number.");
  return slug;
}

function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function compactTimestamp() {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 19).replaceAll(":", "")}-${iso.slice(20, 23)}`;
}

async function safeRemoveGenerated(path) {
  const resolved = resolve(path);
  if (!skillTargets.includes(resolved) || !resolved.startsWith(root + sep)) {
    throw new Error(`Refusing to remove non-generated path: ${resolved}`);
  }
  await rm(resolved, { recursive: true, force: true });
}

async function skillSources() {
  const sources = [{ name: "harness", path: canonicalSkills }];
  if (await exists(vendorSkills)) sources.push({ name: "databricks", path: vendorSkills });
  return sources;
}

async function expectedSkills() {
  const expected = new Map();
  for (const source of await skillSources()) {
    for (const file of await listFiles(source.path)) {
      if (expected.has(file)) throw new Error(`Skill collision: ${file}`);
      expected.set(file, join(source.path, file));
    }
  }
  return expected;
}

async function copySkillSource(source, target) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    await cp(join(source, entry.name), join(target, entry.name), { recursive: true, force: true });
  }
}

async function syncAgentAssets() {
  const sources = await skillSources();
  for (const target of skillTargets) {
    await safeRemoveGenerated(target);
    await mkdir(target, { recursive: true });
    for (const source of sources) await copySkillSource(source.path, target);
  }
  await instructionAssets(root, true);
  console.log(
    `Synchronized ${sources.map((item) => item.name).join(" + ")} skills to Claude Code and GitHub Copilot.`,
  );
}

async function compareSkillTarget(target) {
  const expected = await expectedSkills();
  const targetFiles = await listFiles(target);
  const expectedFiles = [...expected.keys()].sort();
  const problems = [];
  if (JSON.stringify(expectedFiles) !== JSON.stringify(targetFiles)) {
    problems.push(`${relative(root, target)} file list differs from canonical skill sources`);
    return problems;
  }
  for (const [file, sourcePath] of expected) {
    const source = await readFile(sourcePath);
    const generated = await readFile(join(target, file));
    if (!source.equals(generated)) problems.push(`${relative(root, join(target, file))} is stale`);
  }
  return problems;
}

async function writeIfMissing(path, content) {
  if (await exists(path)) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return true;
}

async function availablePath(path) {
  if (!(await exists(path))) return path;
  const extensionIndex = path.lastIndexOf(".");
  const stem = extensionIndex > path.lastIndexOf(sep) ? path.slice(0, extensionIndex) : path;
  const extension = extensionIndex > path.lastIndexOf(sep) ? path.slice(extensionIndex) : "";
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${stem}-${suffix}${extension}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`Could not allocate a unique path for ${path}`);
}

function bundleYaml(projectName) {
  return `bundle:
  name: ${projectName}
  engine: direct
  databricks_cli_version: '>= 1.6.0, < 2.0.0'
  deployment:
    lock:
      enabled: true

include:
  - resources/*.yml

variables:
  catalog:
    description: Unity Catalog catalog for this deployment
  schema:
    description: Unity Catalog schema for this deployment
  dev_suffix:
    description: Unique suffix for an isolated developer/session deployment
    default: local
  team_root:
    description: Team-owned workspace root required for test and production

targets:
  dev:
    mode: development
    default: true
    workspace:
      root_path: /Workspace/Users/\${workspace.current_user.userName}/.bundle/\${bundle.name}/\${bundle.target}/\${var.dev_suffix}

  test:
    mode: production
    presets:
      trigger_pause_status: PAUSED
    workspace:
      root_path: \${var.team_root}/\${bundle.name}/\${bundle.target}

  prod:
    mode: production
    git:
      branch: main
    workspace:
      root_path: \${var.team_root}/\${bundle.name}/\${bundle.target}
`;
}

async function installDatabricksSkills(refresh = false) {
  if ((await exists(vendorSkills)) && !refresh) {
    console.log("Official Databricks skills already vendored; use --refresh-skills to update.");
    return true;
  }
  const staging = join(root, ".harness", "runtime", "databricks-skills-download");
  const stagingResolved = resolve(staging);
  if (!stagingResolved.startsWith(root + sep)) throw new Error("Invalid skills staging path.");
  await rm(stagingResolved, { recursive: true, force: true });
  await mkdir(stagingResolved, { recursive: true });
  const result = spawnSync(
    "databricks",
    ["aitools", "install", "--path", relative(root, stagingResolved)],
    { cwd: root, encoding: "utf8", shell: false },
  );
  if (result.error || result.status !== 0) {
    console.warn(
      "Could not vendor official Databricks skills. Continue offline, then rerun setup --refresh-skills.",
    );
    if (result.error) console.warn(result.error.message);
    else console.warn((result.stderr || result.stdout).trim());
    return false;
  }
  const output = result.stdout || "";
  const resolvedVersion = output.match(/Using skills version\s+([^\s]+)/i)?.[1] || "unknown";
  let legal;
  try {
    legal = await stageVendorLegal(stagingResolved, resolvedVersion);
  } catch (error) {
    console.warn(`Official skill legal files could not be verified; the current vendor and lock were preserved. ${error.message}`);
    return false;
  }
  const vendorResolved = resolve(vendorSkills);
  if (!vendorResolved.startsWith(root + sep)) throw new Error("Invalid vendored skills path.");
  await rm(vendorResolved, { recursive: true, force: true });
  await mkdir(dirname(vendorResolved), { recursive: true });
  await rename(stagingResolved, vendorResolved);
  const cliVersion = commandVersion("databricks", ["-v"]);
  await writeFile(
    join(root, "vendor", "databricks-skills.lock.json"),
    JSON.stringify(
      {
        source: "https://github.com/databricks/databricks-agent-skills",
        resolvedVersion,
        resolvedBy: cliVersion,
        retrievedAt: timestamp(),
        updateCommand: "npm run setup -- --refresh-skills",
        legal,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log((output || "Vendored official Databricks skills.").trim());
  return true;
}

async function setup(options) {
  const projectName = projectSlug(options.project_name || basename(root));
  const displayName = cleanInline(options.display_name, projectName);
  const profile = cleanInline(options.profile);
  const host = cleanInline(options.host);
  if ((profile && !host) || (!profile && host)) throw new Error("Provide both --profile and --host.");
  if (options.auth && (!host || !profile)) throw new Error("--auth requires both --host and --profile.");
  const existingProduct = await exists(join(root, "product.config.json")) ? await readJson(join(root, "product.config.json")) : null;
  if (existingProduct && options.project_name && existingProduct.name !== projectName) throw new Error("Setup will not rename an existing product. Review product.config.json and Bundle names separately.");

  await writeIfMissing(
    join(root, "product.config.json"),
    JSON.stringify({ schemaVersion: 1, name: projectName, displayName, initializedAt: timestamp() }, null, 2) + "\n",
  );
  await writeIfMissing(join(root, "databricks.yml"), bundleYaml(projectName));
  for (const directory of [
    "apps",
    "src",
    "resources",
    "tests",
    "work/sessions",
    "work/plans",
    "work/evidence",
    "work/reviews",
  ]) {
    await mkdir(join(root, directory), { recursive: true });
  }
  if ((profile && !host) || (!profile && host)) throw new Error("Provide both --profile and --host.");

  if (!options.skip_agent_skills) {
    const installed = await installDatabricksSkills(Boolean(options.refresh_skills));
    if (!installed && (options.refresh_skills || !(await exists(vendorSkills)))) {
      throw new Error("Official Databricks skills could not be installed or refreshed.");
    }
  }
  await syncAgentAssets();

  // Preserve the original template snapshot. Never fingerprint downstream edits
  // or replace the newer installed baseline when setup is rerun after an update.
  if (!(await exists(join(root, ".harness", "installed-release.json"))) && await exists(join(root, "harness", "base-release.json"))) {
    await registerBaseline(root, { manifest: "harness/base-release.json" });
  }

  if (options.auth && (!host || !profile)) throw new Error("--auth requires both --host and --profile.");
  if (profile) await connectDatabricks(root, { profile, host, auth: Boolean(options.auth), allow_default: options.allow_default });

  await check({ exitOnFailure: true });
  console.log("\nSetup complete.");
  console.log("1. Open this folder in VS Code.");
  console.log("2. Start Claude Code or Copilot Chat and describe the desired outcome naturally.");
  console.log("3. The agent will create/resume a durable work session and follow the routed workflow.");
  if (!profile) console.log("4. Configure Databricks later with: npm run setup -- --profile <name> --host <url> --auth");
}

async function sessionRecords() {
  return readSessionRecords(root);
}

async function resolveSession(id) {
  const matches = (await sessionRecords()).filter(
    (item) => item.id === id || item.id.startsWith(id) || basename(item.path).startsWith(id),
  );
  if (matches.length !== 1) {
    throw new Error(matches.length ? `Session id is ambiguous: ${id}` : `Session not found: ${id}`);
  }
  return matches[0];
}

async function listSessions() {
  const records = await sessionRecords();
  if (!records.length) return console.log("No durable sessions.");
  for (const item of records) {
    console.log(`${item.status.padEnd(10)} ${item.intent.padEnd(16)} ${item.id} — ${item.title}`);
  }
}

async function context(options = {}) {
  if (options.write) throw new Error("context is read-only; use status --write explicitly.");
  const state = await workState(root, options);
  if (options.json) return console.log(JSON.stringify(state, null, 2));
  const config = await readJson(join(root, "harness.config.json"));
  const product = (await exists(join(root, "product.config.json"))) ? await readJson(join(root, "product.config.json")) : null;
  console.log(`Harness ${config.harnessVersion} (${config.maturityLevel})`);
  console.log(`Product: ${product ? `${product.displayName} [${product.name}]` : "not initialized"}`);
  console.log("Canonical product docs: docs/product/");
  console.log("Canonical harness docs: docs/harness/");
  console.log(renderWorkState(state));
  console.log("Knowledge indexes: docs/product/knowledge/INDEX.md, docs/harness/knowledge/INDEX.md");
}

async function status(options = {}) {
  const state = options.write ? await writeStatus(root, options) : await workState(root, options);
  console.log(options.json ? JSON.stringify(state, null, 2) : renderWorkState(state));
}

async function route(options) {
  const prompt = cleanInline(options.prompt || options._.join(" "));
  if (!prompt) throw new Error("route requires --prompt with a sanitized task summary.");
  const selected = await resolveRoute(root, prompt, options);
  console.log(JSON.stringify({ route: selected.id, skill: selected.skill, firstGate: selected.firstGate,
    reason: selected.reason, workloads: selected.workload.selectedIds, executionAuthorized: false }, null, 2));
}

async function check({ exitOnFailure = false } = {}) {
  const problems = [];
  try { await taskRecords(root); } catch (error) { problems.push(error.message); }
  try { await loadWorkloads(root); } catch (error) { problems.push(error.message); }
  problems.push(...await instructionAssets(root));
  problems.push(...await validateDurableArtifacts(root));
  problems.push(...await verifyVendorLegal(root));
  for (const file of requiredFiles) {
    if (!(await exists(join(root, file)))) problems.push(`Missing required file: ${file}`);
  }
  for (const jsonFile of [
    "package.json",
    "harness.config.json",
    "harness/router.json",
    "harness/evals/golden-tasks.json",
    ".github/hooks/harness.json",
    ".claude/settings.json",
    "vendor/databricks-skills.lock.json",
  ]) {
    try {
      await readJson(join(root, jsonFile));
    } catch (error) {
      problems.push(`Invalid JSON in ${jsonFile}: ${error.message}`);
    }
  }
  if (await exists(join(root, "AGENTS.md"))) {
    const lines = (await readFile(join(root, "AGENTS.md"), "utf8")).split(/\r?\n/).length;
    if (lines > 140) problems.push(`AGENTS.md has ${lines} lines; keep the map at 140 or fewer`);
  }
  if (await exists(join(root, "CLAUDE.md"))) {
    const text = await readFile(join(root, "CLAUDE.md"), "utf8");
    if (!text.includes("@AGENTS.md")) problems.push("CLAUDE.md must import @AGENTS.md");
  }
  if (await exists(canonicalSkills)) {
    for (const target of skillTargets) problems.push(...(await compareSkillTarget(target)));
  }
  for (const record of await sessionRecords()) {
    if (!["active", "completed", "blocked", "superseded"].includes(record.status)) {
      problems.push(`Invalid session status in ${relative(root, record.path)}: ${record.status}`);
    }
  }
  if (problems.length) {
    console.error("Harness check failed:\n" + problems.map((item) => `- ${item}`).join("\n"));
    if (exitOnFailure) throw new Error("Harness conformance failed.");
    process.exitCode = 1;
    return false;
  }
  console.log("Harness check passed.");
  return true;
}

function commandVersion(command, args = ["--version"]) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  if (result.error) {
    const reason = result.error.code ? ` (${result.error.code})` : "";
    return `not executable in this environment${reason}`;
  }
  return (result.stdout || result.stderr || `exit ${result.status}`).trim().split(/\r?\n/)[0];
}

function help() {
  console.log(`Databricks Development Harness

Commands:
  setup [--project-name NAME] [--profile NAME] [--host URL] [--auth]
        [--skip-agent-skills] [--refresh-skills]
  sync-agent-assets
  check | doctor [--profile NAME] [--strict] [--json] | context
  connect --profile NAME --host URL [--auth] [--allow-default]
  context [--session ID] [--all] [--json]
  status [--session ID] [--all] [--json] [--write]
  task create --id TV-01 --title TEXT --session ID --done-when TEXT [--depends-on TV-00]
  task list [--session ID] | show --id TV-01
  task update --id TV-01 --status STATE --expected-revision SHA256 --summary TEXT
  route --prompt "sanitized task summary"
  workload list|resolve [--prompt TEXT] [--workload ID (repeat)] [--without ID (repeat)]
  intake create --title TITLE --summary TEXT [--source repo/path] [--name ASCII_NAME] [--workload ID (repeat)]
  intake show|answer|approve --id ID [--question Q-01 --answer TEXT --actor PERSON]
  scaffold plan --kind app|api|analysis|data-update|genie|metric-view --name NAME [--feature FEATURE] [--set KEY=VALUE]
  scaffold apply --plan work/scaffolds/ID.json --yes
  loop init --session ID --provider manual|claude|copilot [--max-iterations 8]
  loop show|run|record|gate|approve|stop --id ID (run defaults to dry-run; --execute opts in)
  evidence seal --review work/reviews/FILE.json --session ID --requirement PATH
  deployment simulate --id RUN_ID --session SESSION_ID --scenario success|validation-failed|deployment-failed|deployment-pending|start-failed|health-failed|deployment-timeout|scope-mismatch
  deployment show --id RUN_ID (read-only; synthetic observations, never live)
  approval create --session ID --gate GATE --actor PERSON --evidence PATH --artifact PATH
  eval prepare [--id ID] [--revision COMMIT] | record --plan PATH --result PATH
  eval compare --baseline PATH --candidate PATH
  release create [--version VERSION] [--stamp-template]
  release normalize --yes
  release baseline --manifest ORIGINAL_UPSTREAM_MANIFEST
  update plan --source RELEASE_DIRECTORY [--baseline ORIGINAL_MANIFEST]
  update apply --plan .harness/updates/PLAN.json --yes
  session start --title TITLE --intent ROUTE --objective OUTCOME [--provider NAME]
  session checkpoint --id ID --summary TEXT --next TEXT [--decision TEXT] [--evidence TEXT]
                     [--blocker TEXT] [--task TASK_ID|none] [--expected-revision SHA256]
  session close --id ID --outcome completed|blocked|superseded --summary TEXT
                [--verifier-evidence RECEIPT]
  session list
  knowledge add --scope product|harness --title TITLE --body TEXT
                --source PATH --applies-to SCOPE --confidence high|medium|low
                [--kind fact|decision|pattern|pitfall] [--review-after YYYY-MM-DD]
`);
}

const [command = "help", subcommand, ...rest] = process.argv.slice(2);
const options = parseOptions(rest);
try {
  if (command === "setup") await setup(parseOptions(process.argv.slice(3)));
  else if (command === "sync-agent-assets") await syncAgentAssets();
  else if (command === "check") await check();
  else if (command === "doctor") await doctorDatabricks(root, parseOptions(process.argv.slice(3)));
  else if (command === "connect") await connectDatabricks(root, parseOptions(process.argv.slice(3)));
  else if (command === "context") await context(parseOptions(process.argv.slice(3)));
  else if (command === "status") await status(parseOptions(process.argv.slice(3)));
  else if (command === "task" && subcommand === "create") console.log(JSON.stringify(await createTask(root, options), null, 2));
  else if (command === "task" && subcommand === "update") console.log(JSON.stringify(await updateTask(root, options), null, 2));
  else if (command === "task" && ["list", "show"].includes(subcommand)) {
    if (subcommand === "show" && !options.id) throw new Error("task show requires --id.");
    console.log(JSON.stringify(await listTasks(root, options), null, 2));
  }
  else if (command === "route") await route(parseOptions(process.argv.slice(3)));
  else if (command === "workload" && subcommand === "list") console.log(JSON.stringify(await loadWorkloads(root), null, 2));
  else if (command === "workload" && subcommand === "resolve") {
    if (!options.prompt && !options.workload) throw new Error("workload resolve requires --prompt or --workload.");
    console.log(JSON.stringify(await resolveWorkloads(root, options.prompt ?? "", options), null, 2));
  }
  else if (command === "session" && subcommand === "start") await memory.startSession(root, options);
  else if (command === "session" && subcommand === "checkpoint") await memory.checkpointSession(root, options);
  else if (command === "session" && subcommand === "close") await memory.closeSession(root, options);
  else if (command === "session" && subcommand === "list") await listSessions();
  else if (command === "knowledge" && subcommand === "add") await memory.addKnowledge(root, options);
  else if (command === "intake" && subcommand === "create") await createIntake(root, options);
  else if (command === "intake" && subcommand === "answer") await answerIntake(root, options);
  else if (command === "intake" && subcommand === "approve") await approveIntake(root, options);
  else if (command === "intake" && subcommand === "show") await showIntake(root, options);
  else if (command === "scaffold" && subcommand === "plan") await planScaffold(root, options);
  else if (command === "scaffold" && subcommand === "apply") await applyScaffold(root, options);
  else if (command === "loop" && subcommand === "init") await initLoop(root, options);
  else if (command === "loop" && subcommand === "show") await showLoop(root, options);
  else if (command === "loop" && subcommand === "run") await runLoopIteration(root, options);
  else if (command === "loop" && subcommand === "record") await recordLoop(root, options);
  else if (command === "loop" && subcommand === "gate") await setLoopGate(root, options);
  else if (command === "loop" && subcommand === "approve") await approveLoopGate(root, options);
  else if (command === "loop" && subcommand === "stop") await stopLoop(root, options);
  else if (command === "evidence" && subcommand === "seal") await sealEvidence(root, options);
  else if (command === "deployment") {
    const record = await deploymentCommand(root, subcommand, rest);
    console.log(JSON.stringify(record, null, 2));
    if (subcommand === "simulate" && record.status !== "simulated-success") process.exitCode = 1;
  }
  else if (command === "approval" && subcommand === "create") await createApproval(root, options);
  else if (command === "eval" && subcommand === "prepare") await prepareEvaluation(root, options);
  else if (command === "eval" && subcommand === "record") await recordEvaluation(root, options);
  else if (command === "eval" && subcommand === "compare") { const report = await compareEvaluations(root, options); console.log(JSON.stringify(report, null, 2)); if (!report.promotable) process.exitCode = 1; }
  else if (command === "release" && subcommand === "create") {
    if (options.stamp_template && await exists(join(root, "product.config.json"))) throw new Error("--stamp-template is for the harness source repository, not an initialized downstream product.");
    const release = await createRelease(root, options);
    if (options.stamp_template) {
      await atomicWriteJson(join(root, "harness", "base-release.json"), release.manifest);
      console.log("harness/base-release.json stamped; review and include it in the template release commit.");
    }
  }
  else if (command === "release" && subcommand === "baseline") await registerBaseline(root, options);
  else if (command === "release" && subcommand === "normalize") await normalizeManagedText(root, options);
  else if (command === "update" && subcommand === "plan") await planUpdate(root, options);
  else if (command === "update" && subcommand === "apply") await applyUpdate(root, options);
  else if (command === "help" || command === "--help") help();
  else throw new Error(`Unknown command: ${command} ${subcommand ?? ""}. Run --help.`);
} catch (error) {
  console.error(`Harness error: ${error.message}`);
  process.exitCode = 1;
}
