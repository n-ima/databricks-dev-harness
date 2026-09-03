import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { exists, readJson, sha256, writeJson } from "../tools/lib/shared.mjs";
import { stageVendorLegal, validateSkillsVersion, vendorLegalScope, vendorLegalSources, verifyVendorLegal } from "../tools/lib/vendor-legal.mjs";

const VERSION = "0.2.10";
const LICENSE = "Databricks License\r\nfixture copyright; no final newline";
const NOTICE = "Databricks attribution fixture.\n";

async function fixture(t) {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, "harness-vendor-legal-"));
  const staging = join(root, ".harness/runtime/staging");
  await mkdir(staging, { recursive: true });
  t.after(async () => {
    assert.ok(root.startsWith(`${base}${sep}`) && root.slice(base.length + 1).startsWith("harness-vendor-legal-"));
    await rm(root, { recursive: true, force: true });
  });
  return { root, staging };
}

function mockFetch(overrides = {}) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const name = url.split("/").at(-1);
    assert.ok(["LICENSE", "NOTICE"].includes(name), `Unexpected network request: ${url}`);
    if (Object.hasOwn(overrides, name)) return typeof overrides[name] === "function" ? overrides[name](url, options) : overrides[name];
    return new Response(name === "LICENSE" ? LICENSE : NOTICE, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  };
  return { fetch, calls };
}

async function installedFixture(t) {
  const context = await fixture(t);
  const legal = await stageVendorLegal(context.staging, VERSION, mockFetch());
  const vendor = join(context.root, "vendor/databricks-skills");
  await cp(context.staging, vendor, { recursive: true });
  await writeJson(join(context.root, "vendor/databricks-skills.lock.json"), { source: "https://github.com/databricks/databricks-agent-skills", resolvedVersion: VERSION, legal });
  return { ...context, legal, vendor };
}

test("legal sources require strict resolved semver and never accept branches, unknown versions or paths", async (t) => {
  const { staging } = await fixture(t);
  for (const version of ["unknown", "latest", "main", "v0.2.10", "0.2", "01.2.10", "0.2.10/path", "0.2.10\n", "0.2.10-01"]) {
    const fake = mockFetch();
    await assert.rejects(stageVendorLegal(staging, version, fake), /semver/);
    assert.equal(fake.calls.length, 0);
  }
  assert.equal(validateSkillsVersion("1.0.0-rc.1+build.4"), "1.0.0-rc.1+build.4");
  assert.deepEqual(vendorLegalSources(VERSION), {
    LICENSE: "https://raw.githubusercontent.com/databricks/databricks-agent-skills/v0.2.10/LICENSE",
    NOTICE: "https://raw.githubusercontent.com/databricks/databricks-agent-skills/v0.2.10/NOTICE",
  });
});

test("both legal files are acquired before writes, preserve exact bytes, and bind source URLs and scope hashes", async (t) => {
  const { staging } = await fixture(t);
  const fake = mockFetch();
  const legal = await stageVendorLegal(staging, VERSION, fake);
  assert.equal(fake.calls.length, 2);
  assert.ok(fake.calls.every((call) => call.options.redirect === "error" && call.options.signal instanceof AbortSignal));
  assert.equal(await readFile(join(staging, "LICENSE"), "utf8"), LICENSE);
  assert.equal(await readFile(join(staging, "NOTICE"), "utf8"), NOTICE);
  assert.equal(await readFile(join(staging, "THIRD_PARTY.md"), "utf8"), vendorLegalScope(VERSION));
  assert.equal(legal.sourceTag, "v0.2.10");
  assert.deepEqual(legal.files.LICENSE, { source: vendorLegalSources(VERSION).LICENSE, sha256: sha256(LICENSE), bytes: Buffer.byteLength(LICENSE) });
  assert.equal(legal.files["THIRD_PARTY.md"].sha256, sha256(vendorLegalScope(VERSION)));
  assert.match(vendorLegalScope(VERSION), /not the separately authored harness skill directories/);
});

test("a failed legal download leaves stage legal files, current vendor and current lock untouched", async (t) => {
  const { root, staging } = await fixture(t);
  const vendor = join(root, "vendor/databricks-skills");
  await mkdir(vendor, { recursive: true });
  await writeFile(join(vendor, "LICENSE"), "previous license");
  await writeJson(join(root, "vendor/databricks-skills.lock.json"), { resolvedVersion: "0.2.9", sentinel: "previous lock" });
  const fake = mockFetch({ NOTICE: new Response("not found", { status: 404 }) });
  await assert.rejects(stageVendorLegal(staging, VERSION, fake), /NOTICE.*HTTP 404/);
  for (const name of ["LICENSE", "NOTICE", "THIRD_PARTY.md"]) assert.equal(await exists(join(staging, name)), false);
  assert.equal(await readFile(join(vendor, "LICENSE"), "utf8"), "previous license");
  assert.deepEqual(await readJson(join(root, "vendor/databricks-skills.lock.json")), { resolvedVersion: "0.2.9", sentinel: "previous lock" });
});

