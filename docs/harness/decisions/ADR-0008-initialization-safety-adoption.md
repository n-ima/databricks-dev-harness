# ADR-0008: 初期化・生成ルート検査の正式採用

Date: 2026-09-10 (JST)
Status: accepted — local HARD-08 scope only

## 決定と承認

ユーザーの「採用してOK」により、HARD-08 / HIMP-08 のローカル限定実装を
正式採用する。同じ投稿の「ここで１度pushしてください。リモートへ。」により、
蓄積したハーネス改善と検証記録を既存の private リポジトリ
`n-ima/databricks-dev-harness` の `main` へ通常のpushで保存する。
採用判断とソース送信の承認は、実環境での実行承認とは区別する。

対象は、製品状態を混入させないoffline fixture、同名setupの設定保持、
AppKit生成rootの型・上限・同一性・control bytes検査と、その試験・設計である。
[最終独立レビュー](../../../work/reviews/2026-09-10-initialization-final-review.md)で
HI-01〜04が解消し、ローカル限定範囲の未解消P1/P2がないことを確認済み。
全体504 pass / 0 fail / 1既存skip、独立42 pass。

## 証拠を変更しない

[採用記録](../../../work/evidence/2026-09-10-initialization-adoption.json)が、
独立レビューのSHA-256と、その表の26ファイルを束縛する。
実装・試験・旧設計・レビュー・過去ログは変更しない。
旧設計やレビューの「candidate / adoption pending」は当時のスナップショットであり、
本ADRが採用状態を更新する。失敗ログも残し、成功ログへの上書きはしない。

出版前確認で、旧aliasレビューが参照したログ1件の名前再利用による不一致が判明した。
[追補](../../../work/evidence/2026-09-10-initialization-log-erratum.md)に欠落と範囲を記録し、
その旧参照は採用根拠に含めない。最終r6レビューと26対象の一致は別途確認する。

Gitの改行変換で証拠を変質させないため、`work/evidence/**/*.log` にだけ
`-text` を指定する。コードと通常文書のLFルールは維持する。
送信前に既存の受入判定・simulation採用範囲と今回の26ファイルを照合し、
ステージした各ファイルが作業コピーと同じbytesであることを確認する。

## 範囲外と継続事項

- Databricks接続、実CLI/AppKit生成、実DB・データ・権限変更、配備は行わない。
- 個別案件の反映、実Claude Code/Copilot試行、課金評価は行わない。
- バージョン番号、tag、可視性、GitHub課金・保護設定は変更しない。
- HIMP-01とHARD-02/07 simulation-onlyの既存採用は維持する。
- 本記録は完了receiptでも実行approvalでもない。全8要件の完了を主張せず、
  HARD-08 taskはverifying、成熟度はL1を維持する。
- 実CLIが生成するnode_modules等と走査上限/link拒否の適合はHARD-06で検証する。

採用した限定範囲を再度承認待ちに戻さない。後続作業はHARD-03/04/07の
承認範囲・稼働状況表示であり、今回はここでソースをpushして区切る。
