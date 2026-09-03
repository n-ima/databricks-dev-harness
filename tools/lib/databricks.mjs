import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import {
  cleanInline,
  commandResult,
  exists,
  parseVersion,
  readJson,
  versionAtLeast,
  writeJson,
  redact,
} from "./shared.mjs";

const MINIMUM_CLI = [1, 6, 0];
const MAXIMUM_CLI_EXCLUSIVE = [2, 0, 0];

const CLOUD_CREDENTIAL_ENV = new Set([
  "ARM_CLIENT_ID", "ARM_CLIENT_SECRET", "ARM_TENANT_ID", "ARM_USE_MSI",
  "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID", "AZURE_FEDERATED_TOKEN_FILE",
  "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_WEB_IDENTITY_TOKEN_FILE", "AWS_ROLE_ARN",
  "ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "SYSTEM_ACCESSTOKEN", "CI_JOB_JWT", "CI_JOB_JWT_V2",
]);

function credentialOverride(name) {
  const key = name.toUpperCase();
  return (/^DATABRICKS_/.test(key) && key !== "DATABRICKS_CONFIG_FILE") || CLOUD_CREDENTIAL_ENV.has(key);
}

export function profileEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !credentialOverride(name)));
}

function defaultRun(command, args, options) {
  return commandResult(command, args, options);
}

function executable(options) {
  return cleanInline(options.databricks_command || process.env.HARNESS_DATABRICKS_COMMAND, "databricks");
}

