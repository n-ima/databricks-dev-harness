import { readFile, rename, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { profileEnvironment } from "./databricks.mjs";
import {
  asciiSlug,
  atomicWrite,
  cleanInline,
  commandResult,
  compactTimestamp,
  exists,
  optionList,
  pathInside,
  readJson,
  repoRelative,
  sha256,
  timestamp,
  writeJson,
  withFileLock,
} from "./shared.mjs";

const KINDS = new Set(["app", "data-update", "genie", "metric-view"]);

function pinnedVersion(value) {
  const version = cleanInline(value);
  if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("AppKit requires an exact release version; main/latest/branches are not reproducible pins.");
  }
  return version;
}

function redactedFailure(value) {
  return cleanInline(value)
    .replace(/\bdapi[a-z0-9]+\b/gi, "[REDACTED]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/((?:token|password|client_secret)\s*[=:]\s*)\S+/gi, "$1[REDACTED]")
    .slice(0, 1500);
}

function appEnvironment(purpose) {
  // CLI template overrides must never make the manifest and pinned init disagree.
  // Mock isolation is limited to ambient environment values, not an OS sandbox.
  return profileEnvironment();
}

function workspaceHost(value) {
  let host;
  try { host = new URL(value); } catch { throw new Error("App --host must be an explicit HTTPS development workspace origin."); }
  if (host.protocol !== "https:" || host.username || host.password || host.pathname !== "/" || host.search || host.hash) {
    throw new Error("App --host must be an HTTPS workspace origin without credentials or a path.");
  }
  return host.origin;
}

async function verifyAppWorkspace(root, profile, expectedHost, purpose, dependencies) {
  if (!profile || !expectedHost) throw new Error("App init requires an explicit --profile and --host; default workspace selection is forbidden.");
  const run = dependencies.run ?? commandResult;
  const env = appEnvironment(purpose);
  const json = async (args, label) => {
    const result = await run("databricks", args, { cwd: root, timeout: 60_000, env });
    if (!result.ok) throw new Error(`${label} failed. Inspect the selected development profile locally; credential output is not persisted.`);
    try { return JSON.parse(result.stdout); } catch { throw new Error(`${label} returned invalid JSON.`); }
  };
  // --skip-validate only inventories configuration. Do not authenticate other profiles
  // or contact an unexpected workspace before comparing the explicitly chosen host.
  const profiles = await json(["auth", "profiles", "--skip-validate", "-o", "json"], "Profile inventory");
  const selected = (Array.isArray(profiles.profiles) ? profiles.profiles : []).find((item) => item.name === profile);
  if (!selected?.host || workspaceHost(selected.host) !== expectedHost) throw new Error("Selected App profile does not match the explicitly approved workspace host.");
  const auth = await json(["auth", "describe", "--profile", profile, "-o", "json"], "Workspace authentication");
  if (auth.status !== "success" || auth.error || !cleanInline(auth.username) || auth.account_id || !auth.details?.host || workspaceHost(auth.details.host) !== expectedHost) {
    throw new Error("Selected App profile did not verify as the expected workspace user.");
  }
  const reportedProfile = auth.details.configuration?.profile?.value;
  if (reportedProfile && reportedProfile !== profile) throw new Error("Workspace authentication resolved an unexpected profile.");
  return { profile, host: expectedHost, status: "verified", authType: cleanInline(auth.details.auth_type, "unknown"),
    verifiedAt: timestamp(), scope: "development-workspace-authentication-only; no business data access authorized" };
}

function parseAssignments(values, label) {
  const result = {};
  for (const value of optionList(values)) {
    const index = value.indexOf("=");
    if (index < 1 || index === value.length - 1) throw new Error(`${label} must use key=value: ${value}`);
    const key = value.slice(0, index).trim();
    if (Object.hasOwn(result, key)) throw new Error(`Duplicate ${label} key: ${key}`);
    const assigned = value.slice(index + 1).trim();
    if (!key || !assigned) throw new Error(`${label} must have a non-empty key and value.`);
    result[key] = assigned;
  }
  return result;
}

function manifestJson(text) {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("AppKit manifest did not contain JSON.");
  try {
    return JSON.parse(text.slice(start));
  } catch {
    throw new Error("AppKit manifest returned invalid JSON.");
  }
}

async function loadManifest(root, options, dependencies) {
  if (options.manifest_file) {
    const path = pathInside(root, options.manifest_file, "manifest file");
    const content = await readFile(path, "utf8");
    const manifest = JSON.parse(content);
    const declared = cleanInline(options.manifest_template_version ?? manifest.templateVersion);
    if (declared !== options.version) {
      throw new Error("A local manifest requires --manifest-template-version matching the pinned AppKit version (or manifest.templateVersion).");
    }
    return { manifest, source: { kind: "file", path: repoRelative(root, path), version: declared, sha256: sha256(content) } };
  }
  const run = dependencies.run ?? commandResult;
  const args = ["apps", "manifest", "--version", options.version];
  if (options.profile) args.push("--profile", String(options.profile));
  const result = await run("databricks", args, { cwd: root, timeout: 120_000, env: appEnvironment(options.purpose) });
  if (!result.ok) throw new Error(`Could not read AppKit manifest: ${redactedFailure(result.stderr || result.error)}`);
  return { manifest: manifestJson(result.stdout), source: { kind: "cli", command: ["databricks", ...args], version: options.version } };
}

function pluginEntries(manifest) {
  const entries = Array.isArray(manifest.plugins)
    ? manifest.plugins.map((item) => [item.name, item])
    : Object.entries(manifest.plugins ?? {});
  if (!entries.length || entries.some(([key, item]) => !/^[A-Za-z][A-Za-z0-9_-]*$/.test(key) || !item || typeof item !== "object")) {
    throw new Error("AppKit manifest must contain named plugin definitions.");
  }
  if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error("Duplicate AppKit plugin names.");
  return entries;
}

function resourceAssignments(pluginKey, plugin, supplied) {
  const resources = [];
  for (const category of ["required", "optional"]) {
    for (const resource of plugin.resources?.[category] ?? []) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(resource.resourceKey ?? "")) throw new Error(`Invalid resource key for ${pluginKey}.`);
      const prefix = `${pluginKey}.${resource.resourceKey}.`;
      const configured = category === "required" || Object.keys(supplied).some((key) => key.startsWith(prefix));
      const fields = Object.entries(resource.fields ?? {}).map(([field, value]) => {
        if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(field)) throw new Error(`Invalid field for ${prefix}`);
        const details = typeof value === "string" ? { description: value } : value ?? {};
        const userInput = !["cli", "platform", "resolved"].includes(details.origin)
          && !details.localOnly && !details.resolve && !details.resolved && !Object.hasOwn(details, "value");
        return {
          key: `${prefix}${field}`, plugin: pluginKey, resourceKey: resource.resourceKey, field,
          type: resource.type, permission: resource.permission,
          origin: details.origin ?? "user", userInput,
          required: configured && userInput && details.required !== false,
          localOnly: Boolean(details.localOnly), resolved: Boolean(details.resolve || details.resolved),
          description: details.description ?? resource.description ?? "Resource value",
          value: userInput ? supplied[`${prefix}${field}`] ?? null : details.value ?? null,
        };
      });
      resources.push({ plugin: pluginKey, resourceKey: resource.resourceKey, category, configured,
        disposition: configured ? "configured" : "omitted", type: resource.type, permission: resource.permission, fields });
    }
  }
  return resources;
}

