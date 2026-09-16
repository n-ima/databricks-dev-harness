# 0.7.1 公開の独立受入

担当: `publish_071_review`、context: `/root/publish_071_review`。最終観測: 2026-09-16 09:33:43 UTC。

## 結論

PUB-071-01〜04は、要件に記載された範囲でpass。private GitHub `n-ima/databricks-dev-harness` のmainが、独立レビュー済み配布source commit `12a8feae976cb6b1ec0ec2b8a77c716764be6d1f` と一致することを直接読み取り確認した。0.7.1のstampと更新経路は確認済み。

**GitHub CIの成功は確認できていない。** exact commitのrun/checkは複数回と45秒間隔後の再確認でも0件だった。workflow active、Actions enabledであることは確認したが、実行未観測の理由は特定していない。combined statusの`pending`/statuses0は実ジョブが稼働中という証拠ではない。PUB-071-04は「CIの実状態を確認し、未実行・失敗を成功にしない」という要件に対するpassであり、CI成功への読み替えではない。再実行や設定変更は行っていない。

## 受入条件

| ID | 判定 | 根拠 |
|---|---|---|
| PUB-071-01 | pass | accepted要件、ADR-0013、0.7.1リリース案内を独立照合。既存案件保持と移行注意、実provider/Databricks/効率比較の未検証を区別。 |
| PUB-071-02 | pass | 同期/構造検査、版/manifest1109件一致、独立Git clone・更新r2、主担当の全回帰726pass/0fail/2skipと改行往復証拠を確認。push後もcommitted checkを独立再実行しstamp-valid。 |
| PUB-071-03 | pass | cacheなしsourceと固定payloadから0.7.0→0.7.1を独立再実行。案件9ファイル保持、1109hash一致、再plan冪等、旧0.7.0不変。追加競合反例は1106file集合/bytesが不変、新規7管理pathも未作成。 |
| PUB-071-04 | pass | stage対象124件＋独立stage記録だけを確認した後のsource commitを、private remote mainから読み取り照合。committed stamp一致、`.harness/`差分なし。exact commitのCIはrun/check0として記録し成功認定しない。 |

## 対象と境界

- 配布source: `12a8feae976cb6b1ec0ec2b8a77c716764be6d1f`、base `6fedb4a4dd6f3bc9db1982cd195166f078864b0a`。
- manifest SHA-256: `44c108e6190995de279842e8c237cfa89d65d5710b895fe558273790fa918bbb`、版0.7.1、管理1109件。
- [配布前レビュー](2026-09-16-publish-071-independent.md)と[stage確認](2026-09-16-publish-071-stage.json)は履歴として保持し、not-runだった過去記録を書換えない。
- [remote観測](../evidence/2026-09-16-publish-071-remote.json)は公開先/commit/CIの読取結果。主担当の実施したpushを独立担当が代行した意味ではない。
- この後に公開後証拠・receipt・task/session完了記録等の`work/`限定commitを追加してよい。配布source・版・stampを変更した場合はこの判断を流用しない。後続SHAは別途読取確認し、証拠commitを無限に作り直さない。

## 未検証

GitHub hosted CI成功、実案件への適用、実Claude Code/Copilot反復比較、時間・token・費用削減率、Databricks認証/DB/配備、全状態の正式UI受入は認定しない。合成案件の更新試験は実案件の業務受入を代替しない。ハーネス自身をDatabricksへ配備していない。
