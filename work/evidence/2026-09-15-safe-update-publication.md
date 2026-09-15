# 安全更新0.6.0の公開記録

2026-09-15。[ADR-0011](../../docs/harness/decisions/ADR-0011-safe-local-update-adoption.md)の利用者承認に基づく。公開先は既存private/template `n-ima/databricks-dev-harness` のmain。実案件、Databricks、HARD-03は対象外。

## 現在

安全更新0.6.0を正式採用し、private origin/mainへ通常pushした。公開commitは`69ebf2ebe33da2bc3a551970e40fb5edca9667b7`。独立レビューでもremoteと全管理blobの一致を確認。ただし公開要件のID形式に不備があり、SU-PUB-060の機械受入記録と完了処理は未完了。[残作業](2026-09-15-publication-060-seal-blocker.md)。機能SUの受入と、公開記録の未完了を区別する。

## リモートとCI

[公開後の独立確認](../reviews/2026-09-15-publication-060-push-review.md)でprivate/template=true、main、全1,067blobとmanifest一致。full commit SHAのworkflow runs/check-runsは0件。Actionsは有効だが、このpushのCI未実行理由は断定できない。hosted CIの成功は主張しない。GitHub設定変更やworkflow手動実行は行っていない。

## 配布と再現

公開対象のindexから`.harness/runtime/publish-0.6.0`へ隔離コピーする。混在するdistributionとCLI_REFERENCEはHARD-03の既知の差分だけを除いたbytesをstageし、元の作業ファイルは保持する。0.6.0生成物は`.harness/releases/0.6.0`へ保存する。既存0.4/0.5は上書きしない。

## 公開前の実測

- 公開用snapshotで `npm ci --offline --ignore-scripts --no-audit --no-fund` と `npm run harness:check` 成功。
- 全回帰582件: 581成功、0失敗、1skip。[全ログ](2026-09-15-publication-060-full.log)。未採用HARD-03の52試験はこの公開snapshotに含めない。
- 管理1,067ファイルのsourceとcore.autocrlf=trueの新規Git checkoutのbyte一致。[検証](2026-09-15-publication-060-byte-validation.json)。manifest SHA-256: `4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c`。
- 公開index/payloadの一致、元の未採用変更11ファイルと旧0.4/0.5全payloadの保持を確認。[preflight](2026-09-15-publication-060-preflight.json)。
- GitHubはprivate/template、公開前のremote/mainは`a37f3321188ce11f455f5d76793a24fe16ad78e1`。

## 独立更新試験

別contextのreviewerが公開snapshotを対象に専用15＋独立反例12を実行し、27成功/0失敗/0skip。さらに、公開済み0.4/0.5のpayloadから隔離案件を作って更新した。[独立forward結果](2026-09-15-publication-060-independent-forward-result.json)。

- 0.4.0 → 0.6.0: 47更新＋55追加。変更前47ファイルと旧導入版をbackup。
- 0.5.0 → 0.6.0: 11更新＋10追加。変更前11ファイルと旧導入版をbackup。
- 両方とも案件固有20ファイルと旧base manifestを保持し、全1,067管理ファイルを照合。案件内へ導入されたCLIで次回planが1,067keepとなることを確認。
- 両方で無承認、競合、古いplanを拒否。前後のharness check、案件2試験、既存session読取、3表記route、生成provider skillの一致も確認。

過去の候補レビューを公開snapshotの合格証拠へ無条件に読み替えない。実Claude Code/Copilot・Databricks・実案件での更新は今回未実行であり、L1の範囲を拡大して報告しない。