function gatherRules(manifest, selected) {
  const rules = [];
  const add = (source, block) => {
    for (const severity of ["must", "should", "never"]) {
      for (const text of block?.[severity] ?? []) {
        if (typeof text !== "string" || !text.trim()) throw new Error("Manifest rules must be non-empty strings.");
        const phase = /^before init\b/i.test(text) ? "before-init" : /^after init\b/i.test(text) ? "after-init" : "always";
        rules.push({ id: `${source}-${sha256(`${severity}:${text}`).slice(0, 12)}`, source, severity, phase, text });
      }
    }
  };
  add("template", manifest.scaffolding?.rules);
  for (const [key, plugin] of pluginEntries(manifest)) if (selected.has(key)) add(key, plugin.scaffolding?.rules);
  const action = (text) => text.toLowerCase().replace(/^(?:before|after) init[, :]*\s*/, "").replace(/^(?:never|do not|don't|must not)\s+/, "").replace(/[.!]+$/, "").trim();
  const must = new Set(rules.filter((item) => item.severity === "must").map((item) => action(item.text)));
  const never = new Set(rules.filter((item) => item.severity === "never").map((item) => action(item.text)));
  const conflicts = [...must].filter((item) => never.has(item));
  if (conflicts.length) throw new Error(`Manifest contains conflicting must/never rules: ${conflicts.join("; ")}`);
  return rules;
}

async function evidenceFile(root, value, label, missing, snapshots) {
  const relativePath = cleanInline(value);
  if (!relativePath) { missing.push(label); return null; }
  const path = pathInside(root, relativePath, label);
  if (!(await exists(path))) { missing.push(`missing-file:${relativePath}`); return null; }
  if (!(await stat(path)).isFile()) { missing.push(`not-file:${relativePath}`); return null; }
  const bytes = await readFile(path);
  const content = bytes.toString("utf8");
  if (!content.trim()) { missing.push(`empty-evidence:${relativePath}`); return null; }
  snapshots.push({ path: repoRelative(root, path), sha256: sha256(bytes) });
  return { path: repoRelative(root, path), content, sha256: sha256(bytes) };
}

async function approval(root, value, gate, missing, snapshots, manifestHash) {
  const file = await evidenceFile(root, value, `approval:${gate}`, missing, snapshots);
  if (!file) return null;
  let record;
  try { record = JSON.parse(file.content); } catch { throw new Error(`${gate} approval must be a JSON decision record.`); }
  if (record.gate !== gate || record.decision !== "approved" || !cleanInline(record.actor)) {
    missing.push(`unapproved:${gate}`);
    return file.path;
  }
  if (manifestHash && record.manifestSha256 !== manifestHash) missing.push(`approval-manifest-mismatch:${gate}`);
  const review = await evidenceFile(root, record.evidence, `approval-evidence:${gate}`, missing, snapshots);
  if (gate === "ui-mock") {
    const hashes = record.artifactHashes;
    if (!hashes || typeof hashes !== "object" || Array.isArray(hashes) || !Object.keys(hashes).length) {
      missing.push("approval-artifact-hashes:ui-mock");
      return file.path;
    }
    const normalized = new Set();
    let reviewBound = false;
    let mockBound = false;
    for (const [artifactPath, expectedHash] of Object.entries(hashes)) {
      const artifact = await evidenceFile(root, artifactPath, `approval-artifact:${gate}`, missing, snapshots);
      if (!artifact) continue;
      if (normalized.has(artifact.path)) throw new Error(`Duplicate normalized approval artifact: ${artifact.path}`);
      normalized.add(artifact.path);
      if (!/^[a-f0-9]{64}$/.test(expectedHash) || artifact.sha256 !== expectedHash) missing.push(`stale-approval-artifact:${artifact.path}`);
      if (artifact.path === review?.path) reviewBound = true;
      else if (/\.(?:[cm]?[jt]sx?|html?|vue|svelte|json|csv|py)$/i.test(artifact.path)) mockBound = true;
    }
    if (!reviewBound) missing.push("approval-review-hash:ui-mock");
    if (!mockBound) missing.push("approval-executable-mock-hash:ui-mock");
  }
  return file.path;
}

function appCommand(plan) {
  const command = ["databricks", "apps", "init", "--version", pinnedVersion(plan.appkitVersion), "--name", plan.name, "--output-dir", plan.outputDir];
  if (plan.features.length) command.push("--features", plan.features.join(","));
  for (const [key, value] of Object.entries(plan.assignments)) command.push("--set", `${key}=${value}`);
  command.push("--description", plan.description, "--run", "none");
  if (plan.profile) command.push("--profile", plan.profile);
  if (plan.autoApprove) command.push("--auto-approve");
  return command;
}

async function planApp(root, options, base, dependencies) {
  pinnedVersion(options.version);
  const purpose = cleanInline(options.purpose, "integration");
  if (!["mock", "integration"].includes(purpose)) throw new Error("App --purpose must be mock or integration.");
  if (options.target && options.target !== "dev") throw new Error("Local App scaffolding requires the explicitly selected development workspace; only --target dev is accepted.");
  if (options.auth || options.connect) throw new Error("Scaffold never logs in or selects a connection; explicitly connect a development workspace first.");
  if (base.profile && (!/^[A-Za-z0-9_.-]{1,128}$/.test(base.profile) || base.profile.toUpperCase() === "DEFAULT")) throw new Error("App --profile must be an explicit descriptive development profile, not DEFAULT.");
  const host = options.host ? workspaceHost(cleanInline(options.host)) : null;
  if (!/^[a-z][a-z0-9-]*$/.test(base.name)) throw new Error("App names must start with a lowercase letter.");
  const { manifest, source: manifestSource } = await loadManifest(root, options, dependencies);
  const manifestSha256 = sha256(JSON.stringify(manifest));
  const entries = pluginEntries(manifest);
  const pluginMap = new Map(entries);
  const requested = new Set(optionList(options.feature).flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean));
  for (const feature of requested) if (!pluginMap.has(feature)) throw new Error(`AppKit manifest has no plugin named ${feature}.`);
  const mandatory = new Set(entries.filter(([, plugin]) => plugin.requiredByTemplate).map(([key]) => key));
  const selected = new Set([...mandatory, ...requested]);
  const supplied = parseAssignments(options.set, "--set");
  const groups = entries.filter(([key]) => selected.has(key)).flatMap(([key, plugin]) => resourceAssignments(key, plugin, supplied));
  if (purpose === "mock" && (!mandatory.has("server") || [...selected].some((key) => key !== "server") || groups.length || Object.keys(supplied).length)) {
    throw new Error("Mock scaffolds permit only the mandatory server plugin, with no data plugins or resource assignments.");
  }
  const resources = groups.flatMap((item) => item.fields);
  const missing = resources.filter((item) => item.required && !Object.hasOwn(supplied, item.key)).map((item) => item.key);
  const unknown = Object.keys(supplied).filter((key) => !resources.some((item) => item.key === key && item.userInput));
  if (unknown.length) throw new Error(`Unknown or CLI/platform-managed AppKit resource keys: ${unknown.join(", ")}`);
  for (const [key, value] of Object.entries(supplied)) {
    if (/(?:token|password|client.?secret)$/i.test(key) || /\bdapi[a-z0-9]{20,}\b/i.test(value)) throw new Error("Secret values must not be persisted in scaffold plans.");
  }
  const rules = gatherRules(manifest, selected);
  const evidenceFiles = [];
  if (manifestSource.kind === "file") evidenceFiles.push({ path: manifestSource.path, sha256: manifestSource.sha256 });
  const mockApproval = purpose === "mock" ? null : await approval(root, options.mock_approval, "ui-mock", missing, evidenceFiles);
  const rulesApproval = rules.length ? await approval(root, options.rules_approval, "appkit-rules", missing, evidenceFiles, manifestSha256) : null;
  const ruleEvidence = parseAssignments(options.rule_evidence, "--rule-evidence");
  const beforeRules = rules.filter((item) => item.severity === "must" && item.phase === "before-init");
  for (const id of Object.keys(ruleEvidence)) if (!beforeRules.some((item) => item.id === id)) throw new Error(`Unknown before-init MUST rule: ${id}`);
  for (const rule of beforeRules) {
    const file = await evidenceFile(root, ruleEvidence[rule.id], `rule-evidence:${rule.id}`, missing, evidenceFiles);
    if (!file) continue;
    let record;
    try { record = JSON.parse(file.content); } catch { throw new Error(`Rule evidence ${rule.id} must be JSON.`); }
    if (record.ruleId !== rule.id || record.status !== "passed" || !cleanInline(record.summary) || !Number.isFinite(Date.parse(record.verifiedAt))) {
      missing.push(`unverified-rule:${rule.id}`);
    } else rule.evidence = file.path;
  }
  if (!base.profile) missing.push("profile");
  if (!host) missing.push("host");
  if (purpose === "mock" && options.data_access && options.data_access !== "none") throw new Error("Mock scaffolds use fixtures only; no data-access integration is allowed.");
  const dataAccess = purpose === "mock" ? "none" : cleanInline(options.data_access);
  const hasLakebase = selected.has("lakebase") || selected.has("database");
  if (!dataAccess) missing.push("decision:data-access-pattern");
  else if (!["analytics", "lakebase-synced", "oltp-only", "both", "none"].includes(dataAccess)) throw new Error("Unsupported --data-access decision.");
  if (selected.has("analytics") && !["analytics", "both"].includes(dataAccess)) missing.push("decision:analytics-data-access");
  if (hasLakebase && !["lakebase-synced", "oltp-only", "both"].includes(dataAccess)) missing.push("decision:lakebase-data-access");
  if (["analytics", "both"].includes(dataAccess) && !selected.has("analytics")) missing.push("feature:analytics");
  if (["lakebase-synced", "oltp-only", "both"].includes(dataAccess) && !hasLakebase) missing.push("feature:lakebase");
  const lakebaseDecision = hasLakebase ? cleanInline(options.lakebase_decision) : "not-required";
  const genieDecision = selected.has("genie") ? cleanInline(options.genie_decision) : "not-required";
  if (hasLakebase && !["reuse", "create-approved"].includes(lakebaseDecision)) missing.push("decision:reuse-or-create-lakebase");
  if (selected.has("genie") && !["reuse", "create-approved"].includes(genieDecision)) missing.push("decision:reuse-or-create-genie-space");
  const optionalFeatures = [...requested].filter((item) => !mandatory.has(item));
  const outputDir = `apps/${base.name}`;
  if (options.auto_approve !== undefined && typeof options.auto_approve !== "boolean") throw new Error("--auto-approve is a bare boolean flag.");
  const workspaceVerification = base.profile && host ? await verifyAppWorkspace(root, base.profile, host, purpose, dependencies) : null;
  const plan = {
    ...base,
    kind: "app",
    purpose,
    status: missing.length ? "needs-input" : "ready",
    host, workspaceTarget: "dev", workspaceVerification,
    authenticationRequirement: "CLI init requires explicit development workspace authentication even for fixture-only mocks; this does not authorize business or production data access.",
    capabilityEvidence: "https://github.com/databricks/cli/blob/v1.6.0/cmd/apps/init.go#L142",
    appkitVersion: options.version,
    manifestVersion: manifest.version,
    manifestSource, manifestSha256,
    mandatoryFeatures: [...mandatory],
    features: optionalFeatures,
    selectedFeatures: [...selected],
    resources, resourceGroups: groups, assignments: supplied,
    dataAccess: dataAccess || null,
    lakebaseDecision: lakebaseDecision || null,
    genieDecision: genieDecision || null,
    mockApproval: mockApproval || null,
    rulesApproval, rules, evidenceFiles,
    autoApprove: options.auto_approve === true,
    autoApprovePolicy: "Opt-in only; --yes confirms the reviewed local-init plan. Required user fields and selected optional resource groups must be complete; omitted optional groups are explicitly recorded. No deployment or resource creation is authorized.",
    deployReady: false,
    nonDeployable: purpose === "mock",
    readinessScope: "local-init-only",
    bundleTopology: "nested-component-bundle",
    remainingWork: purpose === "mock"
      ? ["Build executable fixture-backed UI in the official starter", "Update smoke selectors and verify all UI states", "Record human mock approval", "Create a separate integration plan before adding data plugins or business-data resources; fixture bundle configuration is quarantined"]
      : ["Adapt starter code and smoke selectors to approved requirements", "Complete after-init and ongoing manifest rules", "Run fixture UI, accessibility and integration tests", "Review component databricks.yml targets, permissions and resources", "Obtain separate deployment and data/permission approvals"],
    missing,
    outputDir,
  };
  plan.command = appCommand(plan);
  return plan;
}

function tableName(value, label) {
  const cleaned = cleanInline(value);
  if (!/^(?:[A-Za-z_][A-Za-z0-9_]*|`[A-Za-z0-9_-]+`)(?:\.(?:[A-Za-z_][A-Za-z0-9_]*|`[A-Za-z0-9_-]+`)){2}$/.test(cleaned)) throw new Error(`${label} must be a fully qualified catalog.schema.table name; quote hyphenated parts with backticks.`);
  return cleaned;
}

function planDataUpdate(options, base) {
  const missing = [];
  const sourceTable = options.source_table ? tableName(options.source_table, "--source-table") : (missing.push("source-table"), null);
  const targetTable = options.target_table ? tableName(options.target_table, "--target-table") : (missing.push("target-table"), null);
  const keys = optionList(options.key).flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
  if (!keys.length) missing.push("merge-key");
  if (keys.some((item) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item))) throw new Error("Merge keys must be simple column identifiers.");
  if ([...keys, cleanInline(options.sequence_by)].some((item) => item.toLowerCase() === "__harness_rank")) throw new Error("Reserved harness column cannot be a merge key or sequence.");
  if (new Set(keys.map((item) => item.toLowerCase())).size !== keys.length) throw new Error("Merge keys must be unique.");
  const sequenceBy = cleanInline(options.sequence_by);
  if (!sequenceBy) missing.push("sequence-by");
  else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(sequenceBy)) throw new Error("--sequence-by must be a simple column identifier.");
  if (keys.some((key) => key.toLowerCase() === sequenceBy.toLowerCase())) throw new Error("The sequence column must not also be a merge key.");
  if (sourceTable && targetTable && sourceTable.replaceAll("`", "").toLowerCase() === targetTable.replaceAll("`", "").toLowerCase()) throw new Error("Source and target tables must differ.");
  const command = ["harness", "generate", "data-update", base.name];
  return { ...base, kind: "data-update", status: missing.length ? "needs-input" : "ready", deployReady: false, readinessScope: "local-generation-only", sourceTable, targetTable, keys, sequenceBy, missing, command,
    contract: { nullKeys: "reject", nullSequence: "reject", sameSequenceConflict: "reject", staleUpdates: "reject", exactReplay: "no-op", deletes: "unsupported", schemaEvolution: "disabled", concurrentWriters: "exclusive target writer required" },
    remainingWork: ["Approve target table and data-write scope", "Configure approved compute and bundle variables", "Run generated standard-library unit tests", "Run Delta integration tests in an isolated dev schema", "Enable --execute only after approval; no scaffold command deploys or runs the job"] };
}

