import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export const repository = fileURLToPath(new URL("../..", import.meta.url));
export async function installWorkloadCatalog(root) {
  const catalog = JSON.parse(await readFile(join(repository, "harness/workloads.json"), "utf8"));
  await mkdir(join(root, "harness"), { recursive: true });
  for (const file of ["workloads.json", "router.json"]) await copyFile(join(repository, "harness", file), join(root, "harness", file));
  for (const skill of new Set(catalog.workloads.flatMap(item => item.skills))) {
    const relative = "vendor/databricks-skills/" + skill + "/SKILL.md";
    await mkdir(dirname(join(root, relative)), { recursive: true });
    await copyFile(join(repository, relative), join(root, relative));
  }
}

