# 安全なローカル更新入口の計画

- SU-WORK-01: 要件・設計・独立設計確認 → 固定sourceの計画入口と厳格CLI → 保護・競合・適用後hash試験 → 両provider向けworkflowと日本語手順 → 独立反例レビュー。
- 正式採用前の候補として検証する。0.5.0の既存配布bytes、未採用HARD-03、個別案件は変更しない。
- 候補時の結果: 専用15成功、全回帰633成功/0失敗/1skip、独立27成功。設計指摘解消、公開旧版forward成功。候補の品質契約はwork/evidence/2026-09-15-safe-update-candidate-quality.jsonに保存。
- 現在: 利用者の正式採用承認をADR-0011へ記録済み。0.6.0の採用版検証とprivate公開は[公開計画](2026-09-15-safe-update-publication.md)へ引継ぎ。実案件・実providerは未実行。
