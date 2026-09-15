import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { resolveWorkloads } from "./workloads.mjs";
import { acceptanceIds } from "./acceptance.mjs";
import { productDocuments } from "./product-documents.mjs";
import { localizeNewSession } from "./session-state.mjs";
import {
  asciiSlug,
  cleanInline,
  compactTimestamp,
  exists,
  optionList,
  pathInside,
  readJson,
  repoRelative,
  sha256,
  slugify,
  timestamp,
  writeJson,
  atomicWrite,
  replaceFrontmatterField,
  assertNoSecrets,
  withFileLock,
} from "./shared.mjs";

const ALLOWED_SOURCE_EXTENSIONS = new Set([
  ".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg",
]);
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

function inferCapabilities(selection) {
  const has = (id) => selection.selectedIds.includes(id);
  return {
    ui: has("rich-app") || has("dashboard"),
    dataUpdate: has("data-pipeline"),
    genie: has("genie"),
    metrics: has("metric-view"),
  };
}

function questionsFor(capabilities, selection) {
  const questions = [
    ["Q-01", "誰が、どの判断または業務を、現在よりどう改善する成果物ですか。", true, "product-outcome"],
    ["Q-02", "今回の対象範囲と、明示的に対象外にする範囲は何ですか。", true, "scope"],
    ["Q-03", "機密区分、利用者、必要権限、監査要件は何ですか。", true, "security"],
    ["Q-04", "成功を利用者の操作・データ・性能で判定できる受入シナリオは何ですか。", true, "acceptance"],
    ["Q-05", "対象cloud/edition・利用可能なcompute、学習用途か業務用途か、費用上限は何ですか。未設定のprofileやresourceは接続前に別途確認します。", true, "platform-availability"],
  ];
  if (capabilities.dataUpdate) {
    questions.push(
      ["Q-10", "入力と出力の完全修飾テーブル、粒度、主キー、重複・遅延到着・再実行時の規則は何ですか。", true, "data-contract"],
      ["Q-11", "処理頻度、完了期限、想定件数、品質閾値、失敗時の再実行方法は何ですか。", true, "operations"],
    );
  }
  if (capabilities.ui) {
    questions.push(
      ["Q-20", "主利用者、最重要タスク、端末、必要な画面状態（通常・空・読込・エラー・権限不足・部分データ）は何ですか。", true, "ui-intent"],
      ["Q-21", "読み取り専用Analytics、Lakebase synced table、Lakebase CRUDのどのデータアクセス方式が必要ですか。", true, "app-data-access"],
    );
  }
  if (capabilities.genie) {
    questions.push(
      ["Q-30", "Genieが参照するUnity Catalogテーブルと、既存space再利用か新規作成かを指定してください。", true, "genie-scope"],
      ["Q-31", "代表質問、期待する答えまたはSQL、曖昧質問・権限不足時の正しい挙動は何ですか。", true, "genie-evaluation"],
    );
  }
  const existing = new Set(questions.map(item => item[0]));
  for (const workload of selection.workloads) {
    for (const item of workload.questions) if (!existing.has(item.id)) {
      questions.push([item.id, item.question, true, item.category]);
      existing.add(item.id);
    }
  }
  if (selection.unknown) questions.push(["Q-00", "対象のDatabricks機能と入出力・実行環境を特定してください。未知の対象でも、承認と検証なしには実行しません。", true, "unknown-workload"]);
  return questions.map(([id, question, material, category]) => ({ id, question, material, category, status: "open", answer: null }));
}

async function uniqueSourceTarget(directory, sourceName) {
  const extension = extname(sourceName).toLowerCase();
  const stem = slugify(basename(sourceName, extension), 50);
  let target = join(directory, `${stem}${extension}`);
  for (let index = 2; await exists(target); index += 1) target = join(directory, `${stem}-${index}${extension}`);
  return target;
}

