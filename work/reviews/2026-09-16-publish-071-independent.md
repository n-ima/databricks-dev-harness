# 0.7.1 配布・更新の独立レビュー（push前）

レビュー担当: `publish_071_review`、context: `/root/publish_071_review`、2026-09-16。実装者と別contextで実施。配布source・版・stamp・実案件・remoteは変更していない。

## 結論

PUB-071-01〜03は記載したローカル環境でpass。公開を妨げるsource/更新経路の指摘はない。PUB-071-04はpush前なのでnot-runであり、この記録だけで公開完了にはしない。stage/commit後の送信対象確認と、push後のprivate remote main SHA・CI実状態を別記録で確認する。

対象はbase `6fedb4a4dd6f3bc9db1982cd195166f078864b0a` からの正式採用済み改善と0.7.1。stamp SHA-256 `44c108e6190995de279842e8c237cfa89d65d5710b895fe558273790fa918bbb`、管理ファイル1109件。既存0.7.0は1102件。package/config/lockは0.7.1で一致、依存バージョンとCLI/承認schema/権限は変更なし。

## 受入条件と実施した確認

| ID | 判定 | 独立確認した根拠 |
|---|---|---|
| PUB-071-01 | pass | accepted要件・ADR-0013・0.7.1案内を読み、今回の利用者承認と範囲を照合。段階的な実AppKit配置、全画面設計保存、未実施の実provider/実Databricks/効率比較、案件所有標準は自動置換しない移行境界を明記。 |
| PUB-071-02 | pass | `harness-publication check --base` と `harness check` を独立再実行して成功。stamp1109件一致。主担当の新版回帰728件中726成功・失敗0・skip2をログで確認。別途独立更新r2の実Git cloneでcache不在・改行往復・committed checkも再実行成功。主担当のbyte検査も同じmanifestを照合。 |
| PUB-071-03 | pass | 更新script r2を独立再実行。0.7.0初期化済み合成案件をcacheなしsource/固定payloadから更新し、両経路で1109hash一致、案件9ファイル保持、再plan冪等、更新後publication12試験成功。旧版のmanifest/1102payload不変。追加の独立競合反例では管理/案件1106ファイルのhashとfile集合が不変、新規7管理pathも未作成を確認。 |
| PUB-071-04 | not-run | この記録時点は未push。無関係な`.harness/`はuntrackedのまま、stageには入っていない。最終stageと送信SHA/remote/CIは後続の独立公開確認を要する。 |

`conflict refuses all writes` という更新r2の出力は、管理ファイルへの適用を拒否した意味に限定する。planは`.harness`へsnapshot/計画を書き込む。独立反例はこれを明示的に除外し、管理/案件ファイル集合とbytesの無変更を検証した。

## 証拠

- `work/evidence/2026-09-16-publish-071-update-r2.json`: 独立実行した両更新経路・旧版保持・Git clone・12試験ずつの生結果。
- `work/evidence/2026-09-16-publish-071-independent-conflict.mjs` / `.json`: 独立に追加した競合時の全file集合検査。tempは検査終了後に対象確認のうえ削除。実案件無変更、ネット未使用。
- `work/evidence/2026-09-16-publish-071-regression.tap`: 主担当実行の全回帰結果。独立で728件すべて再実行した意味ではない。skip2はfile symlink作成権限によるものとして成功に数えない。
- `work/evidence/2026-09-16-publish-071-bytes.json`: 主担当実行の改行往復1109件一致。独立更新r2も実Git cloneで一致を確認。
- `work/reviews/2026-09-16-purpose-independent.md` / `.json`: 改善実装そのものの先行独立レビュー。今回の配布レビューでそれを再実施したとはしない。

## 指摘と対応

source/配布物に未解消のblocking findingはない。主担当のstage選別scriptに、新規の採用済み`tests/fixtures/purpose-ui/`および`tests/purpose-ui-probe.test.mjs`がmanifest外として停止する条件を見つけた。意図しないものを含めず停止する安全側の問題であり、主担当へこの2範囲のみ明示追加するよう連絡済み。実stage確認は後続に行う。

## 限界

Windowsローカル合成案件での配布/更新試験であり、実案件適用、Databricks配備、実Claude Code/Copilot反復評価、効率削減率、Linux/macOS CI成功を認定しない。stamp一致は配布元の本人認証や製品の業務受入の証明ではない。mainへの通常pushとCI確認はこの時点で未実施。
