# ADR-0012: UI対応検証と承認範囲台帳の正式採用

日付: 2026-09-16 JST。状態: accepted。

## 人の決定

利用者は2件の内容と実装済み/実環境未検証の説明を受け、「であれば、mainに反映してください」と指示した。この指示で以下の実装範囲を採用する。Databricks Appsを画面の既定にする方針自体は以前からの要求であり、今回初めて決まったものではない。

## 採用するもの

1. UIF: Apps/AppKitを設計段階から既定とし、実部品・スタイル・依存版・fixture・画面状態と独立レビューをUI承認に対応付ける。古い承認や別アプリへの承認流用を拒否する。`scaffold --purpose integration`による再初期化は廃止し、確認した同じアプリを通常buildで延長する。旧案件の文書・実装・承認を削除せず差分を再確認する。
2. HARD-03: 案件内の承認範囲を記録・照合・撤回するローカル台帳。対象・環境・主体・権限・費用申告・期限等を照合する。実行adapterや旧gateを自動解除せず、`executionAuthorized: false`を維持する。本人認証、課金の強制上限、live実行統合ではない。

## 検証と限界

実装snapshotは`2fe169392ff5595d57ae3a7bdfdf4b1f018ebf1f`、送信記録込みの基点は`acc506aa4de4e28e15400b92da06df2c2dfa2a8e`。既存根拠は[UI独立レビュー](../../../work/reviews/2026-09-15-ui-fidelity-final.md)、[scope独立再レビュー](../../../work/reviews/2026-09-10-scoped-approval-rereview.md)、[是正独立レビュー](../../../work/reviews/2026-09-16-truth-final-review.md)。今回の注記変更後のファイルへ、過去のhash固定receiptをそのまま有効と主張しない。元commitでの証拠と今回の差分レビューを区別する。

実装・ローカル検証・独立レビューは済んでいるが、実Claude Code/Copilot、実AppKit画面、実Databricks環境の受入を完了とはしない。HARD親要件全体や後続改善も一括完了としない。過去の「採用待ち」は当時の履歴であり、この2件の現在の採用判断は解消した。

## main統合

最新remoteを取得し、mainがレビューbranchの祖先であることを確認する。採用記録と現在状態だけを追記し、通常のfast-forwardでmainへ統合してpushする。分岐・想定外差分・保護規則による拒否があれば履歴を上書きせず停止する。別contextで差分と到達を確認する。

GitHub mainのソース反映であって、ハーネスのDatabricks配備ではない。既存0.6.1等の配布payload、tag、バージョンは変更しない。main更新だけでは進行中案件に自動反映されない。新版の更新payload発行と案件への適用は別工程である。