async function collectSources(root, id, sources) {
  const destination = join(root, "docs", "product", "intake", id, "sources");
  await mkdir(destination, { recursive: true });
  const records = [];
  for (const source of sources) {
    const sourcePath = pathInside(root, source, "intake source");
    const details = await stat(sourcePath);
    if (!details.isFile()) throw new Error(`Intake source must be a file: ${source}`);
    if (details.size > MAX_SOURCE_BYTES) throw new Error(`Intake source exceeds 50 MB: ${source}`);
    const extension = extname(sourcePath).toLowerCase();
    if (!ALLOWED_SOURCE_EXTENSIONS.has(extension)) throw new Error(`Unsupported intake source type: ${extension || "none"}`);
    const target = await uniqueSourceTarget(destination, basename(sourcePath));
    await copyFile(sourcePath, target);
    const bytes = await readFile(target);
    records.push({
      path: repoRelative(root, target),
      originalPath: repoRelative(root, sourcePath),
      mediaType: extension.slice(1),
      bytes: bytes.length,
      sha256: sha256(bytes),
      trust: "untrusted-input",
    });
  }
  return records;
}


function executionPlan(manifest, requirementPath, architecturePath, name) {
  return `---
id: ${manifest.id}-plan
status: blocked-on-intent
requirement: ${requirementPath}
architecture: ${architecturePath}
updated: ${manifest.updatedAt}
---

# ${manifest.title} — 実行計画

1. 重要な確認事項を解決し、利用者が要件の意図を承認する。
2. ${manifest.capabilities.ui ? "設計からDatabricks Appsを既定にし、同じAppKit部品/スタイル/版でfixture描画する。静的HTMLは実部品からの描画のみ。外部画面は明示選択時だけ。UI対応契約と別contextレビューを用意し、入力・状態の実行確認後にui-mock承認を得る。項目/データ/ER設計も並行。承認後は同じappを本実装へ引き継ぐ。" : "API/分析等の入出力契約をfixtureで確認する。UIを追加しない限りUI承認は不要。"}
3. 対象sliceの項目・業務規則・外部境界と試験観点/ケースを具体化し、別contextで設計をレビューする。品質契約はagentが work/quality/${name}.json に作成する（利用者のJSON記入は不要）。
4. 本実装前に npm run harness -- delivery check --contract work/quality/${name}.json --phase design で対応漏れを診断し、最小の実装と決定的テストを行う。
5. 必要な実環境確認を明示された開発profileで実施し、未実行は未実行と記録。品質契約を --phase verify で診断し、別contextの独立検証で全受入条件と証拠を照合する。診断0件だけでは完了ではない。
6. 既存のevidence sealと完了規則を適用する。本番公開は人の承認で停止する。適用外/軽微変更の扱いは docs/harness/operations/DOCUMENTATION_STANDARD.md に従う。
`;
}

function sessionDocument(manifest, requirementPath, architecturePath, planPath) {
  return `---
id: ${manifest.sessionId}
title: ${manifest.title}
status: active
intent: define
provider: unspecified
phase: define
gate: product-intent
gate_status: pending
iteration: 0
started: ${manifest.createdAt}
updated: ${manifest.updatedAt}
last_checkpoint: ${manifest.updatedAt}
requirement: ${requirementPath}
architecture: ${architecturePath}
plan: ${planPath}
worktree: unassigned
branch: unassigned
resources: none
---

# 作業セッション: ${manifest.title}

## Objective

依頼と資料を、合意され検証可能な要件へ具体化し、最小の完結した範囲を実装する。

## Verified current state

- 依頼を記録: \`docs/product/intake/${manifest.id}/intake.json\`.
- 重要な未回答事項がある間は、要件の意図は未承認。

## Decisions

- まだ確定していない。

## Progress and evidence

- ${manifest.createdAt} — 依頼・要件案・設計案・計画・作業記録を各ファイル単位のatomic writeで作成。

## Next actions

- 確認事項に回答し、根拠を紐づけて要件を具体化する。

## Blockers and human gates

- 要件の意図について人の承認待ち。

## Handoff

- このファイルと依頼記録から再開する。チャット履歴を正本にしない。
`;
}

async function resolveIntake(root, id) {
  const cleaned = cleanInline(id);
  if (!cleaned) throw new Error("Specify --id.");
  const path = pathInside(root, join("docs", "product", "intake", cleaned, "intake.json"), "intake manifest");
  if (!(await exists(path))) throw new Error(`Intake not found: ${cleaned}`);
  return { path, manifest: await readJson(path) };
}

