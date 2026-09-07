import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
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

const walkthroughPath = "docs/harness/operations/SETUP_WALKTHROUGH.md";
async function onboardingSources() {
  const [guide, html, cli, shell, powershell] = await Promise.all([
    walkthroughPath, "docs/site/index.html", "tools/harness.mjs", "scripts/setup.sh", "scripts/setup.ps1",
  ].map((path) => readFile(join(root, path), "utf8")));
  return { guide, html, cli, shell, powershell };
}

test("onboarding distinguishes template clone, script-owned root and incomplete application setup", async () => {
  const { guide, html, shell, powershell, cli } = await onboardingSources();
  assert.match(guide, /空のディレクトリでsetup\.shを実行するだけではありません/);
  assert.match(guide, /スクリプト自身があるrepoを初期化/);
  assert.match(guide, /LocalPathを拒否/);
  assert.match(shell, /node "\$REPOSITORY_ROOT\/tools\/harness\.mjs" setup/);
  assert.match(powershell, /Join-Path \$PSScriptRoot "\.\."/);
  const setupBody = cli.slice(cli.indexOf("async function setup(options)"), cli.indexOf("async function sessionRecords()"));
  assert.doesNotMatch(setupBody, /npm (?:ci|install)|apps.*init/);
  for (const document of [guide, html]) {
    assert.match(document, /npm ci/);
    assert.match(document, /アプリ.*依存/);
    assert.match(document, /インストールしません/);
    assert.match(document, /Claude Code/);
    assert.match(document, /GitHub Copilot/);
  }
});

test("onboarding JSON examples match between Markdown and HTML and contain declared Bundle variables", async () => {
  const { guide, html, cli } = await onboardingSources();
  const markdownExample = JSON.parse(guide.match(/```json\s*([\s\S]*?)```/)[1]);
  const htmlExample = JSON.parse(html.match(/<pre class="setup-example"><code>(\{[\s\S]*?\})<\/code>/)[1]);
  assert.deepEqual(htmlExample, markdownExample);
  assert.deepEqual(Object.keys(markdownExample).sort(), ["catalog", "dev_suffix", "schema", "team_root"]);
  const variables = cli.slice(cli.indexOf("variables:\n"), cli.indexOf("targets:\n"));
  for (const key of Object.keys(markdownExample)) assert.match(variables, new RegExp(`\\n  ${key}:`));
  for (const document of [guide, html]) {
    assert.ok(document.includes(".databricks/bundle/dev/variable-overrides.json"));
    assert.match(document, /自動読込/);
    assert.match(document, /自動継承/);
  }
  assert.match(await readFile(join(root, ".gitignore"), "utf8"), /^\.databricks\/$/m);
});

test("onboarding setup examples use origin-only hosts, consistent explicit profiles and installed-agent defaults", async () => {
  const { guide, html } = await onboardingSources();
  const commands = (text) => [...text.matchAll(/(?:\.\\scripts\\(?:setup|new-project)\.ps1|bash scripts\/setup\.sh)[^\n<]*/g)].map((match) => match[0]);
  const markdownCommands = commands(guide);
  const htmlCommands = commands(html);
  assert.equal(markdownCommands.length, 3);
  assert.deepEqual(htmlCommands, markdownCommands);
  for (const command of markdownCommands) {
    const host = command.match(/(?:-HostUrl|--host) (\S+)/)[1];
    assert.equal(new URL(host).origin, host);
    const profile = command.match(/(?:-Profile|--profile) (\S+)/)[1];
    assert.equal(profile, "harness-dev");
    assert.doesNotMatch(command, /DEFAULT|-InstallExtensions/);
  }
});

test("onboarding keeps dev isolation explicit and includes no deployment or resource-creation commands", async () => {
  const { guide, html, cli } = await onboardingSources();
  assert.ok(cli.includes("root_path: /Workspace/Users/"));
  assert.ok(cli.includes("root_path: \\${var.team_root}/\\${bundle.name}/\\${bundle.target}"));
  assert.ok(guide.includes("root_path: ${var.team_root}/${bundle.name}/${bundle.target}/${var.dev_suffix}"));
  for (const document of [guide, html]) {
    assert.match(document, /dev.*配置先.*変わりません/);
    assert.match(document, /非商用/);
    assert.match(document, /service principal/);
    assert.match(document, /Connection Details/);
  }
  const executableExamples = [...guide.matchAll(/```(?:text|powershell|bash)\s*([\s\S]*?)```/g)].map((m) => m[1]).join("\n");
  assert.doesNotMatch(executableExamples, /databricks (?:bundle (?:deploy|run|destroy)|(?:apps|schemas|catalogs|warehouses) create)/);
  assert.doesNotMatch(executableExamples, /DATABRICKS_TOKEN|--token|--debug/);
});

test("guide copy button copies the complete command block, not explanatory inline code", async () => {
  const script = await readFile(join(root, "docs/site/guide.js"), "utf8");
  const command = "Set-Location D:\\projects\\sales-operations\nnpm ci --ignore-scripts";
  let handler, copied;
  const announcement = { textContent: "" };
  const button = {
    parentElement: { querySelector: (selector) => ({ textContent: selector === "pre code" ? command : "gh auth login" }) },
    addEventListener: (event, callback) => { if (event === "click") handler = callback; },
  };
  runInNewContext(script, {
    document: { querySelectorAll: (selector) => selector === ".copy" ? [button] : [], getElementById: () => announcement },
    navigator: { clipboard: { writeText: async (text) => { copied = text; } } },
    window: {},
  });
  await handler();
  assert.equal(copied, command);
  assert.match(announcement.textContent, /コピーしました/);
});
