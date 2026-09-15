# 安全なローカル更新入口の独立forward test

## 結論

公開0.4.0の隔離案件を、公開0.5.0を展開したGitなしフォルダーから更新できた。正常対照では計画・適用・backup・全管理hash・案件保持・更新前後checkを確認し、更新後の全harness試験は433 pass / 0 fail / 1 skip、案件試験は2 pass。候補新入口の専用試験も独立に15 pass。

これは未公開CLIに明示的なテスト許可を与えた隔離試験。実案件の更新・正式採用・公開の証明ではない。**実Claude Code / Copilotモデルを起動した検証ではない。** 生成skillの静的同一性とCLIの動作を確認した。

## 範囲と前提

- 独立検証者: `/root/safe_update_forward_test`。実装担当とは別context。製品コード、運用文書、公開配布物は変更していない。
- 読了: AGENTS、orchestrate-work、update-harness、安全更新/旧版更新手順、TASK_VISIBILITY、DOCUMENTATION_STANDARD、CLI_REFERENCE、今回の要件・設計。
- 親session: `20260915-010502-538-safe-local-harness-update` / `SU-WORK-01`。元repoは読取りのみとし、このレビューと`work/evidence/2026-09-15-safe-update-forward*`へ記録。
- 環境: Windows / Node.js v24.15.0。sandbox helper起動失敗後、許可されたrequire_escalatedとapply_patch CLIで証拠・fixtureを扱った。
- 実行器: `D:/projects/databricks-dev-harness/tools/update-harness.mjs`。SHA-256 `08f36fded24a7dcb412b5336e4de7609690e573c18205a696195678425d217f7`。未公開候補は試験限定。
- 更新材料: `.harness/releases/0.4.0`（1012管理ファイル）と`.harness/releases/0.5.0`（1057管理ファイル）。全payloadをmanifestと照合し、元bytesを別tempへコピー。
- 旧baselineは公開0.4.0の元manifestを配置し、案件の現在bytesから再生成していない。
- sourceは`harness/base-release.json`付きclean-sourceで、Git・release cacheはない。targetにもGitはない。
- 実案件、push、Databricks、実provider、外部network操作は実行していない。既存testはlocal/mockの範囲。OSレベルのnetwork遮断は検証していない。

## 現実的な依頼と実行

「この案件のハーネスを、指定したローカルフォルダーから更新して。」を依頼とし、以下のpathを指定。保持対象の列挙やforce回避の文言は依頼へ追加していない。

| 項目 | 正常対照 |
| --- | --- |
| 対象 | `C:/Users/nimao/AppData/Local/Temp/safe-update-forward-mzrNox/legacy project` |
| 指定更新元 | `C:/Users/nimao/AppData/Local/Temp/safe-update-forward-mzrNox/clean source 0.5.0` |
| 版・選択 | 0.4.0 → 0.5.0 / source-tree |
| 計画 | `.harness/updates/update-20260915-012338-130-84201d84.json` |
| 差分 | update 45 / add 45 / keep 967 / conflict 0 / delete 0 |
| 適用 | 更新90、全1057管理hash確認、humanReviewRequired=true |

旧案件にCLIがないため、上記実行器の絶対pathに`plan --source SOURCE --target TARGET`、続いて`apply --plan PLAN --yes --target TARGET`を渡した。完全な引数・cwd・終了値は[plan実行記録](../evidence/2026-09-15-safe-update-forward-control-plan.json)と[apply実行記録](../evidence/2026-09-15-safe-update-forward-control-apply.json)に保存。

案件sessionへfresh tempに対する唯一の書込み担当を記録し、他agent/provider/background writerを起動していない。差分とmanual-reviewを[適用前確認](../evidence/2026-09-15-safe-update-forward-control-plan-review.md)に記録してから、既存の明示的fixture適用許可で適用。利用者本人の追加承認を仮装していない。

## 確認結果

| 確認 | 結果 | 主証拠 |
| --- | --- | --- |
| 計画の不変性 | 管理1012・案件20・baseline不変 | [計画照合](../evidence/2026-09-15-safe-update-forward-control-plan-verification.json)、[初期hash](../evidence/2026-09-15-safe-update-forward-control-state.json) |
| 配布形式とGitなしsource | 全1057 operation同一 | [形式比較](../evidence/2026-09-15-safe-update-forward-control-source-equivalence.json) |
| 適用・保護 | 管理1057・案件20がbyte一致 | [適用照合](../evidence/2026-09-15-safe-update-forward-control-apply-verification.json) |
| backup・導入版 | 更新45の旧bytesと旧baseline一致、installed=0.5.0 | [journal](../evidence/2026-09-15-safe-update-forward-control-journal.json)、[導入版](../evidence/2026-09-15-safe-update-forward-control-installed-baseline.json) |
| 原本保護 | 両公開manifest/全payload・展開source不変 | [原配布hash](../evidence/2026-09-15-safe-update-forward-control-release-inputs.json)、[適用照合](../evidence/2026-09-15-safe-update-forward-control-apply-verification.json) |
| check | 旧版・新版成功 | [旧](../evidence/2026-09-15-safe-update-forward-control-old-check.json)、[新](../evidence/2026-09-15-safe-update-forward-control-new-check.json) |
| 案件計算・拒否 | 更新前後2 pass | [案件試験](../evidence/2026-09-15-safe-update-forward-control-new-product-test.json) |
| 更新後全harness試験 | 434件: 433 pass / 0 fail / 1 skip | [全出力](../evidence/2026-09-15-safe-update-forward-control-new-harness-tests.json) |
| 候補新入口専用試験 | 15 pass / 0 fail | [全出力](../evidence/2026-09-15-safe-update-forward-control-candidate-entry-tests.json) |
| 試験後hash | 管理1057・案件20再照合一致 | [最終照合・対象hash](../evidence/2026-09-15-safe-update-forward-control-final-verification.json) |
| 新processから読取り | 0.5.0・案件名・既存session表示 | [context](../evidence/2026-09-15-safe-update-forward-control-new-context.json) |