async function withLockedIntake(root, id, action) {
  const { path } = await resolveIntake(root, id);
  return withFileLock(path, async () => {
    // The pre-lock read resolves identity only; all mutable state is reread
    // after acquiring ownership. Lock linked records before any write so a
    // concurrent session checkpoint cannot be lost to an intake gate update.
    const manifest = await readJson(path);
    const artifacts = Object.values(manifest.artifacts).map((relativePath) => pathInside(root, relativePath, "intake artifact"));
    const approvalPath = pathInside(root, join("work", "approvals", manifest.sessionId, "product-intent.json"), "intake approval");
    const targets = [...new Set([...artifacts, approvalPath])].sort();
    const acquire = async (index) => {
      if (index < targets.length) return withFileLock(targets[index], () => acquire(index + 1));
      for (const artifact of artifacts) await readFile(artifact, "utf8");
      return action({ path, manifest });
    };
    return acquire(0);
  });
}

export async function createIntake(root, options) {
  assertNoSecrets(JSON.stringify(options));
  const title = cleanInline(options.title || options._?.join(" "));
  const summary = cleanInline(options.summary);
  if (!title || !summary) throw new Error("intake create requires --title and --summary.");
  const name = options.name ? asciiSlug(options.name, 48)
    : /[a-z0-9]/i.test(title) ? asciiSlug(title, 48) : `product-${sha256(title).slice(0, 10)}`;
  // Two concurrent create requests with the same product name must not both
  // pass preflight and overwrite the requirement/design/plan artifacts.
  return withFileLock(join(root, "docs/product/requirements", `${name}.md`),
    () => createIntakeLocked(root, options, { title, summary, name }));
}

async function createIntakeLocked(root, options, { title, summary, name }) {
  const id = `${compactTimestamp()}-${name}`;
  const createdAt = timestamp();
  const sessionId = `${id}-delivery`;
  const sources = [];
  const workloadSelection = await resolveWorkloads(root, summary, options);
  const capabilities = inferCapabilities(workloadSelection);
  const manifest = {
    schemaVersion: 1,
    id,
    sessionId,
    title,
    summary,
    status: "needs-answers",
    capabilities,
    workloadSelection,
    sources,
    questions: questionsFor(capabilities, workloadSelection),
    decisions: [],
    createdAt,
    updatedAt: createdAt,
  };

  const requirementPath = `docs/product/requirements/${name}.md`;
  const architecturePath = `docs/product/architecture/${name}.md`;
  const planPath = `work/plans/${name}.md`;
  const sessionPath = `work/sessions/${sessionId}.md`;
  for (const candidate of [requirementPath, architecturePath, planPath, sessionPath]) {
    if (await exists(join(root, candidate))) throw new Error(`Refusing to overwrite existing artifact: ${candidate}`);
  }
  manifest.artifacts = { requirementPath, architecturePath, planPath, sessionPath };
  manifest.sources = await collectSources(root, id, optionList(options.source));
  const documents = await productDocuments(manifest, requirementPath, name);
  const generatedRequirement = documents.requirement;
  acceptanceIds(generatedRequirement);
  await atomicWrite(join(root, requirementPath), generatedRequirement);
  await atomicWrite(join(root, architecturePath), documents.architecture);
  await atomicWrite(join(root, planPath), executionPlan(manifest, requirementPath, architecturePath, name));
  await atomicWrite(join(root, sessionPath), localizeNewSession(sessionDocument(manifest, requirementPath, architecturePath, planPath)));
  // Publish the manifest last. Its presence is the durable intake commit marker.
  await writeJson(join(root, "docs", "product", "intake", id, "intake.json"), manifest);
  console.log(JSON.stringify({ intake: `docs/product/intake/${id}/intake.json`, session: sessionPath, ...manifest.artifacts }, null, 2));
  return manifest;
}

export async function answerIntake(root, options) {
  assertNoSecrets(JSON.stringify(options));
  return withLockedIntake(root, options.id, (record) => answerIntakeLocked(root, options, record));
}

async function answerIntakeLocked(root, options, { path, manifest }) {
  const questionId = cleanInline(options.question).toUpperCase();
  const answer = cleanInline(options.answer);
  const actor = cleanInline(options.actor);
  if (!questionId || !answer || !actor) throw new Error("intake answer requires --question, --answer, and --actor.");
  const question = manifest.questions.find((item) => item.id.toUpperCase() === questionId);
  if (!question) throw new Error(`Question not found: ${questionId}`);
  question.status = "answered";
  question.answer = answer;
  question.answeredBy = actor;
  question.answeredAt = timestamp();
  manifest.updatedAt = timestamp();
  manifest.status = manifest.questions.some((item) => item.material && item.status !== "answered")
    ? "needs-answers"
    : "ready-for-approval";
  if (manifest.approval) {
    const approvalPath = join(root, "work", "approvals", manifest.sessionId, "product-intent.json");
    const previous = await readJson(approvalPath);
    await writeJson(approvalPath, { ...previous, decision: "revoked", revokedAt: manifest.updatedAt, reason: "Intake answer changed after approval." });
    manifest.approvalHistory = [...(manifest.approvalHistory ?? []), manifest.approval];
    delete manifest.approval;
  }
  await updateArtifacts(root, manifest, false);
  await writeJson(path, manifest);
  console.log(JSON.stringify({ id: manifest.id, status: manifest.status, answered: questionId }, null, 2));
  return manifest;
}