function planGenie(options, base) {
  const tables = optionList(options.table).map((item) => tableName(item, "--table"));
  const questions = optionList(options.question).map(cleanInline).filter(Boolean);
  const missing = [];
  if (!tables.length) missing.push("table");
  if (questions.length < 3) missing.push("at-least-three-benchmark-questions");
  const command = ["harness", "generate", "genie", base.name];
  return { ...base, kind: "genie", status: missing.length ? "needs-input" : "draft-ready", deployReady: false, readinessScope: "draft-generation-only", tables, questions, missing, command,
    remainingWork: ["Review serialized Genie schema against the pinned CLI/API", "Choose warehouse and approve UC/resource permissions", "Add verified SQL ground truth and paraphrases", "Run benchmarks and approve accuracy thresholds", "Promote draft resource into the deployment bundle only after review"] };
}

function namedExpression(value, label) {
  const index = value.indexOf("=");
  if (index < 1 || index === value.length - 1) throw new Error(`${label} must use Display Name=SQL expression.`);
  const name = cleanInline(value.slice(0, index));
  const expression = cleanInline(value.slice(index + 1));
  if (!name || !expression || /;|\$\$|--|\/\*/.test(expression)) throw new Error(`${label} must contain one SQL expression without statement delimiters or comments.`);
  return { name, expression };
}