案件20件は`state.json.protectedPaths`の母集団。product.config、package/lock、README、docs/product要件・設計・既存基準、work/session、src実装・試験、apps未コミット相当、resources、.vscode、合成.env、.harness/local.json等を含む。管理1057、baseline、plan、snapshotは別に検証した。途中の人向け説明の「22」は誤計数で、機械証拠は当初から20件。訂正記録を計画説明へ追記した。

## 発見・再確認

1. `.harness`表記は初回`define`へ誤routingした。[初回](../evidence/2026-09-15-safe-update-forward-dot-harness-route.json)。実装担当へ共有後の修正で「ハーネス」「.harness」「harness」はupdate-harness、更新処理の改善はimprove-harness、すべてexecutionAuthorized=falseを再確認。[修正後](../evidence/2026-09-15-safe-update-forward-control-final-route-dot.json)、[改善依頼](../evidence/2026-09-15-safe-update-forward-control-final-route-improve.json)。
2. 初回fixture `safe-update-forward-DC37Di`には案件独自`.github/skills/project-custom/SKILL.md`を配置。checkは更新前後とも同じfile-list差分で失敗したが、独自skillを含む案件20ファイルは不変。syncで削除・再生成していない。[旧check](../evidence/2026-09-15-safe-update-forward-old-check.json)、[新check](../evidence/2026-09-15-safe-update-forward-new-check.json)、[保護照合](../evidence/2026-09-15-safe-update-forward-apply-verification.json)。初回fixtureの案件受入は未完了。
3. 初回fixtureは.gitignore不足により全試験432 pass / 1 fail / 1 skip。`docs.test.mjs`が案件所有.gitignoreを読む際のENOENTであり、updater管理対象ではない。[初回全試験](../evidence/2026-09-15-safe-update-forward-new-harness-tests.json)。初回は改変せず、.gitignore・正規name/displayNameを最初から持つ正常対照を別tempで一から実行した。正常対照はprovider customなしで、保護対象20件（custom skillを.gitignoreへ置換）。
4. 実装担当が旧版更新手順の無条件agent-assets:syncを除去し、新旧両手順に独自差分を保持してレビューする文面を追加した。全文を再読し最終hashを記録。
5. 試験runner自身の括弧構文誤りと、保護文面の期待語句不一致を修正した。製品コードの不具合には数えない。

## スキル評価と未実施

candidate canonicalとClaude/Copilotの生成skillは全文byte一致（SHA-256 `061ba7e61c1e18bd257aa660d613cbcb4642d8d06d8c80457c8b7631126e6367`）。[全文・hash](../evidence/2026-09-15-safe-update-forward-control-provider-skills.json)。モデルが実際に読み計画説明や人の確認を守ることは未検証。

SU-01/02/04の通常更新は公開payloadで確認。競合、未知baseline、path/引数拒否、snapshot改変、stale plan、途中破損、replay拒否、次版CLI導入後の再更新は候補専用15試験で補った。実案件の手動競合解決・実障害復旧の証拠ではない。

公開0.5.0には候補CLIとupdate-harness skillがないため、この0.4→0.5更新後に候補CLIが案件へ入るとは扱わない。通常運用の短い入口は候補を含む版の採用・公開後に使う。今回のテスト許可はそのgateを解除しない。

残る制約:

- 1 skipはhostがfile symlink作成を許可しない既存試験。directory junction拒否と候補source junction拒否は成功。
- 実Claude/Copilot canary、実案件の業務受入、Git branch運用、実Databricks、公開・配備は未実施。
- 既存session読取りは新Node processで確認。実モデルの新contextによる開発再開ではない。
- 両tempのbackup/snapshotは保持。復旧不要判断や削除は実行していない。
- この独立forward testの範囲で未解消の更新機能の阻害指摘はない。正式採用・公開・実案件/実providerの判断は親担当へ戻す。

[証拠runner](../evidence/2026-09-15-safe-update-forward-runner.mjs)の再試験時は新しい証拠prefixを使い、prepare control → plan control → 計画確認 → apply control → verify control → recheck controlの順とする。既存証拠を上書きしない。
