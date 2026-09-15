# 安全なローカル更新入口: 独立コードレビュー

2026-09-15。担当: `/root/safe_update_code_review`。Windows / Node.js v24.15.0。

判定: **今回のローカル実装に、再現する阻害指摘なし**。最終追加差分込みの既存15件と独立追加12件、計27件が成功（失敗・skipとも0）。正式採用・版上げ・公開・実案件受入の判定ではない。

## 対象と独立性

AGENTS.md、`orchestrate-work`、`review-work`、`improve-harness`、文書標準、品質契約手順、SU要件・設計・運用・旧版橋渡しを読み、関連sessionとplanを確認した。既存実装の生成処理を使わず、手書きmanifestと元bytesで追加fixtureを組み立てた。実装や受入条件は変更せず、当レビューと許可された独立証拠を追加した。最終段階では明示的な追加許可に基づき、品質契約のreviews配列だけへ独立レビューを記録する。既存HARD-03 unadopted差分は対象外・未変更。

対象は `tools/update-harness.mjs`、`tools/lib/distribution.mjs`のSU差分、`tests/update-entry.test.mjs`、新旧skill入口、router、日本語運用文書。drive-rootの包含判定修正も再実行した。CLI_REFERENCE.mdのSU入口追記も確認した。同じファイルと`tools/harness.mjs`の既存HARD-03差分は今回追加ではないと区別した。

## 受入条件と観測

| 受入ID | 独立に確認したこと |
|---|---|
| SU-01 | 配布物とGitなし展開sourceのoperationsが一致。計画後も管理bytes・baseline不変。source変更後もsnapshotの版を適用。dirty sourceは一致する固定版だけを選択 |
| SU-02 | 設計・要件・作業記録、package/lock、README、.vscode、秘密情報fixture、binaryの案件コードをbyte単位で保持。独自編集・削除・未知の衝突で全体適用を拒否 |
| SU-03 | 改変・欠落・size不一致・危険path・秘密path・曖昧形式・cacheのmigration差分を拒否。source/targetと管理parentのjunction、同一・包含・drive rootを拒否。未知/重複引数、無承認、stale plan/snapshot改変を拒否 |
| SU-04 | 元bytesのbackup、全管理hashと削除結果を照合。keepの破損と削除ファイル復活を決定的に注入し、interrupted journal・旧baseline・元backup保持と再実行拒否を確認 |
| SU-05 | 短い日本語指示がupdate-harnessへrouteされ、両providerのskillコピーがcanonicalとhash一致。実際の配布物内CLIを外部起動して旧版形式fixtureを更新し、案件内へ導入したCLIで次版のplan/applyを完走 |

実行: `node --test --test-reporter=tap tests/update-entry.test.mjs work/evidence/2026-09-15-safe-update-independent.test.mjs`。

証拠: [追加反例](../evidence/2026-09-15-safe-update-independent.test.mjs)、[初回26件の実行ログ](../evidence/2026-09-15-safe-update-independent.log)、[最終27件の実行ログ](../evidence/2026-09-15-safe-update-independent-final.log)、[全変更hash観測](../evidence/2026-09-15-safe-update-independent-hashes.json)。hash観測では今回対象と既存/作業状態の対象外ファイルを分け、対象外の観測をレビュー済みとは扱わない。

## 文書と境界の確認

新入口は信頼済み実行器と`--source`データを明確に分け、指定source内のmodule/migrationを動的実行しない。公開済み0.5.0の既存API bridgeを次版CLIと混同せず記述する。CLI出力は「ファイル更新・hash確認済み」で、案件受入や自動rollbackと表現していない。案件の書込み停止・計画/手動移行確認・新contextでの再開がskillと運用にある。

最終の追加差分も確認した。日本語の「ハーネス」「harness」「.harness」の3表記を短い更新依頼としてrouteし、実行権限は付与しない。改善依頼はimprove-harnessに留まる。旧版手順の無条件`agent-assets:sync`削除とSAFE_LOCAL_UPDATEの独自skill保持説明は、`tools/harness.mjs`の生成先全体削除・再生成処理（158〜196行）の実態に合う。check不一致を理由に独自skillを削除しない旨が明記された。