function planMetricView(options, base) {
  const missing = [];
  const sourceTable = options.source_table ? tableName(options.source_table, "--source-table") : (missing.push("source-table"), null);
  const dimensions = optionList(options.dimension).map((item) => namedExpression(item, "--dimension"));
  const measures = optionList(options.measure).map((item) => namedExpression(item, "--measure"));
  if (!dimensions.length) missing.push("dimension");
  if (!measures.length) missing.push("measure");
  const names = [...dimensions, ...measures].map((item) => item.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Metric dimension/measure names must be unique.");
  const command = ["harness", "generate", "metric-view", base.name];
  return { ...base, kind: "metric-view", status: missing.length ? "needs-input" : "draft-ready", deployReady: false, readinessScope: "draft-generation-only", sourceTable, dimensions, measures, missing, command,
    remainingWork: ["Review YAML 1.1 and source schema", "Add MEASURE parity and boundary fixtures", "Inspect normalized SHOW CREATE diff", "Approve target and DDL change before separately applying SQL"] };
}

export async function planScaffold(root, options, dependencies = {}) {
  const kind = cleanInline(options.kind);
  if (!KINDS.has(kind)) throw new Error(`--kind must be one of: ${[...KINDS].join(", ")}`);
  const name = asciiSlug(options.name, kind === "app" ? 26 : 48);
  const toolchain = await readJson(join(root, "harness", "toolchain.lock.json"));
  const base = {
    schemaVersion: 1,
    id: `${compactTimestamp()}-${kind}-${name}-${randomUUID().slice(0, 8)}`,
    name,
    description: cleanInline(options.description, `${name} ${kind}`),
    profile: cleanInline(options.profile) || null,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
  const normalized = { ...options, version: cleanInline(options.version, toolchain.appkitTemplateVersion) };
  let plan;
  if (kind === "app") plan = await planApp(root, normalized, base, dependencies);
  else if (kind === "data-update") plan = planDataUpdate(normalized, base);
  else if (kind === "genie") plan = planGenie(normalized, base);
  else plan = planMetricView(normalized, base);
  plan.integrityHash = sha256(JSON.stringify(plan));
  const path = join(root, "work", "scaffolds", `${plan.id}.json`);
  await writeJson(path, plan);
  console.log(JSON.stringify({ plan: repoRelative(root, path), status: plan.status, missing: plan.missing, rules: plan.rules ?? [] }, null, 2));
  return plan;
}

async function resolvePlan(root, value) {
  const path = pathInside(root, value, "scaffold plan");
  if (!(await exists(path))) throw new Error(`Scaffold plan does not exist: ${value}`);
  const plan = await readJson(path);
  return { path, plan };
}

async function writeGenerated(root, relativePath, content) {
  const path = pathInside(root, relativePath, "generated artifact");
  if (await exists(path)) throw new Error(`Refusing to overwrite generated artifact: ${relativePath}`);
  await atomicWrite(path, content);
  return relativePath.replaceAll("\\", "/");
}

function dataUpdatePython(plan) {
  return String.raw`"""Fail-closed, idempotent Delta upsert starter; not a deployed product.

Requires an existing target, identical flat schemas and an exclusive target writer.
Sequence values are non-null integers/decimals/dates/timestamps. Exact replay is a
no-op; conflicting ties and updates older than the target abort the batch. This
does not implement deletes, schema evolution, SCD2 or arbitrary CDC ordering.
Run the standard-library contract tests before isolated Databricks integration
tests. No Spark/Delta modules are imported by local contract tests.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime
from decimal import Decimal
from functools import reduce
import math
import re


def identifier(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError("Column identifiers must be simple names")
    if value.casefold() == "__harness_rank":
        raise ValueError("Reserved harness column")
    return value


def quoted(value: str) -> str:
    return chr(96) + identifier(value) + chr(96)


def validate_contract(keys: list[str], sequence_by: str) -> None:
    if not keys or len({key.lower() for key in keys}) != len(keys):
        raise ValueError("At least one unique merge key is required")
    for key in keys:
        identifier(key)
    identifier(sequence_by)
    if sequence_by.lower() in [key.lower() for key in keys]:
        raise ValueError("Sequence column must not be a merge key")


def _validated_rows(rows, keys, sequence_by):
    validate_contract(keys, sequence_by)
    result = [dict(row) for row in rows]
    columns = set(result[0]) if result else set()
    for row in result:
        if set(row) != columns:
            raise ValueError("Schema mismatch")
        for column in row:
            identifier(column)
        if any(key not in row or row[key] is None for key in keys):
            raise ValueError("Null or missing merge key")
        sequence = row.get(sequence_by)
        if sequence is None:
            raise ValueError("Null or missing sequence")
        if isinstance(sequence, bool) or not isinstance(sequence, (int, Decimal, date, datetime)):
            raise ValueError("Sequence must be an integer, decimal, date or timestamp")
        for value in row.values():
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError("Non-finite values are unsupported")
            if isinstance(value, Decimal) and not value.is_finite():
                raise ValueError("Non-finite values are unsupported")
            if isinstance(value, (dict, list, set, tuple)):
                raise ValueError("Only flat scalar columns are supported")
    return result


def deduplicate_records(rows, keys: list[str], sequence_by: str):
    """Executable semantic reference: reject conflicting ties before choosing latest."""
    rows = _validated_rows(rows, keys, sequence_by)
    versions, latest = {}, {}
    for row in rows:
        key = tuple(row[column] for column in keys)
        version = (key, row[sequence_by])
        if version in versions and versions[version] != row:
            raise ValueError("Conflicting rows with the same key and sequence")
        versions[version] = row
        try:
            if key not in latest or row[sequence_by] > latest[key][sequence_by]:
                latest[key] = row
        except TypeError as error:
            raise ValueError("Sequence types must match") from error
    return list(latest.values())


def merge_records(target_rows, source_rows, keys: list[str], sequence_by: str):
    """Pure fixture oracle for the same transition contract as execute_merge."""
    target = _validated_rows(target_rows, keys, sequence_by)
    source = deduplicate_records(source_rows, keys, sequence_by)
    if target and source and set(target[0]) != set(source[0]):
        raise ValueError("Schema mismatch")
    result = {}
    for row in target:
        key = tuple(row[column] for column in keys)
        if key in result:
            raise ValueError("Target merge keys are not unique")
        result[key] = row
    for row in source:
        key = tuple(row[column] for column in keys)
        current = result.get(key)
        if current is not None:
            try:
                if row[sequence_by] < current[sequence_by]:
                    raise ValueError("Stale update rejected")
            except TypeError as error:
                raise ValueError("Sequence types must match") from error
            if row[sequence_by] == current[sequence_by]:
                if row != current:
                    raise ValueError("Conflicting rows with the same key and sequence")
                continue
        result[key] = row
    return list(result.values())


def merge_condition(keys: list[str]) -> str:
    if not keys or len({key.lower() for key in keys}) != len(keys):
        raise ValueError("At least one unique merge key is required")
    return " AND ".join(f"target.{quoted(key)} = source.{quoted(key)}" for key in keys)


def merge_predicates(keys: list[str], sequence_by: str, columns: list[str]):
    validate_contract(keys, sequence_by)
    if not set(keys + [sequence_by]).issubset(columns):
        raise ValueError("Schema is missing contract columns")
    sequence = quoted(sequence_by)
    same_payload = " AND ".join(f"(target.{quoted(column)} <=> source.{quoted(column)})" for column in columns)
    return {
        "match": merge_condition(keys),
        "stale": f"source.{sequence} < target.{sequence}",
        "conflict": f"source.{sequence} = target.{sequence} AND NOT ({same_payload})",
        "newer": f"source.{sequence} > target.{sequence}",
    }


def execute_merge(target, updates, keys: list[str], sequence_by: str, columns: list[str]):
    """Actual Delta builder, also exercised with a recording adapter in unit tests.

    Error clauses run in the MERGE transaction, not just in a racy preflight.
    Equal sequence/equal payload matches no update clause and remains unchanged.
    """
    predicates = merge_predicates(keys, sequence_by, columns)
    return (target.alias("target")
        .merge(updates.alias("source"), predicates["match"])
        .whenMatchedUpdate(condition=predicates["stale"],
            set={quoted(sequence_by): "raise_error('HARNESS_STALE_UPDATE')"})
        .whenMatchedUpdate(condition=predicates["conflict"],
            set={quoted(sequence_by): "raise_error('HARNESS_CONFLICTING_SEQUENCE')"})
        .whenMatchedUpdateAll(condition=predicates["newer"])
        .whenNotMatchedInsertAll()
        .execute())


def validate_frame(frame, keys: list[str], sequence_by: str, *, target=False):
    from pyspark.sql import functions as F
    from pyspark.sql.types import AtomicType

    validate_contract(keys, sequence_by)
    if len({column.casefold() for column in frame.columns}) != len(frame.columns):
        raise ValueError("Duplicate or case-ambiguous column names are unsupported")
    if not set(keys + [sequence_by]).issubset(frame.columns):
        raise ValueError("Schema is missing contract columns")
    for field in frame.schema.fields:
        identifier(field.name)
        if not isinstance(field.dataType, AtomicType):
            raise ValueError("Only flat scalar columns are supported")
        if field.dataType.typeName() in ("float", "double"):
            if frame.where(F.isnan(F.col(field.name)) | (F.abs(F.col(field.name)) == float("inf"))).limit(1).count():
                raise ValueError("Non-finite values are unsupported")
    if frame.schema[sequence_by].dataType.typeName() not in ("byte", "short", "integer", "long", "decimal", "date", "timestamp", "timestamp_ntz"):
        raise ValueError("Sequence must be an integer, decimal, date or timestamp")
    null_condition = reduce(lambda left, right: left | right, [F.col(column).isNull() for column in keys + [sequence_by]])
    if frame.where(null_condition).limit(1).count():
        raise ValueError("Null merge key or sequence")
    if target and frame.groupBy(*keys).count().where(F.col("count") > 1).limit(1).count():
        raise ValueError("Target merge keys are not unique")


def deduplicate_latest(frame, keys: list[str], sequence_by: str):
    from pyspark.sql import Window
    from pyspark.sql import functions as F

    validate_frame(frame, keys, sequence_by)
    unique = frame.dropDuplicates()
    if unique.groupBy(*(keys + [sequence_by])).count().where(F.col("count") > 1).limit(1).count():
        raise ValueError("Conflicting rows with the same key and sequence")
    window = Window.partitionBy(*keys).orderBy(F.col(sequence_by).desc())
    return unique.withColumn("__harness_rank", F.row_number().over(window)).where(F.col("__harness_rank") == 1).drop("__harness_rank")


def qualified_table(value: str) -> str:
    part = r"(?:[A-Za-z_][A-Za-z0-9_]*|" + chr(96) + r"[A-Za-z0-9_-]+" + chr(96) + ")"
    if not re.fullmatch(part + r"\." + part + r"\." + part, value):
        raise ValueError("Use a qualified catalog.schema.table name")
    return value


def run(source_table: str, target_table: str, keys: list[str], sequence_by: str) -> None:
    from delta.tables import DeltaTable
    from pyspark.sql import SparkSession

    source_table, target_table = qualified_table(source_table), qualified_table(target_table)
    if source_table.replace(chr(96), "").lower() == target_table.replace(chr(96), "").lower():
        raise ValueError("Source and target tables must differ")
    spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
    source = spark.table(source_table)
    target = DeltaTable.forName(spark, target_table)
    target_frame = target.toDF()
    validate_frame(target_frame, keys, sequence_by, target=True)
    source_schema = {field.name: field.dataType.simpleString() for field in source.schema.fields}
    target_schema = {field.name: field.dataType.simpleString() for field in target_frame.schema.fields}
    if source_schema != target_schema:
        raise ValueError("Schema mismatch; automatic schema evolution is not permitted")
    updates = deduplicate_latest(source, keys, sequence_by).persist()
    try:
        execute_merge(target, updates, keys, sequence_by, source.columns)
    finally:
        updates.unpersist()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-table", required=True)
    parser.add_argument("--target-table", required=True)
    parser.add_argument("--keys", required=True)
    parser.add_argument("--sequence-by", required=True)
    parser.add_argument("--execute", action="store_true", help="Explicitly authorize the previously reviewed data write")
    args = parser.parse_args()
    if not args.execute:
        parser.error("No write performed. Review the target/data-write approval before passing --execute.")
    run(args.source_table, args.target_table, args.keys.split(","), args.sequence_by)
`;
}

function dataUpdateResource(plan) {
  const key = plan.name.replaceAll("-", "_");
  return `# UNAPPROVED STARTER: configure approved compute, identities and target variables.
# The task intentionally omits --execute; add it only after data-write approval.
variables:
  ${key}_source_table:
    description: Fully qualified source Delta table
  ${key}_target_table:
    description: Fully qualified target Delta table

resources:
  jobs:
    ${key}:
      name: "[\${bundle.target}] ${plan.name}"
      max_concurrent_runs: 1
      timeout_seconds: 3600
      queue:
        enabled: true
      tasks:
        - task_key: merge_updates
          spark_python_task:
            python_file: ../src/data_products/${plan.name}/job.py
            parameters:
              - --source-table
              - \${var.${key}_source_table}
              - --target-table
              - \${var.${key}_target_table}
              - --keys
              - ${plan.keys.join(",")}
              - --sequence-by
              - ${plan.sequenceBy}
          timeout_seconds: 3600
          max_retries: 2
          min_retry_interval_millis: 60000
`;
}

function dataUpdateTest(plan) {
  return `import importlib.util
import json
from pathlib import Path
import unittest

MODULE = Path(__file__).parents[2] / "src" / "data_products" / "${plan.name}" / "job.py"
SPEC = importlib.util.spec_from_file_location("generated_merge", MODULE)
MERGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MERGE)
FIXTURES = json.loads(Path(__file__).with_suffix(".fixtures.json").read_text(encoding="utf-8"))


class RecordingDelta:
    def __init__(self):
        self.calls = []

    def alias(self, name):
        return self

    def merge(self, updates, condition):
        self.calls.append(("merge", condition))
        return self

    def whenMatchedUpdate(self, **kwargs):
        self.calls.append(("guard", kwargs))
        return self

    def whenMatchedUpdateAll(self, **kwargs):
        self.calls.append(("update", kwargs))
        return self

    def whenNotMatchedInsertAll(self):
        self.calls.append(("insert", None))
        return self

    def execute(self):
        self.calls.append(("execute", None))
        return "executed"


class MergeContractTest(unittest.TestCase):
    def test_executable_fixture_contracts(self):
        for case in FIXTURES["cases"]:
            with self.subTest(case=case["id"]):
                args = (case["target"], case["source"], FIXTURES["keys"], FIXTURES["sequenceBy"])
                if "error" in case:
                    with self.assertRaisesRegex(ValueError, case["error"]):
                        MERGE.merge_records(*args)
                else:
                    self.assertEqual(MERGE.merge_records(*args), case["expected"])

    def test_real_delta_builder_has_atomic_guards(self):
        target, source = RecordingDelta(), RecordingDelta()
        keys, sequence = FIXTURES["keys"], FIXTURES["sequenceBy"]
        columns = list(FIXTURES["cases"][0]["source"][0])
        predicates = MERGE.merge_predicates(keys, sequence, columns)
        self.assertEqual(MERGE.execute_merge(target, source, keys, sequence, columns), "executed")
        self.assertEqual([item[0] for item in target.calls], ["merge", "guard", "guard", "update", "insert", "execute"])
        self.assertEqual(target.calls[0][1], predicates["match"])
        self.assertEqual(target.calls[1][1]["condition"], predicates["stale"])
        self.assertIn("raise_error('HARNESS_STALE_UPDATE')", target.calls[1][1]["set"].values())
        self.assertEqual(target.calls[2][1]["condition"], predicates["conflict"])
        self.assertIn("raise_error('HARNESS_CONFLICTING_SEQUENCE')", target.calls[2][1]["set"].values())
        self.assertEqual(target.calls[3][1], {"condition": predicates["newer"]})
        self.assertIn(" <=> ", predicates["conflict"])

    def test_identifiers_fail_closed(self):
        for keys in ([], ["id", "id"], ["id; DROP TABLE x"], ["__harness_rank"], ["__HARNESS_RANK"]):
            with self.subTest(keys=keys), self.assertRaises(ValueError):
                MERGE.merge_condition(keys)
        with self.assertRaises(ValueError):
            MERGE.validate_contract(["id"], "id")
        with self.assertRaises(ValueError):
            MERGE.qualified_table("catalog.schema.table.extra")

    def test_replay_does_not_mutate_input(self):
        case = FIXTURES["cases"][0]
        original = json.loads(json.dumps(case["source"]))
        once = MERGE.merge_records([], original, FIXTURES["keys"], FIXTURES["sequenceBy"])
        self.assertEqual(MERGE.merge_records(once, original, FIXTURES["keys"], FIXTURES["sequenceBy"]), once)
        self.assertEqual(original, case["source"])


if __name__ == "__main__":
    unittest.main()
`;
}

function dataUpdateFixtures(plan) {
  let payload = "payload";
  while ([...plan.keys, plan.sequenceBy].includes(payload)) payload = `_${payload}`;
  const row = (sequence, value = "one", suffix = "one") => ({ ...Object.fromEntries(plan.keys.map((key) => [key, `${key}-${suffix}`])), [plan.sequenceBy]: sequence, [payload]: value });
  const first = row(1), second = row(2, "two");
  let unexpected = "unexpected_column";
  while ([...plan.keys, plan.sequenceBy, payload].includes(unexpected)) unexpected = `_${unexpected}`;
  return { schemaVersion: 1, keys: plan.keys, sequenceBy: plan.sequenceBy, cases: [
    { id: "insert", target: [], source: [first], expected: [first] },
    { id: "latest-per-key", target: [], source: [first, second, second], expected: [second] },
    { id: "newer-update", target: [first], source: [second], expected: [second] },
    { id: "exact-replay", target: [first], source: [first, first], expected: [first] },
    { id: "empty-no-op", target: [first], source: [], expected: [first] },
    { id: "stale-update", target: [second], source: [first], error: "Stale update rejected" },
    { id: "source-tie-conflict", target: [], source: [first, row(1, "conflict"), second], error: "Conflicting rows" },
    { id: "target-tie-conflict", target: [first], source: [row(1, "conflict")], error: "Conflicting rows" },
    ...plan.keys.map((key) => ({ id: `null-key-${key}`, target: [], source: [{ ...first, [key]: null }], error: "Null or missing merge key" })),
    { id: "null-sequence", target: [], source: [{ ...first, [plan.sequenceBy]: null }], error: "Null or missing sequence" },
    { id: "duplicate-target", target: [first, first], source: [], error: "Target merge keys are not unique" },
    { id: "schema-mismatch", target: [first], source: [{ ...second, [unexpected]: "x" }], error: "Schema mismatch" },
  ] };
}

function genieResource(plan) {
  const key = plan.name.replaceAll("-", "_");
  return `# DRAFT ONLY: deliberately outside resources/*.yml. Review before promotion.
variables:
  ${key}_warehouse_id:
    description: SQL warehouse for the ${plan.name} Genie space

resources:
  genie_spaces:
    ${key}:
      title: ${JSON.stringify(plan.description)}
      description: ${JSON.stringify(plan.description)}
      warehouse_id: \${var.${key}_warehouse_id}
      file_path: ../../src/genie/${plan.name}.geniespace.json
`;
}

function metricYaml(plan) {
  const quote = (value) => JSON.stringify(value);
  return `version: 1.1
source: ${plan.sourceTable}
comment: ${quote(plan.description)}
dimensions:
${plan.dimensions.map((item) => `  - name: ${quote(item.name)}\n    expr: ${quote(item.expression)}`).join("\n")}
measures:
${plan.measures.map((item) => `  - name: ${quote(item.name)}\n    expr: ${quote(item.expression)}`).join("\n")}
`;
}

function metricSql(plan) {
  const key = plan.name.replaceAll("-", "_");
  return `-- DRAFT ONLY. The harness never executes this SQL.
-- Validate source/YAML, review SHOW CREATE diff and approve the target/DDL change first.
CREATE OR REPLACE VIEW \${catalog}.\${schema}.${key}
WITH METRICS
LANGUAGE YAML
AS $$
-- Generated from src/metrics/${plan.name}.metric.yml; keep the YAML source authoritative.
${metricYaml(plan)}$$;
`;
}

async function applyLocalPlan(root, plan) {
  const artifacts = [];
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  if (plan.kind === "data-update") {
    const testName = `tests/data_products/test_${plan.name.replaceAll("-", "_")}`;
    artifacts.push([`src/data_products/${plan.name}/job.py`, dataUpdatePython(plan)]);
    artifacts.push([`resources/${plan.name}.job.yml`, dataUpdateResource(plan)]);
    artifacts.push([`${testName}.py`, dataUpdateTest(plan)]);
    artifacts.push([`${testName}.fixtures.json`, json(dataUpdateFixtures(plan))]);
    artifacts.push([`src/data_products/${plan.name}/README.md`, `# ${plan.name}: unapproved data-update starter\n\nNo Databricks resource or data was changed by scaffolding.\n\nRun local executable contracts with:\n\n\`\`\`text\npython -m unittest discover -s tests/data_products -p "test_${plan.name.replaceAll("-", "_")}.py" -v\n\`\`\`\n\nThe generated job requires an explicit --execute flag, deliberately absent from the resource template. Do not add it until the target and data-write scope are approved. Configure approved compute, identity and target variables; run strict bundle validation and Delta integration tests in an isolated dev schema. Standard-library tests verify the semantic reference and actual MERGE builder, not the Databricks runtime.\n\nContract: reject null keys/sequence, conflicting same-sequence payloads and stale updates; exact replay is a no-op. Latest source version wins within a batch, but conflicting ties at any source version are rejected. Source and target must have identical flat scalar schemas, a non-null integer/decimal/date/timestamp sequence, unique target keys and an exclusive target writer. No delete or automatic schema evolution is supported. Review this policy for the product before deployment.\n`]);
  } else if (plan.kind === "genie") {
    artifacts.push([`src/genie/${plan.name}.geniespace.json`, json({ version: 2, data_sources: { tables: plan.tables.map((identifier) => ({ identifier })) } })]);
    artifacts.push([`resources/drafts/${plan.name}.genie_space.yml`, genieResource(plan)]);
    artifacts.push([`tests/genie/${plan.name}.benchmark.json`, json({ schemaVersion: 1, status: "draft", deployReady: false, space: plan.name, cases: plan.questions.map((question, index) => ({ id: `Q-${String(index + 1).padStart(2, "0")}`, question, paraphrases: [], expected: { answerCriteria: [], sqlAssertions: [] } })) })]);
    artifacts.push([`src/genie/${plan.name}.readiness.json`, json({ status: "draft", deployReady: false, remainingWork: plan.remainingWork })]);
  } else if (plan.kind === "metric-view") {
    artifacts.push([`src/metrics/${plan.name}.metric.yml`, metricYaml(plan)]);
    artifacts.push([`src/metrics/${plan.name}.draft.sql`, metricSql(plan)]);
    artifacts.push([`tests/metrics/${plan.name}.contract.json`, json({ schemaVersion: 1, status: "draft", deployReady: false, sourceTable: plan.sourceTable, dimensions: plan.dimensions.map((item) => item.name), measures: plan.measures.map((item) => item.name), requiredChecks: ["schema", "MEASURE parity", "null boundaries", "time boundaries", "remote SHOW CREATE diff"], remainingWork: plan.remainingWork })]);
  }
  for (const [relativePath] of artifacts) {
    if (await exists(pathInside(root, relativePath, "generated artifact"))) throw new Error(`Refusing to overwrite generated artifact: ${relativePath}`);
  }
  const files = [];
  for (const [relativePath, content] of artifacts) {
    files.push(await writeGenerated(root, relativePath, content));
    plan.generatedFiles = [...files];
  }
  return files;
}

export async function applyScaffold(root, options, dependencies = {}) {
  if (!options.plan) throw new Error("scaffold apply requires --plan.");
  if (options.yes !== true) throw new Error("Review the plan, then pass --yes to apply local scaffold changes.");
  const initial = await resolvePlan(root, options.plan);
  return withFileLock(initial.path, async () => {
    const { plan } = await resolvePlan(root, options.plan);
    if (!KINDS.has(plan.kind) || !/^[a-z0-9][a-z0-9-]*$/.test(plan.name ?? "")) throw new Error("Invalid scaffold output identity.");
    const outputLock = pathInside(root, `.harness/runtime/scaffold-targets/${plan.kind}-${plan.name}`, "scaffold target lock");
    // Separate plans can target the same output. Hold both locks through external
    // generation and validation; existing output checks alone have a TOCTOU race.
    return withFileLock(outputLock, () => applyScaffoldLocked(root, options, dependencies));
  });
}

async function applyScaffoldLocked(root, options, dependencies) {
  const { path, plan } = await resolvePlan(root, options.plan);
  if (!["ready", "draft-ready"].includes(plan.status) || plan.missing?.length) throw new Error(`Scaffold plan is not ready: ${plan.missing?.join(", ") || plan.status}`);
  const { integrityHash, ...record } = plan;
  if (!integrityHash || sha256(JSON.stringify(record)) !== integrityHash) throw new Error("Scaffold plan changed after planning; regenerate and review it.");
  if (!KINDS.has(plan.kind) || plan.deployReady !== false) throw new Error("Invalid scaffold safety contract.");
  if (plan.kind === "app" && (!plan.profile || !plan.host || !plan.workspaceVerification)) {
    plan.status = "needs-replan";
    plan.failureStage = "capability";
    plan.failure = "App init requires an explicitly verified development profile and host; regenerate legacy plans before init.";
    plan.updatedAt = timestamp();
    await writeJson(path, plan);
    throw new Error(plan.failure);
  }
  for (const item of plan.evidenceFiles ?? []) {
    const evidencePath = pathInside(root, item.path, "scaffold evidence");
    if (!(await exists(evidencePath)) || !(await stat(evidencePath)).isFile() || sha256(await readFile(evidencePath)) !== item.sha256) {
      plan.status = "needs-replan";
      plan.failureStage = "evidence";
      plan.failure = `Scaffold evidence changed; re-plan before init: ${item.path}`;
      plan.updatedAt = timestamp();
      await writeJson(path, plan);
      throw new Error(`Scaffold evidence changed; re-plan before init: ${item.path}`);
    }
  }
  let files = [];
  let stage = "local-generation";
  plan.status = "applying";
  plan.updatedAt = timestamp();
  await writeJson(path, plan);
  try {
    if (plan.kind === "app") {
      stage = "workspace-auth";
      plan.workspaceVerification = await verifyAppWorkspace(root, plan.profile, workspaceHost(plan.host), plan.purpose, dependencies);
      stage = "init";
      if (plan.outputDir !== `apps/${plan.name}`) throw new Error("Invalid component output directory.");
      const output = pathInside(root, plan.outputDir, "AppKit output directory");
      if (await exists(output)) throw new Error(`App output already exists: ${plan.outputDir}`);
      const run = dependencies.run ?? commandResult;
      const command = appCommand(plan);
      const env = appEnvironment(plan.purpose);
      const result = await run(command[0], command.slice(1), { cwd: root, timeout: 10 * 60_000, env });
      if (!result.ok) throw new Error(`AppKit scaffold failed: ${redactedFailure(result.stderr || result.error || result.stdout)}`);
      files = [plan.outputDir];
      plan.generatedFiles = files;
      plan.initCompletedAt = timestamp();
      if (plan.purpose === "mock") {
        const bundle = join(output, "databricks.yml");
        const quarantine = join(output, "databricks.fixture-only.yml");
        if (await exists(bundle)) {
          if (await exists(quarantine)) throw new Error("Refusing to overwrite existing fixture-only bundle configuration.");
          await rename(bundle, quarantine);
        }
        await writeJson(join(output, ".harness-fixture-only.json"), { schemaVersion: 1, purpose: "mock", deployReady: false,
          instruction: "Development workspace authentication is not approval to connect business data. Use fixtures only; no bundle deployment before a separate approved integration plan." });
      }
      stage = "validate";
      const validationCommand = ["databricks", "apps", "validate", "--path", plan.outputDir, ...(plan.profile ? ["--profile", plan.profile] : [])];
      const validate = await run(validationCommand[0], validationCommand.slice(1), { cwd: root, timeout: 15 * 60_000, env });
      plan.validation = { command: validationCommand, status: validate.ok ? "passed" : "failed", exitCode: validate.status ?? null, checkedAt: timestamp() };
      if (!validate.ok) throw new Error(`AppKit scaffold validation failed: ${redactedFailure(validate.stderr || validate.error || validate.stdout)}`);
      if (!(await exists(join(output, "package.json")))) throw new Error("AppKit validation reported success but the generated package.json is missing.");
      plan.pendingRules = plan.rules.filter((item) => item.phase !== "before-init" && item.severity === "must").map((item) => item.id);
    } else files = await applyLocalPlan(root, plan);
  } catch (error) {
    plan.status = "failed";
    plan.failureStage = stage;
    plan.failure = redactedFailure(error.message);
    plan.generatedFiles = plan.generatedFiles ?? files;
    plan.updatedAt = timestamp();
    await writeJson(path, plan);
    throw new Error(plan.failure);
  }
  plan.status = ["genie", "metric-view"].includes(plan.kind) ? "draft-generated" : "applied";
  plan.appliedAt = timestamp();
  plan.updatedAt = plan.appliedAt;
  plan.generatedFiles = files;
  await writeJson(path, plan);
  console.log(JSON.stringify({ plan: repoRelative(root, path), status: plan.status, generatedFiles: files }, null, 2));
  return plan;
}
