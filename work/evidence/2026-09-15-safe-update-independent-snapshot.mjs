import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('./2026-09-15-safe-update-independent-hashes.json', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reviewed = new Set([
  'tools/update-harness.mjs', 'tools/lib/distribution.mjs', 'tests/update-entry.test.mjs',
  'harness/router.json', 'harness/skills/update-harness/SKILL.md', 'harness/skills/orchestrate-work/SKILL.md',
  '.claude/skills/update-harness/SKILL.md', '.claude/skills/orchestrate-work/SKILL.md',
  '.github/skills/update-harness/SKILL.md', '.github/skills/orchestrate-work/SKILL.md',
  'docs/harness/requirements/2026-09-15-safe-local-update.md', 'docs/harness/design/SAFE_LOCAL_UPDATE.md',
  'docs/harness/operations/SAFE_LOCAL_UPDATE.md', 'docs/harness/operations/UPDATING_EXISTING_PROJECTS.md',
  'docs/harness/operations/CLI_REFERENCE.md',
  'tools/lib/shared.mjs', 'work/quality/safe-local-update.json',
]);
const git = args => {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr);
  return result.stdout;
};
if (process.argv[2] === '--verify') {
  const stored = JSON.parse(await readFile(output, 'utf8'));
  const drift = [];
  for (const item of stored.files.filter(item => item.scope === 'reviewed')) {
    if (hash(await readFile(join(repo, item.path))) !== item.sha256) drift.push(item.path);
  }
  console.log(JSON.stringify({ reviewedFiles: stored.files.filter(item => item.scope === 'reviewed').length, drift }, null, 2));
  if (drift.length) process.exitCode = 1;
} else {
  const changes = new Set([...git(['diff', '--name-only']).trim().split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).trim().split('\n')].filter(Boolean));
  const paths = [...new Set([...changes, ...reviewed])].filter(path => path !== 'work/evidence/2026-09-15-safe-update-independent-hashes.json').sort();
  const files = [];
  for (const path of paths) {
    const absolute = join(repo, path);
    if (!(await stat(absolute)).isFile()) throw Error(`Not a file: ${path}`);
    const bytes = await readFile(absolute);
    files.push({ path, scope: reviewed.has(path) ? 'reviewed' : path.startsWith('work/evidence/2026-09-15-safe-update-independent') || path === 'work/reviews/2026-09-15-safe-update-code-review.md' ? 'independent-evidence' : 'observed-excluded', bytes: bytes.length, sha256: hash(bytes) });
  }
  const result = { capturedAt: new Date().toISOString(), reviewer: '/root/safe_update_code_review', node: process.version, platform: process.platform, trackedDiffSha256: hash(git(['diff', '--binary'])), note: 'All current changed files are recorded; observed-excluded files (including existing HARD-03 and mutable session records) are not reviewed or approved. distribution.mjs and CLI_REFERENCE.md include excluded pre-existing HARD-03 portions. The final quality contract was reviewed independently; only its reviews array was edited by this reviewer.', files };
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ path: fileURLToPath(output), recordedFiles: files.length, reviewedFiles: files.filter(item => item.scope === 'reviewed').length }));
}
