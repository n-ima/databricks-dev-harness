import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { exists, sha256 } from "./shared.mjs";

// Shared integrity boundary. Keep evidence validation independent of the loop
// executor so every completion path uses the same receipt validator.
export async function policyHash(root) {
  const parts = [];
  for (const path of ["AGENTS.md", "harness.config.json", "tools/agent-hook.mjs"]) {
    parts.push(path, await readFile(join(root, path), "utf8"));
  }
  for (const directory of ["tools/lib", "harness/schemas", "harness/evals"]) {
    if (!(await exists(join(root, directory)))) continue;
    for (const name of (await readdir(join(root, directory))).sort()) {
      if (!/\.(mjs|json)$/.test(name)) continue;
      parts.push(`${directory}/${name}`, await readFile(join(root, directory, name), "utf8"));
    }
  }
  return sha256(parts.join("\n---\n"));
}
