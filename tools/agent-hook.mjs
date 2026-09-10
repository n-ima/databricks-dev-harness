#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { activeAutoLoop } from "./lib/loop.mjs";
import { writeJson, timestamp, parseFrontmatter } from "./lib/shared.mjs";
import { resolveRoute } from "./lib/workloads.mjs";
import { workState, renderWorkState } from "./lib/work-state.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function stdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Malformed hook JSON; tool execution must not be pre-approved.");
  }
}

function parseArgs(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--")) continue;
    result[args[index].slice(2)] = args[index + 1]?.startsWith("--") ? true : args[++index] ?? true;
  }
  return result;
}

async function routePrompt(prompt) {
  return resolveRoute(root, prompt);
}

async function contextMessage() {
  const state = await workState(root, { session: options.session || process.env.HARNESS_SESSION_ID });
  return [
    "Databricks harness context:",
    "Read AGENTS.md and load the orchestrate-work skill for every non-trivial request.",
    "Treat chat as transport, not memory. Start/resume a work/sessions file and checkpoint it before handoff or completion.",
    "Harness design belongs under docs/harness/; target product design belongs under docs/product/.",
    renderWorkState(state),
  ].join("\n");
}

const forbidden = [
  {
    pattern: /\bdatabricks\b[^\n]*\bapps\s+deploy\b/i,
    reason: "App deployment requires explicit human execution of the reviewed plan.",
  },
  {
    pattern: /\bdatabricks\b[^\n]*\bbundle\s+(?:destroy|unbind)\b/i,
    reason: "Destructive Bundle operations require a human gate.",
  },
  {
    pattern: /\bdatabricks\b[^\n]*\bbundle\s+deploy\b/i,
    reason: "Production or unspecified-target deployment is a human gate. Explicit dev target and development credentials are required.",
    except: (command) => /(?:^|\s)(?:-t|--target)(?:=|\s+)["']?dev["']?(?:\s|$)/i.test(command) && !/(?:--profile|-p)(?:=|\s+)["']?(?:prod|production)\b/i.test(command),
  },
  {
    pattern: /\b(?:npm|pnpm|yarn|make|just|pwsh|powershell|bash|sh|node|python)\b[^\n]*(?:deploy[: _.\/-]?(?:prod|production)|release[: _.\/-]?prod|prod[-_.](?:deploy|release))\b/i,
    reason: "Production wrapper commands require a human gate.",
  },
  {
    pattern: /\bgit\b[^\n]*\b(?:push\b[^\n]*(?:--force(?:-with-lease)?|-f)(?:\s|$)|reset\s+--hard|clean\s+-[^\n]*f)/i,
    reason: "Force push and destructive Git cleanup require human execution.",
  },
  {
    pattern: /(?:\brm\s+[^\n]*(?:-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive)|\bRemove-Item\b[^\n]*-(?:Recurse|r)\b|\b(?:rmdir|rd)\s+[^\n]*\/s\b)/i,
    reason: "Recursive deletion requires a reviewed, exact-target human operation.",
  },
  {
    pattern: /\b(?:DROP\s+(?:TABLE|VIEW|CATALOG|SCHEMA|DATABASE)|TRUNCATE\b|GRANT\s+ALL|ALTER\s+(?:TABLE|SCHEMA|CATALOG|DATABASE)\b[^;\n]*\bOWNER)\b/i,
    reason: "Destructive data or broad permission changes require human execution.",
  },
  {
    pattern: /(?:--dangerously-skip-permissions|--allow-all(?:\s|$)|--no-sandbox|\bInvoke-Expression\b|\bIEX\b|\b(?:bash|powershell|pwsh)\b[^\n]*-(?:EncodedCommand|enc)\b)/i,
    reason: "Permission bypass, encoded commands, and opaque dynamic execution are not allowed in agent loops.",
  },
  {
    pattern: /\bdatabricks\s+bundle\s+destroy\b/i,
    reason: "Bundle destruction is a human gate. The human must run the reviewed command directly.",
  },
  {
    pattern: /\bdatabricks\s+bundle\s+deploy\b[^\n]*(?:(?:-t|--target)\s*=?\s*prod\b)/i,
    reason: "Production deployment is a human gate. The human must run the reviewed command directly.",
  },
  {
    pattern: /\bgit\s+push\b[^\n]*(?:--force(?:-with-lease)?|-f)\b/i,
    reason: "Force-push is blocked for agents.",
  },
  {
    pattern: /\brm\s+-[^\n]*r[^\n]*f\s+(?:\/|~|\$HOME)\s*(?:$|[;&|])/i,
    reason: "Broad recursive deletion is blocked for agents.",
  },
  {
    pattern: /\bRemove-Item\b[^\n]*-Recurse[^\n]*(?:\\|\$HOME)\s*(?:$|[;&|])/i,
    reason: "Broad recursive deletion is blocked for agents.",
  },
  {
    pattern: /\b(?:DROP\s+(?:CATALOG|SCHEMA|DATABASE)|GRANT\s+ALL|ALTER\s+OWNER)\b/i,
    reason: "Broad data or permission mutation requires explicit human execution after review.",
  },
];

function commandFromInput(input) {
  const args = input.toolArgs ?? input.tool_input ?? {};
  if (typeof args === "string") {
    try { return commandFromInput({ toolArgs: JSON.parse(args) }); } catch { return args; }
  }
  return [args.command, args.cmd, args.script, args.query].filter(Boolean).join("\n");
}

