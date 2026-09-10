---
status: draft
---
# タスク可視化と確実な再開 — RH01〜RH03

対象は共通ハーネスのローカル作業状態。ユーザーの「続けて」を受けた実装候補であり、独立レビュー・受入承認は未実施。

## 問題と範囲

[全面再評価](../research/2026-09-10-comprehensive-reaudit.md)と[隔離試験](../../../work/evidence/2026-09-10-context-probe.json)で、現在地・next・gateの非表示、8件の黙った省略、開始hookの不統一、checkpoint後の古い冒頭を確認した。

task Markdownを正本とする最小CLI、共通のcontext投影、明示focus、checkpointの現状更新を追加する。実行中processの監視・scheduler・本番操作・既存承認判定の変更は対象外。状態は記録上の状態であり実プロセス稼働の証明ではない。

## 受入候補（実装前に固定）

- AC-01: 安定ID・session・要件・設計・done条件・依存・状態・証拠を持つtask Markdownを作成でき、一覧で確認できる。
- AC-02: 不明ID、重複、依存欠落・循環、不正遷移、古いrevision、repository外への参照を拒否する。失敗時は既存記録を変更しない。
- AC-03: CLIと両providerの開始hookが同じ更新順・focusを使い、9件以上でもfocusを落とさず、省略数と全件参照手段を明示する。不明focusは別sessionへ自動fallbackしない。
- AC-04: contextは現在状態、次の行動、pending gate、最終checkpoint、task一覧を示す。task/sessionのactiveから実process稼働を推測しない。
- AC-05: checkpointは現在の状態とnextを更新し、過去の現状とcheckpoint履歴を保持する。任意の期待revisionを照合し、pending gateの制限を維持する。
- AC-06: task完了は既存の独立検証receiptと記録された証拠を必要とし、session承認・完了を変更しない。読み取りと不正入力から承認・外部操作は発生しない。
- AC-07: 既存回帰、両provider envelope、旧session、template初期化、生成skill整合性を維持し、実host未試験を明記する。

新規testは上記を実装するためのもの。既存の受入条件、verifier、policy、予算は変更しない。独立確認が終わるまで受入済みとは扱わない。

