# 0.6.1公開記録訂正の独立設計レビュー

2026-09-15。担当 `/root/publication_061_review`。判定: 計画された表記訂正と検証範囲に阻害指摘なし。実装・公開の成功判定ではない。

AGENTS、orchestrate-work、improve-harness、review-work、IMPROVEMENT_LOOP、DOCUMENTATION_STANDARD、DELIVERY_ASSURANCE、旧公開要件、今回のFIX-01〜04、公開計画、SAFE_LOCAL_UPDATE設計/運用、既存acceptance/seal実装を確認した。関連する0.6.0/0.6.1 sessionを読み、`harness:context` と明示review routeを実行した。

- 旧公開4条件の本文を固定してP060-01〜04だけをPUB-01〜04に訂正するため、既存の厳格parserを変更する必要がない。旧ID・欠落・not-runによる完了拒否を残す。
- 既存実文書を用いる2本の回帰試験は、今回の表記不備とseal入口を直接対象にしている。模擬passを本番公開の受入証拠としない。
- 振る舞い・API・データ・権限・依存が不変という限定範囲は、文書標準の軽微な表記修正例外に一致する。品質JSONを新設しない理由が計画にあり、既存の受入・独立レビュー・承認は維持している。
- clean snapshotから旧配布物と未採用HARD-03を分離し、旧版の固定bytesを保持する計画は適切。隔離0.6.0案件の保持・競合停止・導入版を確認する。
- push前のFIX-04はnot-run。seal形式成功とpass receiptを区別し、通常push後にremote/CIの観測を追加してから受入を閉じる。

次は固定snapshotの本文一致、検証器・更新CLI不変、正常/不正seal、配布物/管理bytes、全回帰証拠、隔離更新を独立確認する。実案件・Databricks・GitHub変更・pushはこの担当の範囲外。

## 公開前の手順分離

主担当がFIX-04の「receipt発行・task/session完了」を受入条件に含める自己参照を検出した。公開/remote一致・独立確認・seal形式確認・CIの正確な報告を受入とし、receipt発行からtask/session閉鎖を必須の後続手順へ移す案は適切。旧PUB4条件を完全不変とし、後続手順も省略しない限り要求を弱めない。最初のsnapshotでのaudit58件成功とforward計画は履歴として保持し、applyは未実施。訂正後の別snapshotを確認してから最終判定する。