## 指摘解消と最終品質契約の意味確認

初回確認のARTIFACT_MISMATCHは、最終品質契約の参照hash/basis/result更新により解消した。TC-SU-06の前提が単一経路に読めた点は実装担当へ返し、次の2経路に修正されたことを確認した。受入基準は変更されていない。

- A: 公開0.4.0の1012管理ファイルから作る隔離案件に、公開0.5.0のGitなし展開sourceを外部の候補CLIで適用。1057管理ファイル、保護対象、45更新前backupの一致を別担当の実行記録・検証スクリプトから確認した。公開0.5自体に候補CLIが含まれるとは記述しない。
- B: 候補CLIを含む合成1.x配布物を外部CLIで導入し、案件内CLIで次版の計画を作成する専用試験。加えて当レビューのIND-05は同じ導線を次版applyまで実行した。

公開manifestの記録hashは現物と一致した。0.4.0 = `90f06b95119d9c3d5f04d6e4d9863a310bea24851af06b7c12fb3ff1323b5b8c`、0.5.0 = `28ac2790d76abe0ba49b3e05bcb1680b255d374572ae5c9700ed9be3388d4d18`。実行引数が候補CLI・隔離targetを明示し、source/published releases不変をassertしていることも読取確認した。通常caseの更新後checkは成功。独自skillを保持したcaseは想定された生成一覧不一致を返し、削除で解消せず保持した証拠がある。

最終契約はSU-01〜05、RISK-OWNERSHIP/SOURCE/COMPLETION、運用6項目を網羅し、7ケースの結果が実行証拠に対応する。HTTP interfaceなしはローカルCLI/ファイルだけを提供する今回範囲と整合する。費用はローカルI/Oと保存容量、依存はNode標準APIであり、案件packageを保持する。各証拠の参照hashと最終コードの一致を診断と独立hash照合で確認した。実装担当の全回帰ログは634件中633 pass、0 fail、1 skip。skipはこのhostでfile symlink作成権限がないケースであり、junction拒否は当レビューで実行している。自ら再実行した試験数は27件で、全回帰を独立再実行したとは主張しない。

最終契約basis = `d1f9842860727aaab7652801c062967bce29b7369e516a038c6474962417fc2b`、reviewsを除くreviewedSha256 = `0af6e517e299a70b509c02dc9081dab64292fd74bc922c5a2666ff0a8fc2b9b4`。reviews追記前のverifyはMISSING_REVIEWのみ。追記後の診断は[最終verifyログ](../evidence/2026-09-15-safe-update-independent-quality-verify.log)へ保存する。これは限定候補の技術レビューであり、診断は`certifiesAcceptance:false`を維持する。

## 検証限界

- 公開0.4→0.5の実行主体は別担当であり、当レビューはその生成スクリプト・元manifest・argv・結果・保持証拠を照合した。当レビューが自ら組んだ旧版fixtureは合成manifestである。
- clone取得・ZIP解凍そのもの、ネットワーク、実Claude Code/Copilot、実案件、Databricks、pushは実行していない。Gitの有無に依存しない展開済みファイルの動作を確認した。
- 実行器/供給元の本人認証、同一OS権限の敵対的な同時書込み、任意コマンドの保護回避は保証対象外。仕様に明記された境界である。Node.js 22実機と他OSの再実行は未実施。
- 初期sandbox呼出しはsetup refreshエラーで起動できず、許可されたローカル読取・隔離試験をrequire_escalatedで実行した。各tempは解決後の絶対pathが専用temp配下であることを確認して削除した。

実装の最終確認hash: `tools/update-harness.mjs` = `08f36fded24a7dcb412b5336e4de7609690e573c18205a696195678425d217f7`、`tools/lib/distribution.mjs` = `9f16b9413b38cb9f616e0c1ca416b383f9223e70f88252d258e76d6fa5798bb5`、`tests/update-entry.test.mjs` = `9e3cd3c78580a26069c5dacf1a5fc266970ba7657d4b725ac270f1a2528736ae`。
