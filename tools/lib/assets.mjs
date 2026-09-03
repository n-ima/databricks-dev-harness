import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite, exists, readJson } from "./shared.mjs";

export async function instructionAssets(root, write = false) {
  const source = await readJson(join(root, "harness/instructions.json"));
  const problems = [];
  for (const rule of source.rules) {
    const outputs = [
      [`.github/instructions/${rule.id}.instructions.md`, `---\napplyTo: "${rule.paths.join(",")}"\n---\n\n${rule.body}\n`],
      [`.claude/rules/${rule.id}.md`, `---\npaths:\n${rule.paths.map((p) => `  - "${p}"`).join("\n")}\n---\n\n${rule.body}\n`],
    ];
    for (const [path, content] of outputs) {
      const target = join(root, path);
      if (write) await atomicWrite(target, content);
      else if (!(await exists(target)) || await readFile(target, "utf8") !== content) problems.push(`Generated instruction is stale: ${path}`);
    }
  }
  return problems;
}
