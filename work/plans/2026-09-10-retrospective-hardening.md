---
title: Retrospective hardening execution plan
status: in-progress
---
# 実行順序

1. HIMP-01 — ID検証の契約を独立確認し、反例のred→実装→green→再レビューを実施。2026-09-10に人の正式採用承認を記録済み。
2. HIMP-02 + HIMP-07の候補識別 — 公式CLIとの役割分担、candidate/approval/state設計と副作用ゼロのfake runner試験。
3. HIMP-08 — fresh/initialized fixtureと生成ルートの境界。
4. HIMP-03 + HIMP-04 + HIMP-07の表示 — 既存台帳を統合。
5. HIMP-05 + HIMP-06 — 対応版の最小dev経路。live検証には対象と承認が別途必要。

各taskはwork/tasksの正本へ記録し、verifyingは自己試験・レビューの状態であってリリース完了ではない。検証環境を毎回記載する。

## 現在地（2026-09-10）

| 要件ID | 実行task | リスク | 現在の証拠段階 |
| --- | --- | --- | --- |
| HIMP-01 | HARD-01 | high | 正式採用済み（ローカル、未公開）。専用47成功・関連169成功・独立28成功、指摘3件解消。全8項目のreceiptは未作成のためtaskのverifyingは維持。 |
| HIMP-02 | HARD-02 | high | simulation-only runner/固定CLIを正式採用（ADR-0007）。独立4指摘解消、専用62pass・独立32pass、全回帰457pass/1skip。live adapter・公開・全要件完了は未実施。 |
| HIMP-03 | HARD-03 | high | 計画。既存approvalを拡張し、範囲一致を機械検証する。 |
| HIMP-04 | HARD-04 | medium | 計画。既存task表示とは別に製品稼働の観測を扱う。 |
| HIMP-05 | HARD-05 | high | 計画。実環境の接続・権限・費用は別途人の判断が必要。 |
| HIMP-06 | HARD-06 | medium | 計画。CLI/AppKit版ごとのclean生成を実測する。 |
| HIMP-07 | HARD-07 | high | source/validation/session/scopeとraw-byte policy/dispatcherを束ねたcandidate、合成観測を正式採用（ADR-0007）。実配備artifact同一性・実runtimeとの対応は未実施。 |
| HIMP-08 | HARD-08 | medium | ローカル範囲を正式採用（ADR-0008）。固定fixture/生成root検査、HI-01〜04修正。全回帰504pass/1skip、独立42pass。実CLI互換は未実施。private source pushを別途承認済み、versioned releaseではない。 |

HIMP-*は要件IDとして継続。最初の同名taskはriskの既定lowを訂正するためcancelled履歴を残し、同じ対象のHARD-*へ引継いだ。項目を削除したり、要件を達成したと扱ったりする変更ではない。

## 実行開始の根拠

2026-09-10のユーザー指示「推奨案で進めてください」。改善候補の実装を開始する。安全策を緩める承認や実DB操作の許可ではない。前回の検証sessionは履歴として残し、この計画には独立の実装sessionを作る。

正式採用: 同日の「正式採用してよい」によりHIMP-01の採用判断待ちを解消。[ADR-0006](../../docs/harness/decisions/ADR-0006-acceptance-integrity-adoption.md)へ対象hashと範囲を記録した。次はHARD-02/07、HARD-08。公開・案件反映や全改善の完了を承認した意味ではない。

後続の正式採用: HARD-02/07のsimulation-only範囲も、別の「正式採用してよい」により採用済み。[ADR-0007](../../docs/harness/decisions/ADR-0007-deployment-simulation-adoption.md)参照。次はHARD-08。実配備・公開・全8条件の完了は依然別であり、同じ限定採用を再び確認しない。

最新の正式採用: 「採用してOK」によりHARD-08を採用した。
[ADR-0008](../../docs/harness/decisions/ADR-0008-initialization-safety-adoption.md)参照。
同じ投稿で蓄積した改善のprivate source pushも承認済み。上の未公開表記は
採用時点の履歴であり、送信の結果はgitのcommit/remoteとチャットの確認結果を参照する。
次の実装はHARD-03/04/07。全8要件の完了や実環境配備とは区別する。
