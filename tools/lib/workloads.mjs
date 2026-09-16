import { join } from "node:path";
import { exists, optionList, readJson, sha256 } from "./shared.mjs";

// Intent classification is a hint, never an authorization or a semantic parser.
export const NO_UI = /(?:(?:ui|画面|フロントエンド)\s*(?:は|が|を)?\s*(?:不要|なし|無し|作らない)|\b(?:no|without)\s+(?:a\s+)?(?:ui|frontend)\b|api[- ]only)/iu;

export async function loadWorkloads(root) {
  const catalog = await readJson(join(root, "harness/workloads.json"));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.workloads) || !catalog.workloads.length)
    throw new Error("Invalid workload catalog.");
  const ids = new Set(), questions = new Set();
  for (const item of catalog.workloads) {
    if (!/^[a-z][a-z0-9-]*$/.test(item.id) || ids.has(item.id)) throw new Error("Invalid/duplicate workload id.");
    ids.add(item.id);
    for (const field of ["title", "boundary", "verification"])
      if (typeof item[field] !== "string" || !item[field].trim()) throw new Error("Missing workload " + field + ": " + item.id);
    for (const field of ["patterns", "skills", "sources", "questions"])
      if (!Array.isArray(item[field]) || !item[field].length) throw new Error("Missing workload " + field + ": " + item.id);
    if (![null, "app", "api", "analysis", "data-update", "genie", "metric-view"].includes(item.scaffold))
      throw new Error("Unsupported scaffold for " + item.id);
    for (const pattern of item.patterns) new RegExp(pattern, "iu");
    for (const skill of item.skills) {
      if (!/^databricks-[a-z0-9-]+$/.test(skill) || !await exists(join(root, "vendor/databricks-skills", skill, "SKILL.md")))
        throw new Error("Missing official skill: " + skill);
    }
    for (const source of item.sources) if (!/^https:\/\/(?:docs\.databricks\.com|github\.com)\//.test(source))
      throw new Error("Invalid workload source: " + item.id);
    for (const question of item.questions) {
      if (!/^Q-\d+$/.test(question.id) || questions.has(question.id) || !question.question || !question.category)
        throw new Error("Invalid/duplicate workload question: " + item.id);
      questions.add(question.id);
    }
  }
  return catalog;
}

export async function resolveWorkloads(root, prompt, options = {}) {
  const catalog = await loadWorkloads(root);
  const explicit = optionList(options.workload);
  const excluded = optionList(options.without);
  const known = new Set(catalog.workloads.map(item => item.id));
  for (const id of [...explicit, ...excluded]) if (!known.has(id)) throw new Error("Unknown workload: " + id + ". Use workload list.");
  if (explicit.some(id => excluded.includes(id))) throw new Error("A workload cannot be both selected and excluded.");
  const text = String(prompt).normalize("NFKC").replace(/\b(?:github\s*copilot|claude\s*code|coding\s*agent)\b/giu, "");
  let selected = explicit.length
    ? catalog.workloads.filter(item => explicit.includes(item.id))
    : catalog.workloads.filter(item => item.patterns.some(pattern => new RegExp(pattern, "iu").test(text)));
  const has = id => selected.some(item => item.id === id);
  if (!explicit.length) {
    // API platform names do not imply a UI. An explicit visible surface does.
    if (NO_UI.test(text) || (has("api") && !/(画面|グラフ|フォーム|ダッシュボード|\b(?:ui|ux|frontend|dashboards?|charts?|forms?)\b)/iu.test(text)))
      selected = selected.filter(item => item.id !== "rich-app");
    if (has("dashboard") && !/(AppKit|カスタム|リッチ|custom)/iu.test(text))
      selected = selected.filter(item => item.id !== "rich-app");
  }
  selected = selected.filter(item => !excluded.includes(item.id));
  const selectedIds = selected.map(item => item.id);
  return {
    schemaVersion: 1, catalogVerifiedAt: catalog.verifiedAt, catalogHash: sha256(JSON.stringify(catalog)),
    mode: explicit.length ? "explicit-selection" : "heuristic-hints",
    selectedIds, excluded, unknown: selected.length === 0,
    needsDiscussion: true, executionAuthorized: false,
    warnings: [
      "Classification is not approval. Confirm scope and missing components before accepting product intent.",
      ...(NO_UI.test(text) && selectedIds.some(id => ["rich-app", "dashboard"].includes(id))
        ? ["Explicit selection includes UI despite a no-UI hint; resolve this conflict with the user."] : []),
    ],
    workloads: selected,
  };
}

export async function resolveRoute(root, prompt, options = {}) {
  const router = await readJson(join(root, "harness/router.json"));
  const workload = await resolveWorkloads(root, prompt, options);
  const explicit = options.intent;
  if (explicit && !router.routes.some(item => item.id === explicit)) throw new Error("Unknown --intent.");
  const isSource = !await exists(join(root, 'product.config.json'));
  if(explicit === 'publish-harness' && !isSource) throw new Error('publish-harnessはハーネス開発元専用です。案件のGit操作とは区別してください。');
  const defineOnly = /(?:要件.{0,15}(?:議論|ディスカッション|相談|から|定義)|まず.{0,15}(?:要件|相談|設計)|実装.{0,5}(?:しない|不要)|requirements?\s*(?:discussion|first)|discuss\s+(?:the\s+)?requirements)/iu.test(prompt);
  const ranked = router.routes.map(item => ({
    ...item, score: item.patterns.reduce((score, pattern) => score + (new RegExp(pattern, "iu").test(prompt) ? 1 : 0), 0),
  })).filter(item => (item.id !== 'publish-harness' || isSource) && (item.id !== "mock-ui" || workload.selectedIds.some(id => ["rich-app", "dashboard"].includes(id))))
    .sort((a, b) => b.score - a.score || a.priority - b.priority);
  const publishing = isSource && ranked.find(item=>item.id==='publish-harness' && item.score);
  const id = explicit || (defineOnly ? "define" : publishing ? publishing.id : (ranked[0]?.score ? ranked[0].id : router.defaultRoute));
  const route = router.routes.find(item => item.id === id);
  return { ...route, workload, reason: explicit ? "explicit-intent" : defineOnly ? "discussion-first" : "keyword-hint" };
}
