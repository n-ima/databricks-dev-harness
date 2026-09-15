# 公開後の受入記録形式の不備

2026-09-15。安全更新0.6.0のsource commit `69ebf2ebe33da2bc3a551970e40fb5edca9667b7` はprivate origin/mainへ公開済み。機能のSU-01〜05はclean snapshotで独立受入・receipt固定済み。一方、公開タスクSU-PUB-060の機械受入記録は未完了。

## 実測

公開snapshot `.harness/runtime/publish-0.6.0` で次を実行した。

```text
node tools/harness.mjs evidence seal --review work/reviews/2026-09-15-publication-060-acceptance.json --session 20260915-013942-357-publish-safe-update-0-6-0 --requirement docs/harness/requirements/2026-09-15-safe-update-publication.md --artifact harness/base-release.json --artifact work/quality/safe-local-update.json
```

終了値1: `Harness error: Invalid acceptance ID at line 12: P060-01`。後続のtask done/session closeは実行していない。

## 原因と境界

主担当が作成した公開要件のIDに、検証器が許容しない数字入りprefixを使った。独立レビューも意味上の条件と実測は確認したが、sealの事前実行を見落とした。検証器は仕様どおり拒否しており、更新CLIの試験失敗ではない。意味上の公開確認と、機械的に封印済みの公開受入を混同しない。

公開済み0.6.0のmanifest/payloadを上書きしない。ID parserの許容範囲を広げない。別の緩い要件を作って既存taskの完了gateを迂回しない。SUのreceipt/qualityは変更しない。rootには未採用HARD-03があるため、受入を行った対象はroot全体ではなく公開snapshotである。

## 残作業

公開要件の4条件を意味変更なしで正式ID形式へ訂正する差分を独立確認し、必要な人の確認後、新しいpatch版で公開する。immutable 0.6.0ではなく次版を新規生成してbyte一致と試験・手順を再検証する。今回はSU-PUB-060をblockedとして残し、公開成功だけを報告して全作業完了とは報告しない。既存案件・Databricksは未操作。
