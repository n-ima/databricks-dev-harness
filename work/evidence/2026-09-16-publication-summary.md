# ハーネス開発・公開の再発防止 — 検証記録

## 原因と是正

mainへのsource反映を、案件が更新できる配布版の作成とは別工程として完了扱いにした。公開専用の入口とstampを検査する強制点がなく、利用者に追加の指示を要求する状態だった。これは利用者の指示不足ではなく、開発・公開工程の不足だった。

開発の正本を`docs/harness/operations/HARNESS_DEVELOPMENT.md`に定め、要件/設計・負例・実装・両provider生成・独立レビュー・新版/移行案内・stamp・利用経路試験・main到達確認を一続きにした。公開は`publish-harness` skillへ導く。案件Git操作・状態確認・Databricks配備の境界も明記した。

## 実装した拒否条件

- 旧cacheではなく、現在のsourceの全管理file集合・hash・版・移行案内を照合する。
- 新しい内容を旧版番号で差し替えること、版戻しを拒否する。
- mainへ実際に送るHEADの管理file集合を照合し、追加だけでなく削除のcommit漏れも拒否する。
- main削除、別HEADの送信、比較baseの未取得、既存hook/configの上書きを拒否する。
- 開発元のローカルpre-push guardを導入済み。source CIにも同じ検査と正確な旧SHAの比較を接続した。

GitHub側のrequired checks/branch protectionは変更していない。ローカルhookは回避可能な誤操作防止であり、絶対的な実行隔離とは主張しない。

## 実行した検証

| 対象 | 結果 | 証拠 |
|---|---|---|
| 修正後の全回帰 | 723件中721成功、失敗0、2skip | `2026-09-16-publication-r2.json` |
| 新規公開試験 | 12件成功。temp Git remoteへの実pushで拒否/正常系確認 | 同上・`tests/publication.test.mjs` |
| native skill形式/両provider整合 | 変更4skill形式と構造check成功 | 同上 |
| 旧stampの公開拒否 | stale 0.6.1 sourceを非0終了で拒否 | `2026-09-16-publication-unstamped-rejection.json` |
| 0.7.0のstamp/Git取得 | 1,102管理file一致、旧mainと版差照合 | `2026-09-16-publication-source-check.json`・`2026-09-16-publication-release-bytes.json` |
| 実0.6.1からの更新 | cacheなしGit取得元/固定payloadの両方から0.7.0へ更新成功。別contextでも再実行成功 | `2026-09-16-publication-real-update-r1.json`・`-r2.json` |
| 案件保持/競合/旧版 | 9種の案件file保持、再適用はkeep、競合時1,068file不変、旧0.6.1の全bytes保持 | 同上 |
| 別context設計/実装/forward | 各2指摘を反映し再確認で解消 | `work/reviews/2026-09-16-publication-{design,code,forward}-review.md` |

2skipはこのWindows環境で作成できないfile symlinkの試験。junction試験は別途実行した。ローカル成功をLinux/macOS hosted CI成功や実providerでの成功へ読み替えない。

0.6.1の旧更新器は新管理fileを理解できず停止した。信頼済み新版の外部更新器と`--target`で安全に更新できる橋渡し経路を実行確認した。旧案件にstamp手編集やallowlist改変を要求しない。

## 記録の見方

`work/quality/2026-09-16-publication-review-ready.json`を独立受入し、レビューを接続した`publication-accepted.json`が最終記録。診断は0指摘/5実行記録で、独立受入receiptもpass。`publication-contract.json`は初期設計、`publication-final.json`は診断で不適切な参照を拒否された旧draftとして保持する。品質readerがdot directory参照を拒否したため、その制約は緩めずprovider/CIは実体のsnapshot記録へ分離した。実fileの一致はsource検査・stamp・独立照合で確認する。advisory診断を独立受入の代用にしない。

## 現在地と未実施

- 0.7.0をローカルにstamp済み。変更は作業branch上の未commit状態。
- 最終の独立受入でPUBC-01〜05すべてpass。対策実装とローカル配布準備の完了を確認した。受入報告は`work/reviews/2026-09-16-publication-acceptance.md`、receiptは`work/reviews/20260916-010024-987-harness-publication-contract.receipt.json`。
- GitHubへの追加push・main更新、GitHub hosted CI、実Claude Code/Copilot、実案件更新、Databricks操作はこの対策検証では未実施。
- 公開後の更新適用は各案件でplan/競合/移行を確認して行う。ハーネスをDatabricksへ配備する工程はない。
