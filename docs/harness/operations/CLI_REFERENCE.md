# Executable workflow reference

品質契約: `npm run harness -- delivery check --contract work/quality/FEATURE.json --phase design|verify` は読取専用の参考診断。`delivery hashes --contract ...` はbasis/review hashの計算。終了0でも実行や業務受入の証明ではない。[形式と運用](DELIVERY_ASSURANCE.md)を参照。agentが日本語で観点と結果を説明し、利用者にJSON編集を求めない。

通常はユーザーではなくエージェントが操作します。以下は1行コマンドです。Windowsでbashの `\` 継続を使わないでください。

## Intake / 人の判断

API/分析/MLなど全対象の具体例は[PLATFORM_PLAYBOOK](PLATFORM_PLAYBOOK.md)へ。対象を複数発見し、必要な質問/公式技能/検証をintakeへ渡せます。分類は承認ではありません。

```text
npm run harness -- workload list
npm run harness -- workload resolve --prompt "UI不要のApps REST APIとLakebase"
npm run harness:route -- --prompt "まず要件を議論したい" --intent define
npm run intake -- create --title "受注API" --summary "合意前の要求" --workload api --workload lakebase
npm run scaffold -- plan --kind api --name orders-api
npm run scaffold -- plan --kind analysis --name demand-exploration
```

`--workload`の繰返しは完全な明示選択、`--without`は除外です。API/analysis生成物はtests/fixtures内の非deploy契約で、profile不要。実装用runtime・DB・Databricks環境は承認後に別途整えます。

```text
npm run intake -- create --title "受注更新" --summary "毎日取り込み再実行可能にする" --source docs/product/intake/brief.md
npm run intake -- show --id INTAKE_ID
npm run intake -- answer --id INTAKE_ID --question Q-01 --answer "運用担当の照合作業を短縮する" --actor product-owner
npm run intake -- approve --id INTAKE_ID --actor product-owner --evidence "ユーザーの明示決定への参照"
```

日本語titleだけでも作成可能。資料はrepo内・許可拡張子・50MB以下。material questionsに回答し、feature固有の受入条件をrequirementに定義してから承認します。資料からの回答と人の決定を区別し、エージェントが本人を名乗って承認してはいけません。

```text
npm run harness -- approval create --session SESSION_ID --gate ui-mock --actor product-owner --evidence work/evidence/mock-review.md --artifact apps/sales/src/App.tsx --artifact apps/sales/src/fixtures.ts
```

reviewにはjourney・状態・desktop/narrow/keyboard証拠・人の決定を記載。hashは変更を検出しますが本人認証ではありません。

## Scaffold — planを確認してからapply

```text
npm run scaffold -- plan --kind app --purpose mock --name sales-insights --profile sales-dev --host https://YOUR-WORKSPACE.cloud.databricks.com
npm run scaffold -- plan --kind app --name sales-app --feature analytics --profile sales-dev --host https://YOUR-WORKSPACE.cloud.databricks.com --data-access analytics --mock-approval work/approvals/SESSION_ID/ui-mock.json --set analytics.sql-warehouse.id=WAREHOUSE_ID
npm run scaffold -- apply --plan work/scaffolds/PLAN_ID.json --yes
```

固定versionの公式manifestからplugin・resource・MUST rulesを収集します。planのmissingを解決し、planを作り直します。rules全体の承認は `--rules-approval PATH`、before-init rulesごとの証拠は `--rule-evidence RULE_ID=PATH` を使います。JSONの形式・rule ID・manifest hashはplanで確認してください。未知keyやplatform生成値を上書きしません。initとvalidateまででdeployは行いません。完全解決済みのCLI確認を自動応答する場合だけplan時に明示 `--auto-approve` を指定します。

rules承認ファイルとbefore-init証拠の最小形式は以下です。値は実際のplanと確認結果に置き換えます。appkit-rulesはエージェントの規則確認の記録であり、本人の画面・権限承認の代わりにはなりません。

```json
{"gate":"appkit-rules","decision":"approved","actor":"implementing-agent","evidence":"work/evidence/appkit-rules-review.md","manifestSha256":"64-character-hash-from-plan"}
```

```json
{"ruleId":"rule-id-from-plan","status":"passed","summary":"実際に確認した結果","verifiedAt":"2026-09-04T00:00:00Z"}
```

mockでも公式CLIのinitにはworkspace認証が必要です。明示profile/hostの開発接続だけを検証し、live-data feature/resourceを禁止します。profile未指定ならinitへ進みません。生成Bundleはfixture-only名へ退避し、誤deployを避けます。本データ接続時はmockを承認し、integration planを別に作り、確認済みUIを移植します。Lakebase/Genieの既存再利用か新規作成かは先に人が決めます。APIは生成後のinstalled AppKit docsで確認します。

applyはplanと出力先の両方をlockします。同じ出力先への並行生成は拒否。中断した場合は実行processと生成物を調べてから、そのplanと `.harness/runtime/scaffold-targets/` の該当lockだけを回復してください。部分生成物を黙って上書き・削除しません。

```text
npm run scaffold -- plan --kind data-update --name orders --source-table dev.bronze.orders --target-table dev.silver.orders --key order_id --sequence-by updated_at
npm run scaffold -- plan --kind genie --name sales-genie --table dev.gold.sales --question "先月の地域別売上は？" --question "前年との差は？" --question "返品除外売上は？"
npm run scaffold -- plan --kind metric-view --name sales-metrics --source-table dev.gold.sales --dimension "region=region" --measure "revenue=SUM(amount)"
```

local scaffoldもdraftです。dataは生成Python契約試験と実Delta試験、Genieは期待結果を埋めたbenchmark、Metric Viewsは意味・権限・粒度を検証します。data jobは承認後に引数へ `--execute` を追加するまでSpark書込へ進みません。Genieのresourceは `resources/drafts/`、Metric SQLはdraft名で保存されます。generatorはDDL・本番操作を実行しません。

## Sessions / knowledge

配備停止制御の固定fixture試験は [DEPLOYMENT_SIMULATION](DEPLOYMENT_SIMULATION.md) を参照。`deployment simulate` は合成結果だけを使い、Databricksを操作しない。実アプリのbuild/testやlive稼働の証拠ではない。

タスク一覧・現在地・focus付き再開は[TASK_VISIBILITY](TASK_VISIBILITY.md)を参照。通常はagentが`task create/update`を操作し、`status`の同じ記録からチャットの一覧を返す。`context --session ID`は読み取りのみ、`status --write`だけが`work/STATUS.md`を生成する。

```text
npm run session:checkpoint -- --id SESSION_ID --summary "確認済み現状" --next "次の具体的な行動" --evidence work/evidence/test-run.md
npm run knowledge:add -- --scope product --title "営業日境界" --body "業務日をAsia/Tokyo 05:00で区切る" --confidence high --source docs/product/decisions/ADR-0001.md --applies-to "受注集計のみ" --review-after 2026-12-01
```

通常はintake createが作ったsessionを使います。既存のaccepted requirementから別sessionを開始する場合はsession:startでリンクし、人の決定を示す証拠をapproval create --gate product-intentで記録してください（intakeを持つrequirementはintake approveを使います）。checkpointはsummaryとnextが必須。pending gateを飛ばしてimplementへ移せません。knowledgeはsource/confidence/適用範囲必須、既定90日後再確認。`--supersedes docs/product/knowledge/OLD.md`で旧項目をsupersededにしINDEXにも記録します。

## Bounded loop

```text
npm run loop -- init --session SESSION_ID --provider manual --max-iterations 8 --max-wall-minutes 120
npm run loop -- show --id LOOP_ID
npm run loop -- run --id LOOP_ID --execute
npm run loop -- record --id LOOP_ID --outcome progress --summary "sliceを検証" --evidence work/evidence/slice.md
npm run loop -- gate --id LOOP_ID --gate ui-mock
npm run loop -- approve --id LOOP_ID --evidence work/approvals/SESSION_ID/ui-mock.json
npm run loop -- stop --id LOOP_ID --outcome cancelled --reason "安全に中断"
```

manualは今のチャットで実装しchecks/stateをCLIに記録。headlessはproviderをclaude/copilotにし `--isolation-evidence work/evidence/isolation.json` を指定します。

```json
{"status":"approved","actor":"environment-owner","credentialScope":"development-only","sandbox":"reviewed ephemeral container; no production credentials"}
```

記録だけでsandboxは作られません。実際に隔離環境を用意します。Claudeのauto permissionもOS隔離ではありません。`loop run`はdry-runが既定。実行前後と完了直前にpolicy/requirement hashを確認。policy変更は別のレビュー済みloopに分けます。未record反復の黙った再実行は拒否します。

1プロセスずつ時間制限します。実行中はrecord lockを保持するためloop stopは割り込めません。先にterminal/container側で停止し、子・孫プロセスの終了を確認します。crash後にlockが残る場合は記載PIDと副作用を調査してからそのrecordの.lockだけを解除し、outcomeを記録するかcancelしてください。孫プロセスの完全停止はOS/container側の責任です。費用はprovider側でsoft/hard上限を確認し課金側予算も設定します。hooksのcheckpoint要求は意味理解・自動要約ではありません。

## Verification / completion

独立verifierは実装を変えずに試験を再実行しreview JSONを作成。判定不能はnot-run、問題はfailです。

```json
{"reviewer":"independent-reviewer","provider":"manual","independent":true,"acceptance":[{"id":"AC-01","status":"pass","evidence":["work/evidence/actual-result.md"]}]}
```

```text
npm run evidence -- seal --review work/reviews/review.json --session SESSION_ID --requirement docs/product/requirements/orders.md --artifact src/data_products/orders/job.py
npm run loop -- record --id LOOP_ID --outcome achieved --summary "全受入条件を独立検証" --evidence work/evidence/actual-result.md --verifier-evidence work/reviews/SESSION_ID.receipt.json
npm run session:close -- --id SESSION_ID --outcome completed --summary "全受入条件を独立検証" --verifier-evidence work/reviews/SESSION_ID.receipt.json
```

requirementの `- AC-01:` 形式の全項目が必要。sealはsnapshot固定で、reviewerの本人認証や判断の正しさの保証ではありません。別reviewer・CI・branch protectionが必要。pending gate、変更hash、証拠なし完了を拒否します。

loopを利用している場合だけ `loop record --outcome achieved` を実行します。直前に未recordの `loop run --execute` がありchecksがpassしている必要があります。progressを記録済みなら、最終checksの反復をもう一度実行してからachievedを記録します。session:close自体はloopの存在を必要としません。

## Evaluate / release / update

```text
npm run harness -- eval prepare --id candidate-001 --revision COMMIT_SHA
npm run harness -- eval record --plan work/evals/candidate-001/plan.json --result work/evals/candidate-001/runs/RUN_ID/result.json
npm run harness -- eval compare --baseline work/evals/baseline/plan.json --candidate work/evals/candidate-001/plan.json
npm run harness -- release normalize --yes
npm run harness -- release create --version 0.3.2 --stamp-template
node tools/check-release.mjs
npm run harness -- release baseline --manifest harness/base-release.json
npm run harness -- update plan --source D:/releases/0.3.2
npm run harness -- update apply --plan .harness/updates/PLAN.json --yes
```

各runは同じfixture/成功条件でproviderごと3回以上、isolated checkoutで実行。plan作成ではモデル実行・課金は起きません。未実行を記入済み成功にしないでください。release snapshotの作成は公開・品質認定ではありません。conflictの統合はPRでレビューします。

`--stamp-template` はproduct.config.jsonの無いハーネス開発元専用。配布payloadを `.harness/releases/<version>/` に保存し、原本manifestを `harness/base-release.json` に出力します。このファイルは自己hash対象から除外し、reviewしたrelease commitへ含めます。初回setupがbaselineを自動登録するため、通常はbaselineコマンドを別途実行する必要はありません。旧案件で手動登録する場合も**元のrelease manifest**だけを使い、案件の現状から作ったsnapshotを基準にしてはいけません。既存baselineの上書き、版のdowngrade、同じ版の異なる内容は拒否します。

hashは供給元の本人認証ではありません。信頼するupstreamのcommit/tagを確認して取得してください。package.json/package-lock.json、README、.vscodeは案件所有なので、releaseのmigration案内に沿って別途差分レビューします。

raw-byte hashをOS間で保つため、管理対象textはPowerShellを含めLFへ統一します。`release normalize --yes`は対象textのCRLFのみを機械変換し、binary・案件所有ファイルを変えません。既存のbaselineを作り直す操作ではありません。改行変更をレビューし、asset同期とテスト後にstampしてください。`.gitattributes`と`.editorconfig`の案件独自変更もconflictとして保護します。
