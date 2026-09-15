---
id: TRUTH-REPAIR
status: accepted
owner: repository-owner
---

# 監査で確定した5項目の是正

2026-09-16。利用者の「問題は修正してください」に基づくローカル修正。監査は `work/reviews/2026-09-16-harness-truth-audit.md`。完成水準を引き下げず、既存の安全意図と実装を一致させる。公開、実案件変更、Databricks操作、課金評価は含まない。

## 受入条件

- FIX-01: 既存AppsのLakebase `database` を無条件に `postgres` へ変更する案内を訂正する。原版・訂正理由を追跡でき、同期/refreshで誤案内が復活せず、両providerへ同じ訂正が届く。
- FIX-02: 関連loopに未解決gate・未完了処理があるsessionの完了を拒否する。loopなし/完了済みloopの正常経路と、複数loop・壊れた記録・競合を検証する。
- FIX-03: 停止/完了/承認待ちのsessionからloopを開始・再開・完了できない。処理中の停止は次の境界で後続を止め、実行済み範囲を成功と誤記せず残す。
- FIX-04: setup/syncは独自skillを無警告で削除しない。全provider事前検査、既存内容の保持・backup、リンク拒否、正常な初回/再実行と説明の一致を確認する。
- FIX-05: 生成Metric SQLのYAML本文は正本YAMLと一致し、構文解釈できる。draftの扱いと非実行境界を維持する。
- FIX-06: 各是正の失敗/成功試験、回帰、別contextレビュー、変更対象と未検証範囲を保存する。既存UIF/HARD-03と公開済みpayloadを保持し、今回の修正を自動公開・全機能実機受入と扱わない。

## 承認の範囲

確定不具合を直す実装・限定試験は今回の依頼に含む。新しい自律権限、完了閾値の緩和、旧候補の正式採用を推定しない。実provider/実環境の受入は対象・費用・権限を定めた別段階。
