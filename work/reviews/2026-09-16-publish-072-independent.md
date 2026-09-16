# 0.7.2 書式訂正・配布の独立レビュー（push前）

2026-09-16。担当 `publish_071_review`、context `/root/publish_071_review`。baseは公開済み0.7.1の`12a8feae976cb6b1ec0ec2b8a77c716764be6d1f`。

## 結論と071レビューの訂正

訂正後のPUB-01〜03は記載した検証範囲でpass、PUB-04は0.7.2未pushのためnot-run。配布前の阻害指摘はない。0.7.1で書式不正の受入IDを独立レビュー時にも既存parserへ渡さず、完了receiptにできないことを見逃した。旧reviewは当時の配布/更新/remote観測として保持するが、seal受理を確認した証拠とはしない。今回その不足を負例・正常例・欠落拒否の実行で補った。

## 訂正の同等性と既存検証器

- 公開済み正本をGitから取得して既存`acceptanceIds`へ渡すと、`Invalid acceptance ID at line 15: PUB-071-01`で拒否された。
- 訂正後の正本はPUB-01〜04を取得でき、4条件の本文が旧正本と完全一致する。見出しと訂正注記は0.7.2適用を説明するのみ。
- `assertAcceptanceCoverage`で4項目の新IDを受理、1項目欠落と旧IDを拒否。`acceptance.mjs`と`evidence.mjs`は071commitとbytes不変。検証器を緩めていない。
- 独立に`node --test tests/acceptance.test.mjs tests/contracts.test.mjs`を実行し105pass・0fail・0skip。既存Publication requirements試験は9/15の2文書固定のため、今回正本は別途直接検査した。一般的な全回帰成功だけで新正本の構文受理を認定しない。
- source変更は版3ファイル、公開正本、HARNESS_DEVELOPMENTのstamp前検査段落、0.7.2案内、stampのみ。CLI/skills/evals/承認schema/依存は不変。新たな業務機能や安全条件緩和はない。

## 受入条件

| ID | 判定 | 根拠と実行主体 |
|---|---|---|
| PUB-01 | pass | 正式採用済み内容を保持し、旧ID→新IDの1対1訂正と0.7.2移行案内を独立照合。0.7.0から直行/0.7.1から更新、旧版を上書きしないことを明記。 |
| PUB-02 | pass | 独立source checkで0.7.2/1110件/stamp一致、harness check成功。独立105件成功。主担当の新版全回帰728件中726pass/0fail/2skipとGit改行往復1110一致をログ確認。 |
| PUB-03 | pass | 主担当の更新script差分と新規r1(0.7.0)/r2(0.7.1)の実結果を確認。各旧版からcacheなしsource/固定payloadの双方で1110hash一致、案件9ファイル保持、冪等、競合拒否、旧版不変。両経路各12publication tests成功。更新器不変のため071の独立更新と競合反例を維持し、072全経路を独立担当が再実行したとはしない。 |
| PUB-04 | not-run | 0.7.2のcommit/main到達とexact commitのCI実状態は後続。071の到達を072の到達へ読み替えない。 |

manifest SHA-256: `da753bd8d5ea6dcdb943dc0182a647d54d59ea767c7e03717fb1f9efede9c42c`。managed files 1110。旧0.7.0/0.7.1の固定配布物を変更しない。競合ログのall writesは管理ファイル適用の拒否の意味に限定し、planが`.harness`へ記録を書込むことは除外する。

## 証拠と限界

今回の直接検査は`work/evidence/2026-09-16-publish-072-independent-format.json`。主担当のcriteria、regression、bytes、update-r1/r2も参照。stamp前の実正本解析とreview coverage確認を公開手順へ追加したことを確認した。機械検査の事前実施を省略してはいけない。

実案件適用、Databricks、実Claude Code/Copilot反復比較、効率改善率は未実行。072のCIや公開はこの記録時点で未確認。旧PDDreceiptは071policyの歴史的証拠として保持し、072policyに対する新しいreceiptと取り違えない。
