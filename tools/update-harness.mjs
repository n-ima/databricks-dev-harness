#!/usr/bin/env node
import { resolve } from "node:path";
import { assertUpdateProject, planLocalUpdate, applyUpdate } from "./lib/distribution.mjs";

// Intentionally independent of tools/harness.mjs's source-relative root.
// Never import modules, install packages or run migration scripts from --source.
function parse(args) {
  const [command, ...rest] = args;
  if (["--help", "help"].includes(command) && !rest.length) return { command: "help" };
  const allowed = command === "plan" ? ["source", "target"] : command === "apply" ? ["plan", "target", "yes"] : [];
  if (!allowed.length) throw new Error("plan または apply を指定してください。--help で手順を表示します。");
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].startsWith("--") ? rest[i].slice(2) : "";
    if (!allowed.includes(key) || Object.hasOwn(options, key)) throw new Error(`未知または重複した引数: ${rest[i]}`);
    if (key === "yes") options.yes = true;
    else {
      if (!rest[i + 1] || rest[i + 1].startsWith("--")) throw new Error(`--${key} に値が必要です。`);
      options[key] = rest[++i];
    }
  }
  if (command === "apply" && options.yes !== true) throw new Error("計画と書込み停止を確認した後に --yes で適用してください。");
  return { command, options };
}

try {
  const { command, options } = parse(process.argv.slice(2));
  if (command === "help") {
    console.log(`対象案件のルートで実行（Node.js 22以上）:
node tools/update-harness.mjs plan --source LOCAL_FOLDER
node tools/update-harness.mjs apply --plan .harness/updates/PLAN.json --yes
旧版案件では信頼済み新版CLIの絶対パスと --target PROJECT_FOLDER を使用できます。
既定は計画のみ。案件固有ファイルは常に保持し、競合は停止します。
apply前に他の書込みを止め、計画・削除・手動移行を確認してください。
ファイル更新後も案件試験と独立レビューが必要です。GitHub/Databricks操作は行いません。`);
  } else {
    const target = resolve(options.target ?? process.cwd());
    if (command === "plan") {
      const plan = await planLocalUpdate(target, { source: options.source, quiet: true });
      console.log(JSON.stringify({ status: plan.canApply ? "計画済み" : "競合のため停止", target, fromVersion: plan.contract.fromVersion, toVersion: plan.contract.toVersion, source: plan.contract.sourceSelection, plan: plan.path, canApply: plan.canApply, counts: plan.contract.operations.reduce((counts, op) => ({ ...counts, [op.action]: (counts[op.action] ?? 0) + 1 }), {}), conflicts: plan.conflicts, migrations: plan.migrations, next: "管理ファイルは未変更。計画と手動移行を確認し、書込み停止後にapply。競合は自動上書きしません。" }, null, 2));
      if (!plan.canApply) process.exitCode = 1;
    } else {
      await assertUpdateProject(target);
      const result = await applyUpdate(target, { plan: options.plan, yes: true, quiet: true });
      console.log(JSON.stringify({ ...result, status: "ファイル更新・hash確認済み", target, next: "案件試験と独立レビュー後に開発を再開してください。受入完了・配備ではありません。" }, null, 2));
    }
  }
} catch (error) {
  console.error(`更新を停止しました: ${error.message}`);
  process.exitCode = 2;
}