export async function approveIntake(root, options) {
  assertNoSecrets(JSON.stringify(options));
  return withLockedIntake(root, options.id, (record) => approveIntakeLocked(root, options, record));
}

async function approveIntakeLocked(root, options, { path, manifest }) {
  const actor = cleanInline(options.actor);
  const evidence = cleanInline(options.evidence);
  if (!actor || !evidence) throw new Error("intake approve requires --actor and --evidence.");
  const open = manifest.questions.filter((item) => item.material && item.status !== "answered");
  if (open.length) throw new Error(`Cannot approve while material questions are open: ${open.map((item) => item.id).join(", ")}`);
  acceptanceIds(await readFile(pathInside(root, manifest.artifacts.requirementPath), "utf8"));
  manifest.status = "accepted";
  manifest.updatedAt = timestamp();
  manifest.approval = { actor, evidence, decidedAt: manifest.updatedAt };
  await updateArtifacts(root, manifest, true);
  const artifactHashes = {};
  for (const key of ["requirementPath", "architecturePath"]) {
    const relativePath = manifest.artifacts[key];
    artifactHashes[relativePath] = sha256(await readFile(pathInside(root, relativePath)));
  }
  manifest.approval.artifactHashes = artifactHashes;
  const approvalPath = join(root, "work", "approvals", manifest.sessionId, "product-intent.json");
  await writeJson(approvalPath, {
    schemaVersion: 1,
    sessionId: manifest.sessionId,
    gate: "product-intent",
    decision: "approved",
    actor,
    evidence,
    decidedAt: manifest.updatedAt,
    artifactHashes,
    provenance: "human-decision-record; local actor labels are not authentication",
  });
  await writeJson(path, manifest);
  console.log(repoRelative(root, approvalPath));
  return manifest;
}

async function updateArtifacts(root, manifest, approved) {
  const entries = [
    [manifest.artifacts.requirementPath, { status: approved ? "accepted" : "draft" }],
    [manifest.artifacts.sessionPath, { gate: "product-intent", gate_status: approved ? "approved" : "pending", phase: approved ? (manifest.capabilities.ui ? "mock" : "design") : "define" }],
    [manifest.artifacts.planPath, { status: approved ? "ready" : "blocked-on-intent" }],
  ];
  const pending = [];
  for (const [relativePath, fields] of entries) {
    const artifact = pathInside(root, relativePath);
    let content = await readFile(artifact, "utf8");
    for (const [key, value] of Object.entries({ ...fields, updated: manifest.updatedAt })) content = replaceFrontmatterField(content, key, value);
    if (relativePath === manifest.artifacts.requirementPath) {
      const answers = manifest.questions.map((q) => `### ${q.id} ${q.category}\n\n${q.question}\n\n${q.answer ?? "未回答（実装前に要確認）"}\n`).join("\n");
      const block = `<!-- intake-answers:start -->\n## 確認済みの回答 — 正本の質問台帳\n\n${answers}\n<!-- intake-answers:end -->`;
      content = content.includes("<!-- intake-answers:start -->") ? content.replace(/<!-- intake-answers:start -->[\s\S]*?<!-- intake-answers:end -->/, block) : `${content}\n${block}\n`;
      content = content.replace(/- \[[ x]\] \*\*(Q-\d+)/g, (match, id) => `- [${manifest.questions.find((q) => q.id === id)?.status === "answered" ? "x" : " "}] **${id}`);
    }
    if (approved && relativePath === manifest.artifacts.requirementPath) acceptanceIds(content);
    pending.push({ artifact, content });
  }
  // Validate the final rendered requirement before changing any artifact.
  for (const { artifact, content } of pending) await atomicWrite(artifact, content);
}

export async function showIntake(root, options) {
  const { manifest } = await resolveIntake(root, options.id);
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}
