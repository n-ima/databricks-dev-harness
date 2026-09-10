import { lstat, mkdir, opendir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { assertUnlinkedPath } from "../../tools/lib/scaffold-output.mjs";
import { sha256 } from "../../tools/lib/shared.mjs";

const manifest = JSON.parse(await readFile(new URL("../../harness/fixtures/initialization/manifest.json", import.meta.url), "utf8"));
const excluded = (part) => [".git", "node_modules", ".harness", ".venv", ".databricks", ".databrickscfg", "__pycache__"].includes(part.toLowerCase())
  || /^\.env(?:\.|$)/i.test(part) || /\.local\./i.test(part);

// Offline test builder only. Never copy-and-delete, initialize a source, or overwrite a destination.
export async function freshTemplateFixture(source, destination) {
  source = resolve(source);
  destination = resolve(destination);
  const foldedSource = source.toLowerCase(), foldedDestination = destination.toLowerCase();
  if (foldedSource === foldedDestination || foldedSource.startsWith(`${foldedDestination}${sep}`) || foldedDestination.startsWith(`${foldedSource}${sep}`)) throw new Error("Fixture source/destination overlap is not allowed.");
  await assertUnlinkedPath(source);
  await assertUnlinkedPath(destination);
  try { await lstat(destination); throw new Error("Fixture destination already exists."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!(await lstat(dirname(destination))).isDirectory()) throw new Error("Fixture parent must already exist.");
  const files = new Map();
  let count = 0, bytes = 0;
  async function collect(path, depth = 0) {
    if (depth > 20 || ++count > 20000) throw new Error("Fixture input limit exceeded.");
    if (path.split("/").some(excluded) || path.toLowerCase() === "harness/base-release.json") return;
    const absolute = join(source, path);
    await assertUnlinkedPath(absolute);
    const item = await lstat(absolute);
    if (item.isDirectory()) {
      for await (const entry of await opendir(absolute)) {
        if (/[\x00-\x1f\x7f\\:]/.test(entry.name)) throw new Error("Invalid fixture path name.");
        await collect(`${path}/${entry.name}`, depth + 1);
      }
    } else {
      if (!item.isFile() || item.nlink > 1) throw new Error("Fixture input must be a regular unlinked file.");
      bytes += item.size;
      if (bytes > 100 * 1024 * 1024) throw new Error("Fixture input size limit exceeded.");
      files.set(path, await readFile(absolute));
    }
  }
  for (const path of [...manifest.files, ...manifest.directories]) await collect(path);
  for (const [path, content] of Object.entries(manifest.fixedFiles)) files.set(path, Buffer.from(content));
  // Inventory is complete before the exclusive destination mkdir; no source bytes are written.
  await assertUnlinkedPath(destination);
  await mkdir(destination);
  const hashes = {};
  for (const [path, content] of [...files].sort(([a], [b]) => a.localeCompare(b, "en"))) {
    const target = join(destination, path);
    await assertUnlinkedPath(target);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: "wx" });
    hashes[path] = sha256(content);
  }
  return { fixtureVersion: manifest.fixtureVersion, files: hashes, payloadSha256: sha256(JSON.stringify(hashes)) };
}
