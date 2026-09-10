---
title: Retrospective-driven harness hardening
status: draft
date: 2026-09-10
owner: harness-maintainer
adopted_scope: HIMP-01
adoption_decision: docs/harness/decisions/ADR-0006-acceptance-integrity-adoption.md
---
# 振り返りからの安全性・再現性強化

採用状態: HIMP-01のみ2026-09-10にユーザーが正式採用を承認した。[ADR-0006](../decisions/ADR-0006-acceptance-integrity-adoption.md)参照。残り7項目を含む文書全体はdraftのままとし、受入条件本文は変更しない。

## Intent

利用者は2026-09-10に、現行比較報告の推奨順序での改善を指示した。世界最高・最先端を目標とし、比較可能な範囲の安全性・品質・効率・可観測性を継続評価する。世界中の全実装に無条件で優越すると宣言する仕様ではない。

根拠: [現行比較](../../../work/reviews/2026-09-10-sales-retrospective-validation.md)。個別アプリを変更せずハーネス側に汎用の差分を実装する。既存のタスク・session・approval・receipt・公式CLIを拡張し、重複する制御を増やさない。

## Acceptance criteria

- HIMP-01: 要件のIDを生成・承認・review・seal・receipt利用で同じ文法に従って検証し、不正形式・0件・重複・不足・余分なreview IDを区別して拒否する。AC-01/AC-D01と既存H-01形式を保持し、無視した条件を残したまま完了できない。
- HIMP-02: 同じ候補・環境・有効な承認を使う検証→配備→終端確認→起動→health経路を持ち、失敗・中断・timeout・hash変更時は以降の副作用を起動しない。公式CLIを利用し、直接CLIや同一OS権限の完全統制を保証しない。
- HIMP-03: 環境・資源・主体・操作・権限・費用の承認範囲を永続化し、同じ有効範囲を引継げる一方、拡大や不一致・失効は新たな人の判断を要求する。
- HIMP-04: 既存のtask/session状態と、製品の環境・URL・配備版・最終観測時刻・証拠状態を分離して表示する。観測していない稼働を主張しない。
- HIMP-05: モックと必要な権限の承認後、専用devのfixtureで認証→保存→再読込・拒否を早期に検証する段階と証拠を持つ。実データ・本番の前倒しはしない。
- HIMP-06: サポートするAppKit/CLI/OSの組合せを明示し、clean生成/build/install/identity/host/themeの適合性を正負試験で確認する。版が違う案件対策を無条件に共通化しない。
- HIMP-07: 配備候補の実行入力・検証専用入力・進捗記録を区別し、候補hash・配備ID・レビュー・観測を結び付ける。更新や再試験は影響範囲に基づき、証拠をすり替えない。
- HIMP-08: 未初期化fixtureと案件fixtureを分け、生成先の想定／実コンポーネントルートを安全に検査する。改名・上書き・パス境界の拒否を維持し、未知の出力を再帰移動しない。

## Human and independent gates

ユーザーの「推奨案で進めて」はローカル改善候補の作成を承認したものとして記録する。verifier・security・permissionsの最終昇格は独立レビューと人の判断を必要とする。本要件を実装者だけでacceptedへ変更しない。実workspace操作、課金、資格情報、案件更新、リリース、pushはこの作業から推定しない。