function deny(provider, reason) {
  // VS Code imports Copilot CLI and Claude hook configurations. Copilot CLI also
  // imports Claude settings. Emit one JSON object with both documented envelopes;
  // every envelope denies, and none can grant approval. Do not infer host from
  // the configured --provider or snake_case payload alone.
  const decision = { permissionDecision: "deny", permissionDecisionReason: reason };
  console.log(JSON.stringify({ ...decision, hookSpecificOutput: { hookEventName: "PreToolUse", ...decision } }));
}

function emitContext(event, message) {
  console.log(JSON.stringify({ additionalContext: message,
    hookSpecificOutput: { hookEventName: event, additionalContext: message } }));
}

const [action = "context", ...rawArgs] = process.argv.slice(2);
const options = parseArgs(rawArgs);
const provider = options.provider || "claude";
let input;
try { input = await stdinJson(); }
catch (error) { deny(provider, error.message); process.exit(0); }

if (action === "context") {
  const message = await contextMessage();
  emitContext("SessionStart", message);
} else if (action === "route") {
  const prompt = String(input.prompt ?? input.initialPrompt ?? input.initial_prompt ?? "");
  const selected = await routePrompt(prompt);
  emitContext("UserPromptSubmit", `Harness route: ${selected.id}. Load skill ${selected.skill}; first gate: ${selected.firstGate}. Workloads: ${selected.workload.selectedIds.join(", ") || "unknown"}. This is not execution approval. Start or resume a durable session before changing files.`);
} else if (action === "policy") {
  if (!input || typeof input !== "object" || Array.isArray(input)) { deny(provider, "Malformed tool hook payload."); process.exit(0); }
  let args = input.toolArgs ?? input.tool_input;
  const tool = String(input.toolName ?? input.tool_name ?? "").toLowerCase();
  if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = { command: args }; } }
  if (!tool || !args || typeof args !== "object" || Array.isArray(args)) { deny(provider, "Malformed tool hook payload."); process.exit(0); }
  if (/bash|powershell|terminal|execute/.test(tool) && ![args.command, args.cmd, args.script, args.query].some((value) => typeof value === "string" && value.trim())) { deny(provider, "A shell command must be a non-empty string."); process.exit(0); }
  const command = commandFromInput({ toolArgs: args }).replace(/\/\*[\s\S]*?\*\//g, " ");
  // Evaluate each segment separately: a safe dev segment must not exempt a later deploy.
  const segments = command.split(/[;\r\n|&]/);
  const violation = forbidden.find((item) => segments.some((segment) => item.pattern.test(segment) && !item.except?.(segment)));
  const targets = [args.file_path, args.filePath, args.path, args.filename, args.fileName].filter((value) => typeof value === "string");
  for (const collection of [args.replacements, args.edits, args.files]) {
    if (Array.isArray(collection)) for (const item of collection) {
      if (typeof item === "string") targets.push(item);
      else if (item && typeof item === "object") targets.push(...[item.file_path, item.filePath, item.path].filter(value => typeof value === "string"));
    }
  }
  if (/apply_patch/.test(tool)) for (const match of String(args.patch ?? args.input ?? args.command ?? "").matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) targets.push(match[1]);
  const protectedEdit = /edit|write|create|apply_patch|replace|insert|delete/.test(tool) && targets.some((target) => /(?:^|[\\/])(?:AGENTS\.md|harness\.config\.json|tools[\\/](?:agent-hook\.mjs|lib[\\/])|harness[\\/](?:evals|schemas|workloads\.json|router\.json)|\.claude[\\/]settings|\.github[\\/]hooks)/i.test(target));
  if (violation) deny(provider, violation.reason);
  else if (protectedEdit && process.env.HARNESS_LOOP_ID) deny(provider, "Autonomous loops may not change their policy, evaluator, or approval gates. Use a separate reviewed harness-maintenance change.");
  else if (provider === "copilot") console.log("{}");
} else if (action === "stop") {
  const loop = await activeAutoLoop(root);
  const matching = loop && (process.env.HARNESS_LOOP_ID === loop.state.id || process.env.HARNESS_SESSION_ID === loop.state.sessionId);
  if (!matching || loop.budget.exhausted || loop.state.gate?.status === "pending" || input.stop_hook_active || input.stopHookActive) console.log("{}");
  else {
    const session = await readFile(join(root, "work/sessions", `${loop.state.sessionId}.md`), "utf8");
    const fields = parseFrontmatter(session);
    const latest = loop.state.iterations.at(-1);
    const checkpointTime = Date.parse(fields.last_checkpoint || "");
    const stale = !Number.isFinite(checkpointTime) || (latest && checkpointTime < Date.parse(latest.startedAt));
    if (stale) console.log(JSON.stringify({ decision: "block", reason: "Checkpoint this durable session with verified state, evidence, blockers, and exact next action before stopping. Do not start another provider or bypass any human gate." }));
    else console.log("{}");
  }
} else if (action === "compact" || action === "failure") {
  // Metadata only: never store prompts, tool arguments, tool output, or credentials.
  if (process.env.HARNESS_SESSION_ID) {
    const id = process.env.HARNESS_SESSION_ID;
    if (!/^[\p{L}\p{N}_.-]+$/u.test(id)) throw new Error("Invalid session id in hook environment.");
    await writeJson(join(root, "work/hook-events", `${id}-${action}.json`), { schemaVersion: 1, sessionId: id, event: action, observedAt: timestamp(), checkpointRequired: true });
  }
  emitContext(action === "compact" ? "PreCompact" : "PostToolUseFailure", "Checkpoint the durable session; preserve only sanitized facts, evidence paths, blockers, and next actions. Hook metadata is not a semantic checkpoint.");
} else {
  console.log(provider === "copilot" ? "{}" : "");
}
