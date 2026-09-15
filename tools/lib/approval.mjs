import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { cleanInline, optionList, pathInside, readJson, sha256, timestamp, writeJson, parseFrontmatter, replaceFrontmatterField, atomicWrite, withFileLock, assertNoSecrets } from "./shared.mjs";
import { fileHash } from "./evidence.mjs";
import { acceptanceIds } from "./acceptance.mjs";
import { validateUiContract, validateUiApproval } from "./ui-contract.mjs";

export async function createApproval(root, options) {
  assertNoSecrets(JSON.stringify(options));
  for (const key of ["session", "gate", "actor", "evidence"]) if (!options[key]) throw new Error(`approval create requires --${key}.`);
  const config = await readJson(join(root, "harness.config.json"));
  if (!config.humanGates.includes(options.gate)) throw new Error("Unknown human gate.");
  const sessionPath = pathInside(root, `work/sessions/${options.session}.md`);
  const initialSession = parseFrontmatter(await readFile(sessionPath, "utf8"));
  if (initialSession.status !== "active") throw new Error("Approval requires an active session.");
  let validatedRequirementHash;
  if (options.gate === "product-intent") {
    if (!initialSession.requirement || initialSession.requirement === "unassigned") throw new Error("Product intent approval requires a linked requirement.");
    const requirementBytes = await readFile(pathInside(root, initialSession.requirement));
    const requirementText = requirementBytes.toString("utf8");
    const requirement = parseFrontmatter(requirementText);
    if (requirement.intake) throw new Error("Use intake approve to enforce the material question ledger.");
    if (requirement.status !== "accepted") throw new Error("Existing product intent requires an accepted requirement and a human decision record.");
    acceptanceIds(requirementText);
    validatedRequirementHash = sha256(requirementBytes);
  }
  if (initialSession.gate_status === "pending" && initialSession.gate !== options.gate) throw new Error(`Resolve the existing gate first: ${initialSession.gate}`);
  const artifactHashes = {};
  for (const path of [options.evidence, ...optionList(options.artifact)]) artifactHashes[path] = await fileHash(root, path);
  if (options.gate === "product-intent") artifactHashes[initialSession.requirement] = validatedRequirementHash;
  if (options.gate === "ui-mock" && !optionList(options.artifact).length) throw new Error("Mock approval requires --artifact for executable mock/fixture/test files.");
  if (options.gate === "ui-mock") {
    const checked = await validateUiContract(root, options.ui_contract, { sessionId: options.session });
    Object.assign(artifactHashes, checked.artifactHashes);
  }
  const receipt = { schemaVersion: 1, sessionId: cleanInline(options.session), gate: options.gate, decision: "approved", actor: cleanInline(options.actor), evidence: options.evidence, artifactHashes, decidedAt: timestamp(), provenance: "human-decision-record; actor is not authenticated by this local command" };
  if (options.gate === "ui-mock") receipt.uiContract = options.ui_contract;
  const output = pathInside(root, `work/approvals/${receipt.sessionId}/${receipt.gate}.json`);
  await withFileLock(sessionPath, async () => {
    let session = await readFile(sessionPath, "utf8");
    const fields = parseFrontmatter(session);
    if (fields.status !== "active" || (fields.gate_status === "pending" && fields.gate !== options.gate)) throw new Error("Session state changed before approval; retry after review.");
    if (options.gate === "product-intent" && (fields.requirement !== initialSession.requirement ||
        await fileHash(root, fields.requirement) !== validatedRequirementHash)) {
      throw new Error("Approval requirement changed after validation; review the current requirement and retry.");
    }
    for (const [key, value] of Object.entries({ gate: options.gate, gate_status: "approved", updated: receipt.decidedAt })) session = replaceFrontmatterField(session, key, value);
    if (options.gate === "ui-mock") await validateUiApproval(root, receipt, { sessionId: options.session });
    await writeJson(output, receipt);
    await atomicWrite(sessionPath, session);
  });
  console.log(output);
  return receipt;
}
