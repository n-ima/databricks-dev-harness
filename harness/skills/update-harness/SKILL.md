---
name: update-harness
description: Update an existing project's installed harness from a trusted local release or extracted source folder. Use for requests to upgrade this project's harness, not to develop the updater or change product dependencies.
---

# 案件のハーネスを更新する

利用者は「このフォルダーからハーネスを更新して」でよい。保持対象の列挙は不要。既存の案件コード・要件・設計・作業記録・秘密情報は更新処理の対象外。管理ファイルの独自変更は競合として止まる。

1. 対象は今の案件か、指定した別案件かを確認する。ハーネス開発元での更新機能改善なら`improve-harness`へ戻る。相談・計画だけの依頼では適用しない。
2. 案件sessionをcheckpointし、他agentの書込みを止めたことを確認する。停止を確認できなければ計画まで。未コミット/未追跡の案件変更を破棄・stash・一括commitしない。
3. [安全な更新入口](../../../docs/harness/operations/SAFE_LOCAL_UPDATE.md)を読む。信頼する更新元と導入済み版を確認する。未指定なら更新元のローカルpathだけ質問する。取得/解凍は利用者が済ませていてよく、GitHub接続や再setupは不要。
4. `node tools/update-harness.mjs plan --source LOCAL_FOLDER`で計画する。古い案件にCLIがなければ、運用手順の信頼済み新版CLIによる初回起動を使う。`tools/harness.mjs`の絶対パス起動や丸ごとコピーで代用しない。
5. 日本語で対象案件・元版→先版・更新元の選択形態・差分件数・競合・削除・手動移行を説明する。利用者の更新指示は必要な計画説明を省く根拠にしない。適用する計画を確認してもらい、競合や手動移行の判断が未解決なら停止する。
6. 書込み停止と計画確認後、`node tools/update-harness.mjs apply --plan PLAN_PATH --yes`。force、baseline/planの偽装、未知ファイルの削除、独自変更の自動解消はしない。中断時はbackup/journalを保持して復旧手順へ。
7. ファイルhash照合は案件受入ではない。ハーネスcheck/試験、案件の関連試験、別contextの独立レビューを行い、証拠と未実行事項を記録する。provider生成物の独自差分があれば無条件syncしない。更新後は新contextでsessionを読み直して開発を再開する。push、DB変更、配備は含まない。
8. 進行中の工程を新標準に照合する。UI設計/モック中なら `docs/harness/operations/UI_RUNTIME_FIDELITY.md` の移行確認を行う。旧紙芝居・旧承認は保存し、現在の実コンポーネントとの対応、項目/データ設計、未解決差異を確認して必要部分だけ補完する。更新成功をUIの再承認と見なさず、案件アプリの自動再生成や承認捏造はしない。