test("legal acquisition rejects redirects, oversized advertised or streamed bodies, HTML, empty and invalid UTF8", async (t) => {
  const { staging } = await fixture(t);
  const failures = [
    [new Response("redirect", { status: 302 }), /HTTP 302/],
    [new Response("small", { headers: { "content-length": "9999999" } }), /size limit/],
    [new Response("x".repeat(100)), /size limit/],
    [new Response("<html>error</html>", { headers: { "content-type": "text/html" } }), /HTML/],
    [new Response("  \n"), /empty or invalid/],
    [new Response(new Uint8Array([0xff, 0xff])), /UTF-8/],
  ];
  for (const [response, expected] of failures) {
    const fake = mockFetch({ LICENSE: response });
    await assert.rejects(stageVendorLegal(staging, VERSION, { ...fake, maxBytes: 80 }), expected);
    assert.equal(await exists(join(staging, "LICENSE")), false);
    assert.equal(await exists(join(staging, "NOTICE")), false);
  }
});

test("legal acquisition enforces a bounded timeout and aborts unresolved fetches without writing", async (t) => {
  const { staging } = await fixture(t);
  const signals = [];
  await assert.rejects(stageVendorLegal(staging, VERSION, { timeoutMs: 15, fetch: (_url, options) => {
    signals.push(options.signal);
    return new Promise(() => {});
  } }), /timed out/);
  assert.ok(signals.some((signal) => signal.aborted));
  assert.equal(await exists(join(staging, "LICENSE")), false);
  assert.equal(await exists(join(staging, "NOTICE")), false);
});

test("legal verifier detects missing, changed and wrongly sourced upstream legal artifacts", async (t) => {
  const { root, vendor, legal } = await installedFixture(t);
  assert.deepEqual(await verifyVendorLegal(root), []);
  await writeFile(join(vendor, "LICENSE"), `${LICENSE}\n`);
  assert.ok((await verifyVendorLegal(root)).some((problem) => /modified: LICENSE/.test(problem)));
  await writeFile(join(vendor, "LICENSE"), LICENSE);
  await rm(join(vendor, "NOTICE"));
  assert.ok((await verifyVendorLegal(root)).some((problem) => /unreadable.*NOTICE/.test(problem)));
  await writeFile(join(vendor, "NOTICE"), NOTICE);
  legal.files.LICENSE.source = "https://example.invalid/license";
  await writeJson(join(root, "vendor/databricks-skills.lock.json"), { resolvedVersion: VERSION, legal });
  assert.ok((await verifyVendorLegal(root)).some((problem) => /lock entry: LICENSE/.test(problem)));
});

test("generated scope travels with provider copies and cannot be weakened through a matching rewritten hash", async (t) => {
  const { root, vendor, legal } = await installedFixture(t);
  for (const provider of [".claude/skills", ".github/skills"]) {
    await cp(vendor, join(root, provider), { recursive: true });
    for (const name of ["LICENSE", "NOTICE", "THIRD_PARTY.md"]) assert.deepEqual(await readFile(join(root, provider, name)), await readFile(join(vendor, name)));
  }
  const rewritten = "This license applies to the entire harness.\n";
  await writeFile(join(vendor, "THIRD_PARTY.md"), rewritten);
  legal.files["THIRD_PARTY.md"].sha256 = sha256(rewritten);
  legal.files["THIRD_PARTY.md"].bytes = Buffer.byteLength(rewritten);
  await writeJson(join(root, "vendor/databricks-skills.lock.json"), { resolvedVersion: VERSION, legal });
  assert.ok((await verifyVendorLegal(root)).some((problem) => /scope does not match/.test(problem)));
});

test("refresh performs legal staging before removing existing vendor and harness check verifies provenance", async () => {
  const source = await readFile(new URL("../tools/harness.mjs", import.meta.url), "utf8");
  const installer = source.slice(source.indexOf("async function installDatabricksSkills"), source.indexOf("async function setup"));
  assert.ok(installer.indexOf("await stageVendorLegal(stagingResolved, resolvedVersion)") < installer.indexOf("await rm(vendorResolved"));
  assert.match(installer, /current vendor and lock were preserved/);
  assert.match(installer, /updateCommand:[\s\S]*legal,/);
  assert.match(source, /problems\.push\(\.\.\.await verifyVendorLegal\(root\)\)/);
});
