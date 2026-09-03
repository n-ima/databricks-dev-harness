import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createDocsServer } from "./docs-server.mjs";
import { writeJson } from "./lib/shared.mjs";
import { fileHash } from "./lib/evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resolver = createRequire(process.env.HARNESS_PLAYWRIGHT_MODULE_DIR ? join(process.env.HARNESS_PLAYWRIGHT_MODULE_DIR, "package.json") : import.meta.url);
const { chromium } = resolver("playwright");
const server = createDocsServer();
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ headless: true, ...(process.env.HARNESS_BROWSER_CHANNEL ? { channel: process.env.HARNESS_BROWSER_CHANNEL } : {}) });
const results = [];
try {
  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/site/`);
    assert.equal(await page.title(), "Databricks Development Harness — 開発ガイド");
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Horizontal overflow");
    await page.getByRole("tab", { name: "macOS / Linux" }).click();
    assert.equal(await page.locator("#panel-unix").isVisible(), true);
    assert.equal(await page.locator("#panel-win").isVisible(), false);
    await page.getByRole("tab", { name: "macOS / Linux" }).press("Home");
    assert.equal(await page.locator("#panel-win").isVisible(), true);
    await page.locator("summary").first().click();
    assert.equal(await page.locator("details").first().getAttribute("open"), "");
    assert.deepEqual(errors, []);
    const screenshot = process.env.HARNESS_GUIDE_SCREENSHOTS === "true" ? `work/evidence/docs-${viewport.width > 800 ? "desktop" : "narrow"}.png` : null;
    if (screenshot) await page.screenshot({ path: join(root, screenshot), fullPage: true });
    results.push({ viewport, status: "pass", checks: ["title", "single h1", "no horizontal overflow", "tabs mouse", "tabs keyboard", "details", "no JS errors"], ...(screenshot ? { screenshot } : {}) });
    await page.close();
  }
  const artifactHashes = {};
  for (const path of ["docs/site/index.html", "docs/site/guide.css", "docs/site/guide.js", ...results.map((item) => item.screenshot).filter(Boolean)]) artifactHashes[path] = await fileHash(root, path);
  await writeJson(join(root, "work/evidence/docs-browser.json"), { checkedAt: new Date().toISOString(), browser: await browser.version(), results, artifactHashes, limitations: ["No automated contrast/axe audit performed; semantic/keyboard checks are scoped smoke tests.", "No public deployment performed."] });
  console.log(JSON.stringify(results));
} finally { await browser.close(); server.closeAllConnections(); await new Promise((done) => server.close(done)); }
