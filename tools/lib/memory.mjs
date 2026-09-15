import { mkdir, readFile } from "node:fs/promises";
import { basename, join, sep } from "node:path";
import { atomicWrite, cleanInline, compactTimestamp, exists, pathInside, replaceFrontmatterField, repoRelative, slugify, timestamp, withFileLock, assertNoSecrets } from "./shared.mjs";
import { validateReceipt, fileHash } from "./evidence.mjs";
import { sha256 } from "./shared.mjs";
import { sectionBody, replaceSection, currentCheckpoint, sessionRecords, localizeNewSession } from "./session-state.mjs";
import { taskRecords } from "./tasks.mjs";
import { assertSessionLoopsComplete } from "./session-loop.mjs";

export async function sessions(root) {
  return sessionRecords(root, { filterProduct: false });
}

async function findSession(root, id) {
  if (!id) throw new Error("Specify --id.");
  const records = await sessions(root);
  const exact = records.filter(session => session.id === id);
  const matches = exact.length ? exact : records.filter(session => session.id.startsWith(id));
  if (matches.length !== 1) throw new Error(`Session not found or ambiguous: ${id}`);
  return matches[0];
}

export async function startSession(root, options) {
  assertNoSecrets(JSON.stringify(options));
  const title = cleanInline(options.title || options._?.join(" "));
  if (!title) throw new Error("session start requires --title.");
  const now = timestamp();
  const id = `${compactTimestamp()}-${slugify(title)}`;
  const intent = cleanInline(options.intent, "build");
  const routeFile = JSON.parse(await readFile(join(root, "harness/router.json"), "utf8"));
  if (!routeFile.routes.some((r) => r.id === intent)) throw new Error(`Unknown session intent: ${intent}`);
  const requiredGate = ["build", "define", "mock-ui"].includes(intent) ? "product-intent" : "none";
  const content = localizeNewSession(`---\nid: ${id}\ntitle: ${title}\nstatus: active\nintent: ${intent}\nprovider: ${cleanInline(options.provider, "unspecified")}\nphase: define\ngate: ${requiredGate}\ngate_status: ${requiredGate === "none" ? "not-applicable" : "pending"}\nstarted: ${now}\nupdated: ${now}\nlast_checkpoint: ${now}\nrequirement: ${cleanInline(options.requirement, "unassigned")}\narchitecture: ${cleanInline(options.architecture, "unassigned")}\nplan: ${cleanInline(options.plan, "unassigned")}\nbranch: ${cleanInline(options.branch, "unassigned")}\nworktree: ${cleanInline(options.worktree, ".")}\nresources: none\n---\n\n# 作業セッション: ${title}\n\n## Objective\n\n${cleanInline(options.objective, title)}\n\n## Verified current state\n\n- リポジトリの現状確認は未実施。\n\n## Decisions\n\n- まだ確定していない。\n\n## Progress and evidence\n\n- ${now} — 作業セッションを開始。\n\n## Next actions\n\n- 関連する要件・設計を読み、重要な確認事項を解決してから最小の実装範囲へ進む。\n\n## Blockers and human gates\n\n- ${requiredGate}\n\n## Handoff\n\n- 再開前に現在の状態を再確認する。チャット履歴には依存しない。\n`);
  const path = join(root, "work/sessions", `${id}.md`);
  await atomicWrite(path, content);
  console.log(repoRelative(root, path));
  return { id, path };
}

export async function checkpointSession(root, options) {
  assertNoSecrets(JSON.stringify(options));
  const initial = await findSession(root, options.id);
  return withFileLock(initial.path, async () => {
    const record = await findSession(root, options.id);
    if (record.status !== "active") throw new Error("Checkpoint requires an active session.");
    if (!options.summary || !options.next) throw new Error("A resumable checkpoint requires --summary and --next (use --next 'none; waiting for ...' at a gate).");
    if (options.expected_revision !== undefined && options.expected_revision !== sha256(record.text)) throw new Error("Session revision changed; re-read before checkpointing.");
    if (options.task && options.task !== "none") {
      const task = (await taskRecords(root)).find(item => item.id === options.task);
      if (!task || task.session !== record.id) throw new Error("Focus task must belong to this session.");
    }
    const now = timestamp();
    let text = record.text;
    for (const [key, value] of Object.entries({ updated: now, last_checkpoint: now })) text = replaceFrontmatterField(text, key, value);
    if (options.phase) {
      const phases = ["define", "mock", "design", "plan", "implement", "verify", "review", "release"];
      if (!phases.includes(options.phase)) throw new Error("Unknown phase.");
      if (record.gate_status === "pending" && ["implement", "verify", "release"].includes(options.phase)) throw new Error("Resolve the pending human gate before advancing.");
      text = replaceFrontmatterField(text, "phase", options.phase);
    }
    const prior = currentCheckpoint(record.text);
    const currentBody = sectionBody(record.text, "Verified current state");
    const nextBody = sectionBody(record.text, "Next actions");
    const blockerBody = sectionBody(record.text, "Blockers and human gates");
    const nextBlockerBody = options.blocker ? `- ${cleanInline(options.blocker)}` : blockerBody;
    if (record.checkpoint_format !== "2" || currentBody !== `- ${prior.current}` || nextBody !== `- ${prior.next}` || blockerBody !== nextBlockerBody) {
      text += `\n## Previous state archived ${now}\n\n### Previous verified current state\n\n${currentBody}\n\n### Previous next actions\n\n${nextBody}\n\n### Previous blockers and human gates\n\n${blockerBody}\n`;
      text = replaceFrontmatterField(text, "checkpoint_format", "2");
    }
    text = replaceSection(text, "Verified current state", `- ${cleanInline(options.summary)}`);
    text = replaceSection(text, "Next actions", `- ${cleanInline(options.next)}`);
    if (options.blocker) text = replaceSection(text, "Blockers and human gates", nextBlockerBody);
    if (options.task) text = replaceFrontmatterField(text, "focus_task", options.task === "none" ? "unassigned" : options.task);
    const fields = ["summary", "decision", "evidence", "next", "blocker", "task"];
    text += `\n## Checkpoint ${now}\n\n${fields.filter((key) => options[key]).map((key) => `- ${key}: ${cleanInline(options[key])}`).join("\n")}\n`;
    if (sha256(await readFile(record.path, "utf8")) !== sha256(record.text)) throw new Error("Session revision changed during checkpoint.");
    await atomicWrite(record.path, text);
    console.log(repoRelative(root, record.path));
  });
}

