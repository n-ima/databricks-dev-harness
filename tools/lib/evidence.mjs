import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { cleanInline, optionList, pathInside, readJson, sha256, timestamp, writeJson, parseFrontmatter } from "./shared.mjs";
import { policyHash } from "./policy.mjs";

export async function fileHash(root, relativePath) {
  const path = pathInside(root, relativePath, "evidence");
  const details = await stat(path);
  if (!details.isFile() || !details.size) throw new Error(`Evidence must be a non-empty file: ${relativePath}`);
  return sha256(await readFile(path));
}

export function acceptanceIds(content) {
  return [...new Set([...content.matchAll(/(?:^|\n)\s*[-*]\s*(?:\[[ x]\]\s*)?([A-Z]+-\d+):/g)].map((m) => m[1]))];
}

// A seal establishes snapshot integrity, not identity. Independent CI/review authenticates the reviewer.
export async function sealEvidence(root, options) {
  if (!options.review || !options.session || !options.requirement) throw new Error("evidence seal requires --review, --session, and --requirement.");
  const reviewPath = pathInside(root, options.review);
  const review = await readJson(reviewPath);
  if (!review.reviewer || !["manual", "claude", "copilot", "codex"].includes(review.provider) || review.independent !== true) throw new Error("Review must identify an independent reviewer and provider.");
  if (!Array.isArray(review.acceptance) || !review.acceptance.length) throw new Error("Review needs acceptance-criterion results.");
  const requirement = await readFile(pathInside(root, options.requirement), "utf8");
  if (parseFrontmatter(requirement).status !== "accepted") throw new Error("Verification requires an accepted requirement, not a draft.");
  if (new Set(review.acceptance.map((ac) => ac.id)).size !== review.acceptance.length) throw new Error("Duplicate acceptance criteria are not allowed in a review.");
  const ids = acceptanceIds(requirement);
  if (!ids.length || ids.some((id) => !review.acceptance.some((item) => item.id === id))) throw new Error("Review must cover every requirement acceptance criterion.");
  const files = new Set([options.review, options.requirement, ...optionList(options.artifact)]);
  for (const ac of review.acceptance) {
    if (!["pass", "fail", "not-run"].includes(ac.status) || !Array.isArray(ac.evidence) || (ac.status === "pass" && !ac.evidence.length)) throw new Error(`Invalid acceptance evidence: ${ac.id}`);
    for (const path of ac.evidence) files.add(path);
  }
  const artifactHashes = {};
  for (const path of files) artifactHashes[path] = await fileHash(root, path);
  const receipt = {
    schemaVersion: 1, sessionId: cleanInline(options.session), requirement: options.requirement,
    status: review.acceptance.every((ac) => ac.status === "pass") ? "pass" : "fail",
    reviewer: review.reviewer, provider: review.provider, independent: true,
    provenance: { type: "review-record", source: options.review, identityAuthenticated: false },
    acceptance: review.acceptance, artifactHashes, policyHash: await policyHash(root), createdAt: timestamp(),
  };
  const output = pathInside(root, options.output || `work/reviews/${receipt.sessionId}.receipt.json`);
  await writeJson(output, receipt);
  console.log(output);
  return receipt;
}

export async function validateReceipt(root, receiptPath, { sessionId, requirement, implementer } = {}) {
  const receipt = await readJson(pathInside(root, receiptPath));
  if (receipt.schemaVersion !== 1 || receipt.status !== "pass" || receipt.independent !== true || !receipt.reviewer || !["manual", "claude", "copilot", "codex"].includes(receipt.provider)) throw new Error("Passing independent-verification receipt with a known provider is required.");
  if (!Array.isArray(receipt.acceptance) || receipt.acceptance.some((ac) => ac.status !== "pass" || !Array.isArray(ac.evidence) || !ac.evidence.length) || new Set(receipt.acceptance.map((ac) => ac.id)).size !== receipt.acceptance.length) throw new Error("Duplicate, unevidenced, or non-passing acceptance criteria in verification.");
  if (sessionId && receipt.sessionId !== sessionId) throw new Error("Verification session mismatch.");
  if (requirement && receipt.requirement !== requirement) throw new Error("Verification requirement mismatch.");
  if (implementer && receipt.reviewer === implementer) throw new Error("Implementer cannot verify their own work.");
  if (receipt.policyHash !== await policyHash(root)) throw new Error("Verification policy hash is stale.");
  if (!Object.keys(receipt.artifactHashes ?? {}).length) throw new Error("Verification requires artifact hashes.");
  for (const [path, hash] of Object.entries(receipt.artifactHashes)) if (await fileHash(root, path) !== hash) throw new Error(`Verified artifact changed: ${path}`);
  const requirementPath = requirement || receipt.requirement;
  if (!requirementPath || !receipt.artifactHashes[requirementPath]) throw new Error("Verification must bind the accepted requirement.");
  const requirementText = await readFile(pathInside(root, requirementPath), "utf8");
  if (parseFrontmatter(requirementText).status !== "accepted") throw new Error("Verification requires an accepted requirement.");
  const ids = acceptanceIds(requirementText);
  if (!ids.length || ids.some((id) => !receipt.acceptance?.some((ac) => ac.id === id && ac.status === "pass" && ac.evidence?.length))) throw new Error("Verification does not cover all acceptance criteria.");
  for (const ac of receipt.acceptance) for (const path of ac.evidence ?? []) if (!receipt.artifactHashes[path]) throw new Error(`Acceptance evidence is not hashed: ${path}`);
  return receipt;
}
