# ハーネス開発・公開の一貫した完了条件

## 原因

公開skillはDatabricks配備向けだけで、ハーネス公開の入口がなかった。CIは構造/回帰のみでstampを検査していなかった。既存check-releaseはmanifestに列挙済みのhashを確認するが、新たな管理fileの列挙漏れまでは検出しなかった。さらに、source公開の完了要件から配布準備を除外する判断を許していた。コードがあることと案件が取り込めることを同一視しない一方、公開タスクをその手前で完了させない必要がある。

## 設計

公開の正本手順を`docs/harness/operations/HARNESS_DEVELOPMENT.md`に置く。`publish-harness` skillはこの手順を読み、要件→設計/観点→実装→試験/独立レビュー→新版/移行案内→stamp→cacheなし取得/更新試験→公開/到達確認を一つの作業として扱う。通常の改善依頼は開発branchで進める。公開の依頼には配布準備を内包するが、個別案件の適用やDatabricks配備を内包しない。

`tools/harness-publication.mjs check`は読取専用で、既存distributionの所有範囲・安全path・manifest検証を再利用する。sourceの全管理file集合、hash/size、config/package/lock版、必要な移行案内を検査する。過去の固定payloadへfallbackしない。`--base`で旧commitのstampと比較し、内容が異なる同版/版戻りを拒否する。ZIP取得でも単体checkが使える。

`pre-push`はGitのstdinに含まれる送信先`refs/heads/main`を対象にする。送信SHAがcheckoutのHEADと一致し、管理対象・stamp・packageがcommit済みかを確認してから同じcheckを呼ぶ。別branchからmainへの送信でも逃がさない。main削除・未知base・非HEAD送信は止め、対象commitを確認させる。他branchのバックアップpushは妨げない。`install-hook`はローカルsourceリポジトリ専用。既存hook/configを勝手に置換しない。Git設定の変更はこのrepoに限定する。

CIはハーネスsourceで公開前checkを実行する。案件のCIへsource stampの完全一致を要求しない。source/product判定は運用分類であって認証ではない。GitHub branch protectionの変更は別権限であり今回行わない。ローカルhookは`--no-verify`や設定変更で回避可能で、OS sandbox/絶対防御とは主張しない。

保守開始時にimprove/publish skillがsourceでguardの有効性を確認し、未導入なら既存hookを保持して導入する。案件用setup（product.configを作る）を代用しない。既存hookとの衝突は止めて統合を検討し、未導入を保護済みと報告しない。標準`.git/hooks/pre-push`だけを排他的に作り、他のhookやglobal設定を変更しない。

CI checkoutは履歴を取得し、PRではbase SHA、main pushではbefore SHAを正確に渡す。zero SHAの初回mainだけ比較元なしを許容し、非zero SHAを取得/解決できない場合は停止する。比較元にstampがない旧repoからの最初の移行は初回配布として明示する。通常の版差替え検査はその旧stampとの比較を必須とする。

## 試験観点

| 対象 | 正常 | 拒否・境界 |
|---|---|---|
| source検査 | cacheなしstamp一致・新規管理fileも全収録 | stampなし/古い/hash差/収録漏れ/余分/リンク/版差/同版差替え |
| Git guard | HEADの新しいstamp版をmainへ送信 | 未commit・非HEAD・別ref→main・main削除・未知base・既存hook衝突 |
| 更新 | 固定payload/source双方から初期化済み合成案件へ適用 | 案件独自変更は全体停止、秘密/案件doc/codeは保持、旧版不変 |
| workflow | 改善と公開を識別・Databricks配備へ誤誘導しない | 「pushのみ」からstamp省略、単なる相談から外部書込、採用済みの再承認要求 |

ネットワーク無しのtemp Git remote/案件で試験する。公開本番、実provider、実Databricks試験とは呼ばない。今ある旧版のstampを書換えて新しい内容を同版と偽装しない。
