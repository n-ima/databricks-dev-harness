# 0.7.1 公開前の検証記録

2026-09-16。利用者の正式採用と継続承認に基づくハーネス公開。公開前の記録であり、GitHub到達は別途記録する。

## 対象

- 旧main: `6fedb4a4dd6f3bc9db1982cd195166f078864b0a`、旧版0.7.0。
- 新版0.7.1、管理ファイル1109件。manifest SHA-256: `44c108e6190995de279842e8c237cfa89d65d5710b895fe558273790fa918bbb`。
- 公開先は`n-ima/databricks-dev-harness`、private、default branch mainであることをGitHub CLIで読み取り確認。
- ADR-0013の採用範囲だけを公開する。実案件・Databricks・課金providerは操作しない。.harnessの無関係なbackupは送信しない。

## 実行結果

| 確認 | 結果と証拠 |
|---|---|
| 生成資産・構造 | 同期後harness check成功。normalizeによる改行変更0件 |
| 全回帰 | 728件中726成功・0失敗・2skip。`2026-09-16-publish-071-regression.tap`。file symlink権限制約によるskipを成功に数えない |
| source/stamp | 1109件一致、guard installed。公開成功の証明ではない |
| Git改行往復 | sourceと新しいGit checkoutで全hash一致。`2026-09-16-publish-071-bytes.json` |
| 0.7.0から更新 | cacheなしGit取得元と固定payloadの両経路で1109hash一致、案件9ファイル保持、再plan冪等、更新後publication tests成功。`2026-09-16-publish-071-update-r1.json` |
| 競合と旧版 | 管理ファイルの独自変更でapply拒否、旧1102管理ファイル不変。旧0.7.0のmanifestと全payload不変。同r1参照 |

独立担当も別r2と追加の新規path反例を検証する。正式な判定は`work/reviews/2026-09-16-publish-071-*`を参照。更新試験は一時合成案件のみであり、実案件の更新受入ではない。更新検査後に新規作成した一時合成ディレクトリだけを削除し、実案件・旧配布物・sourceは保持した。

## 限界と公開後の確認

実Claude Code/Copilot比較・費用/時間の改善率・実Databricks・全状態のUI承認は未検証。この記録時点ではremote push前で、GitHub hosted CIも未確認。通常push後にexact commitのmain到達・CI実状態を読み取り確認し、成功や未確認を区別する。