export async function closeSession(root, options) {
  assertNoSecrets(JSON.stringify(options));
  const initial = await findSession(root, options.id);
  return withFileLock(initial.path, async () => {
    const record = await findSession(root, options.id);
    if (record.status !== "active") throw new Error("Only an active session can be closed.");
    const outcome = cleanInline(options.outcome, "completed");
    if (!["completed", "blocked", "superseded"].includes(outcome)) throw new Error("Unknown session outcome.");
    if (!options.summary) throw new Error("Closing requires --summary.");
    if (outcome === "completed") {
      if (record.id !== basename(record.path, '.md')) throw new Error('Session identity does not match its file.');
      if (record.gate_status === "pending") throw new Error(`Human gate remains pending: ${record.gate}`);
      await assertSessionLoopsComplete(root, record.id);
      if (!options.verifier_evidence || !record.requirement || record.requirement === "unassigned") throw new Error("Completion requires a linked requirement and --verifier-evidence receipt.");
      await validateReceipt(root, options.verifier_evidence, { sessionId: record.id, requirement: record.requirement, implementer: record.provider });
    }
    let text = replaceFrontmatterField(record.text, "status", outcome);
    text = replaceFrontmatterField(text, "updated", timestamp());
    text += `\n## Closed ${timestamp()}\n\n- Outcome: ${outcome}\n- Summary: ${cleanInline(options.summary)}\n- Independent evidence: ${cleanInline(options.verifier_evidence, "not applicable; not completed")}\n`;
    await atomicWrite(record.path, text);
    console.log(repoRelative(root, record.path));
  });
}

export async function addKnowledge(root, options) {
  assertNoSecrets(JSON.stringify(options));
  const scope = cleanInline(options.scope, "product");
  if (!["product", "harness"].includes(scope)) throw new Error("--scope must be product or harness.");
  for (const key of ["title", "body", "source", "confidence", "applies_to"]) if (!options[key]) throw new Error(`knowledge add requires --${key.replaceAll("_", "-")}.`);
  if (!["high", "medium", "low"].includes(options.confidence)) throw new Error("Confidence must be high, medium, or low.");
  if (options.kind && !["fact", "decision", "pattern", "pitfall"].includes(options.kind)) throw new Error("Unknown knowledge kind.");
  if (!/^https:\/\//.test(options.source)) await fileHash(root, options.source);
  const now = timestamp();
  const reviewAfter = options.review_after || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewAfter) || Number.isNaN(Date.parse(reviewAfter)) || new Date(reviewAfter).toISOString().slice(0, 10) !== reviewAfter) throw new Error("--review-after must be a valid YYYY-MM-DD date.");
  const directory = join(root, "docs", scope, "knowledge");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${compactTimestamp()}-${slugify(options.title)}.md`);
  const indexPath = join(directory, "INDEX.md");
  return withFileLock(indexPath, async () => {
    const supersedes = cleanInline(options.supersedes, "none");
    if (supersedes !== "none") {
      const priorPath = pathInside(root, supersedes);
      if (!priorPath.startsWith(directory + sep)) throw new Error("Superseded knowledge must be in the same scope.");
      let prior = await readFile(priorPath, "utf8");
      prior = replaceFrontmatterField(prior, "status", "superseded");
      prior = replaceFrontmatterField(prior, "superseded_by", repoRelative(root, path));
      await atomicWrite(priorPath, prior);
    }
    const content = `---\ntitle: ${cleanInline(options.title)}\nstatus: current\nkind: ${cleanInline(options.kind, "fact")}\nconfidence: ${options.confidence}\nsource: ${cleanInline(options.source)}\nverified_at: ${now}\nreview_after: ${reviewAfter}\napplies_to: ${cleanInline(options.applies_to)}\nsupersedes: ${supersedes}\n---\n\n# ${cleanInline(options.title)}\n\n${cleanInline(options.body)}\n\n## Applicability and exceptions\n\n${cleanInline(options.applies_to)}\n`;
    await atomicWrite(path, content);
    const index = await exists(indexPath) ? await readFile(indexPath, "utf8") : `# ${scope} knowledge\n`;
    await atomicWrite(indexPath, `${index}\n- [${cleanInline(options.title)}](${basename(path)}) — ${options.confidence}; review ${reviewAfter}${supersedes !== "none" ? `; supersedes ${supersedes}` : ""}\n`);
    console.log(repoRelative(root, path));
    return { path };
  });
}
