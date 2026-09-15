# 安全更新0.6.0公開後の独立レビュー

2026-09-15。担当: `/root/publication_060_review`。P060-04の公開内容の確認はsemantic pass。P060の機械receiptは下記のID形式不備によりblockedで、機械的な受入完了は未完了。SU/quality用の既存レビューと証拠は変更していない。

- source commit: `69ebf2ebe33da2bc3a551970e40fb5edca9667b7`。`git ls-remote origin refs/heads/main`と一致。親は`a37f3321188ce11f455f5d76793a24fe16ad78e1`で、既存mainに連なる通常commit。
- GitHub read-only確認: `n-ima/databricks-dev-harness`、private/templateはtrue、既定branchはmain。
- commitのmanifest SHA-256は`4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c`。公開前に確認した0.6.0・1067管理ファイルのmanifestと同一。`git cat-file --batch`で全1067blobのhashとsizeを独立照合し全件一致。
- commit全pathにscoped-approval/SCOPED_APPROVALSはなく、CLI・distribution・CLI_REFERENCEにも候補接続/案内はない。
- full SHAの`gh run list`は`[]`、Actions APIのworkflow_runsは0、check-runsも0。CIの実行・成功は未観測であり、成功とも失敗とも補完しない。workflow手動実行・GitHub設定変更・pushは本担当では行っていない。
- Actions permissionsをread-only照会した結果（終了値0）: `{"enabled":true,"allowed_actions":"all","sha_pinning_required":false}`。この結果だけから対象pushでCIが起動しなかった理由を断定しない。

P060-04はprivate origin/mainの公開commit一致と、未実行CIを成功と報告しないことを要求している。hosted CI成功そのもの、実案件適用、実provider、Databricks操作の受入ではない。後続の記録のみの追補commit/pushはこの確認の対象外。

全コマンド/時刻/結果と全blobhashは[独立remote証拠](../evidence/2026-09-15-publication-060-independent-remote.json)。SU品質契約・SU受入JSON・公開前レビュー・品質診断のhashが確認前後で不変であることも同証拠に記録した。

## 訂正: P060の機械receiptは未発行

公開後に主担当のclean snapshotでの`evidence seal`が`Invalid acceptance ID at line 12: P060-01`で停止した。公開版`tools/lib/acceptance.mjs`のID形式はprefixに数字を許さず、P060-01〜04は不適合。本担当も既存parserと要件を読取り、parserの拒否条件を確認した。独立レビューでこの形式適合を公開前に確認しなかった点は見落としである。

公開commit・manifest・更新機能の観測結果とSU採用の証拠は維持する。一方、P060 JSON内のpassは観測内容のsemantic検証だけを示し、receiptの発行・公開task/sessionの機械的な受入完了を意味しない。JSONには`machineAcceptance.status: blocked`と未解消指摘を追記した。

このturnでは公開済み0.6.0、検証器、受入条件、SU/qualityを変更しない。次版でID形式の訂正と旧新対応をレビューし、その版の要件・証拠を再検証してからreceiptを発行する。過去のreceiptを流用したり検証器を緩めたりして解消したことにしない。

主担当の実行失敗・停止状態と次版方針は[seal blocker記録](../evidence/2026-09-15-publication-060-seal-blocker.md)を参照。SU-PUB-060はblocked、公開sessionは未完了として維持する。