function parseJsonOutput(result, label) {
  if (!result.ok) {
    throw new Error(`${label} failed (exit ${result.status ?? "unavailable"}). Inspect the CLI locally; credential-bearing output is not persisted.`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function validateProfile(profile, allowDefault = false) {
  if (!profile) throw new Error("Specify --profile. The harness never auto-selects a Databricks profile.");
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(profile)) throw new Error("Invalid Databricks profile name.");
  if (profile.toUpperCase() === "DEFAULT" && !allowDefault) {
    throw new Error('Profile "DEFAULT" requires --allow-default because descriptive profiles are safer.');
  }
  return profile;
}

function validateHost(host) {
  let parsed;
  try {
    parsed = new URL(host);
  } catch {
    throw new Error("--host must be a valid HTTPS Databricks workspace URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("--host must be an HTTPS workspace origin without credentials or a path.");
  }
  return parsed.origin;
}

async function localConfig(root) {
  const path = join(root, ".harness", "local.json");
  return (await exists(path)) ? await readJson(path) : null;
}

export function listProfiles(options = {}, dependencies = {}) {
  const run = dependencies.run ?? defaultRun;
  const result = run(executable(options), ["auth", "profiles", "--skip-validate", "-o", "json"], {
    cwd: dependencies.root,
    timeout: 60_000,
    env: profileEnvironment(),
  });
  const payload = parseJsonOutput(result, "databricks auth profiles");
  return Array.isArray(payload.profiles) ? payload.profiles : [];
}

function safeAuthSummary(payload) {
  return {
    status: payload?.status ?? "unknown",
    authType: payload?.details?.auth_type || payload?.auth_type || "unknown",
  };
}

function safeUserSummary(payload) {
  return {
    userName: payload?.user_name ?? payload?.userName ?? null,
    displayName: payload?.display_name ?? payload?.displayName ?? null,
    active: payload?.active ?? null,
  };
}

function verifyAuthHost(payload, profile, expectedHost) {
  if (payload.status !== "success" || payload.error || payload.account_id) throw new Error(`Authentication check failed for ${profile}.`);
  if (!payload.details?.host || validateHost(payload.details.host) !== expectedHost) throw new Error(`Authenticated profile ${profile} resolved an unexpected workspace host.`);
  const reportedProfile = payload.details.configuration?.profile?.value;
  if (reportedProfile && reportedProfile !== profile) throw new Error("Authentication resolved an unexpected profile.");
}

export async function connectDatabricks(root, options = {}, dependencies = {}) {
  const runner = dependencies.run ?? defaultRun;
  const run = (command, args, execution = {}) => runner(command, args, { ...execution, env: profileEnvironment() });
  const profile = validateProfile(cleanInline(options.profile), Boolean(options.allow_default));
  const host = validateHost(cleanInline(options.host));
  const command = executable(options);
  const conflicts = environmentConflicts();
  if (conflicts.length) throw new Error(`Explicit-profile connection requires clearing credential overrides first: ${conflicts.join(", ")}. Values were not printed.`);

  if (options.auth) {
    const login = run(command, ["auth", "login", "--host", host, "--profile", profile], {
      cwd: root,
      stdio: "inherit",
      timeout: 10 * 60_000,
    });
    if (!login.ok) throw new Error("Databricks OAuth login did not complete.");
  }

  const profiles = listProfiles(options, { run, root });
  const selected = profiles.find((item) => item.name === profile);
  if (!selected) throw new Error(`Profile ${profile} was not found. Re-run with --auth.`);
  if (!selected.host) throw new Error(`Profile ${profile} has no workspace host.`);
  if (selected.host && validateHost(selected.host) !== host) {
    throw new Error(`Profile ${profile} points to ${selected.host}, not ${host}.`);
  }

  const authPayload = parseJsonOutput(
    run(command, ["auth", "describe", "--profile", profile, "-o", "json"], { cwd: root }),
    "databricks auth describe",
  );
  verifyAuthHost(authPayload, profile, host);
  const userPayload = parseJsonOutput(
    run(command, ["current-user", "me", "--profile", profile, "-o", "json"], { cwd: root }),
    "databricks current-user me",
  );
  const user = safeUserSummary(userPayload);
  if (!user.userName) throw new Error("Workspace reached, but current user identity was unavailable.");

  const configuredAt = new Date().toISOString();
  await writeJson(join(root, ".harness", "local.json"), {
    schemaVersion: 1,
    profile,
    host,
    configuredAt,
    verifiedAt: configuredAt,
    authType: safeAuthSummary(authPayload).authType,
  });

  const summary = { profile, host, user, auth: safeAuthSummary(authPayload), verifiedAt: configuredAt };
  console.log(options.json ? JSON.stringify(summary, null, 2) : `Connected ${profile} (${host}) as ${user.userName}.`);
  return summary;
}

function addCheck(checks, id, status, detail, remediation = null) {
  checks.push({ id, status, detail: redact(cleanInline(detail)), ...(remediation ? { remediation } : {}) });
}

function commandVersionCheck(checks, id, command, args, minimum, run, root, optional = false, maximumExclusive = null) {
  const result = run(command, args, { cwd: root, timeout: 30_000 });
  if (!result.ok) {
    addCheck(checks, id, optional ? "warn" : "fail", `${command} is not executable`, `Install ${command} if using its headless adapter. VS Code extensions are checked separately.`);
    return null;
  }
  const firstLine = cleanInline(result.stdout || result.stderr).split(" ").slice(0, 8).join(" ");
  if (minimum) {
    const version = parseVersion(firstLine);
    if (!version || !versionAtLeast(version, minimum) || (maximumExclusive && versionAtLeast(version, maximumExclusive))) {
      addCheck(checks, id, "fail", `${firstLine}; required >= ${minimum.join(".")}${maximumExclusive ? ` < ${maximumExclusive.join(".")}` : ""}`);
      return null;
    }
  }
  addCheck(checks, id, "pass", firstLine);
  return firstLine;
}

function environmentConflicts() {
  return Object.keys(process.env).filter((name) => credentialOverride(name) && process.env[name]);
}

export async function doctorDatabricks(root, options = {}, dependencies = {}) {
  const runner = dependencies.run ?? defaultRun;
  const run = (command, args, execution = {}) => runner(command, args, { ...execution, env: profileEnvironment() });
  const checks = [];
  const config = await readJson(join(root, "harness.config.json"));
  const local = await localConfig(root);
  const command = executable(options);

  const nodeVersion = parseVersion(process.version);
  addCheck(
    checks,
    "node-version",
    nodeVersion && versionAtLeast(nodeVersion, [22, 0, 0]) ? "pass" : "fail",
    `${process.version}; required >= 22.0.0`,
  );
  commandVersionCheck(checks, "git", "git", ["--version"], null, run, root);
  const cliVersion = commandVersionCheck(checks, "databricks-cli", command, ["-v"], MINIMUM_CLI, run, root, false, MAXIMUM_CLI_EXCLUSIVE);
  const claude = commandVersionCheck(checks, "claude-code", "claude", ["--version"], null, run, root, true);
  const copilot = commandVersionCheck(checks, "copilot-cli", "copilot", ["--version"], null, run, root, true);
  if (!claude && !copilot) addCheck(checks, "agent-provider", "warn", "No headless agent CLI found. Verify the intended VS Code extension and sign-in in VS Code.");
  else addCheck(checks, "agent-provider", "pass", "At least one local agent provider is available.");

  const vendorLock = join(root, "vendor", "databricks-skills.lock.json");
  addCheck(
    checks,
    "databricks-skills",
    (await exists(vendorLock)) ? "pass" : "fail",
    (await exists(vendorLock)) ? "Official skills lock is present." : "Official skills lock is missing.",
  );

  const conflicts = environmentConflicts();
  addCheck(
    checks,
    "credential-precedence",
    conflicts.length ? "fail" : "pass",
    conflicts.length
      ? `Environment overrides are set: ${conflicts.join(", ")}. Values were not read or printed.`
      : "No Databricks credential environment override detected.",
  );

  let profile = cleanInline(options.profile);
  if (!profile && options.use_project_profile && local?.profile) profile = local.profile;
  if (!profile) {
    if (cliVersion) {
      try {
        const profiles = listProfiles(options, { run, root });
        addCheck(
          checks,
          "profile-selection",
          "warn",
          profiles.length
            ? `No profile selected. Available profiles (not authenticated): ${profiles.map((item) => `${item.name} (${item.host})`).join(", ")}`
            : "No Databricks profiles are configured.",
          "Choose explicitly with --profile or run harness connect.",
        );
      } catch (error) {
        addCheck(checks, "profile-selection", "warn", error.message);
      }
    }
  } else {
    try {
      if (!cliVersion) throw new Error("A supported Databricks CLI >= 1.6.0 < 2.0.0 is required before workspace checks.");
      if (conflicts.length) throw new Error("Clear credential environment overrides before validating an explicit profile.");
      profile = validateProfile(profile, Boolean(options.allow_default));
      const profiles = listProfiles(options, { run, root });
      const selected = profiles.find((item) => item.name === profile);
      if (!selected) throw new Error(`Profile ${profile} does not exist.`);
      if (!selected.host) throw new Error(`Profile ${profile} has no workspace host.`);
      const selectedHost = validateHost(selected.host);
      if (local?.host && selectedHost !== validateHost(local.host)) {
        throw new Error(`Project host ${local.host} differs from profile host ${selected.host}.`);
      }
      addCheck(checks, "profile-selection", "pass", `${profile} -> ${selected.host}`);

      const authPayload = parseJsonOutput(
        run(command, ["auth", "describe", "--profile", profile, "-o", "json"], { cwd: root }),
        "databricks auth describe",
      );
      const auth = safeAuthSummary(authPayload);
      verifyAuthHost(authPayload, profile, selectedHost);
      addCheck(checks, "oauth", "pass", `${auth.status}; ${auth.authType}`);

      const userPayload = parseJsonOutput(
        run(command, ["current-user", "me", "--profile", profile, "-o", "json"], { cwd: root }),
        "databricks current-user me",
      );
      const user = safeUserSummary(userPayload);
      if (!user.userName) throw new Error("Workspace reached, but selected profile identity was unavailable.");
      addCheck(checks, "workspace-reachability", user.userName ? "pass" : "fail", user.userName || "No user identity returned.");

      if (options.catalog) {
        const result = run(command, ["catalogs", "get", String(options.catalog), "--profile", profile, "-o", "json"], { cwd: root });
        addCheck(checks, "catalog-access", result.ok ? "pass" : "fail", result.ok ? String(options.catalog) : result.stderr || result.stdout);
      }
      if (options.schema) {
        const result = run(command, ["schemas", "get", String(options.schema), "--profile", profile, "-o", "json"], { cwd: root });
        addCheck(checks, "schema-access", result.ok ? "pass" : "fail", result.ok ? String(options.schema) : result.stderr || result.stdout);
      }
      if (options.warehouse) {
        const result = run(command, ["warehouses", "get", String(options.warehouse), "--profile", profile, "-o", "json"], { cwd: root });
        addCheck(checks, "warehouse-access", result.ok ? "pass" : "fail", result.ok ? String(options.warehouse) : result.stderr || result.stdout);
      }

      if (await exists(join(root, "databricks.yml"))) {
        const target = cleanInline(options.target, "dev");
        const result = run(command, ["bundle", "validate", "--strict", "-t", target, "--profile", profile], {
          cwd: root,
          timeout: 120_000,
        });
        addCheck(checks, "bundle-validate", result.ok ? "pass" : "fail", result.ok ? `target ${target}` : result.stderr || result.stdout);
      } else {
        addCheck(checks, "bundle-validate", "warn", "databricks.yml is not initialized in this template checkout.");
      }
    } catch (error) {
      addCheck(checks, "databricks-online", "fail", error.message, "Run harness connect with an explicit profile and host.");
    }
  }

  const failures = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warn").length;
  const report = {
    schemaVersion: 1,
    harnessVersion: config.harnessVersion,
    checkedAt: new Date().toISOString(),
    selectedProfile: profile || null,
    summary: { failures, warnings, passed: checks.length - failures - warnings },
    checks,
  };

  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Harness ${config.harnessVersion} doctor`);
    for (const item of checks) console.log(`${item.status.toUpperCase().padEnd(5)} ${item.id}: ${item.detail}`);
    console.log(`Summary: ${report.summary.passed} passed, ${warnings} warnings, ${failures} failed.`);
  }
  const strictFailure = failures > 0 || (options.strict && warnings > 0);
  if (strictFailure) process.exitCode = 1;
  return report;
}

export async function configuredDatabricks(root) {
  const local = await localConfig(root);
  if (!local) return null;
  const text = await readFile(join(root, ".harness", "local.json"), "utf8");
  return { ...JSON.parse(text), source: ".harness/local.json" };
}
