# API-only 改善後独立forward-test

実行: 2026-09-08 JST / Node v24.15.0。実装者とは別のreview context。

対象source: D:/projects/databricks-dev-harness。source編集、Git操作、実Databricks認証/接続、課金モデル呼出は未実施。

fixture: C:/Users/nimao/AppData/Local/Temp/harness-api-retest-4280cd2540aa48c8abddd7ada1cd5a0f/project-nMmZTk

## 判定

今回の改善範囲（API/Lakebaseへの分類、要件の骨格、ローカルAPI契約fixture、保護ゲート）はpass。阻害する新規欠陥は観測なし。製品backendの完成判定はnot-runであり、このfixtureの成功で代替できない。

元依頼と前回誤分類した短縮文の両方がdefine/product-intentに進む。workloadsはapiとlakebase、executionAuthorized=false。明示選択を渡したintakeではui=false/dataUpdate=false、Q-40(API契約)とQ-70(transaction等)を生成し、Q-10/Q-20/Q-21は生成しない。質問は共通Q-01〜05を含め7個。

設計にはAppsの/api/、OAuth/CAN USE、Lakebase、原子性/分離/資格情報更新/migrationの検証を記載。無関係なUI/Genie/Deltaパイプラインの設計は生成されない。要件status=draft、計画blocked-on-intent、sessionのproduct-intent=pendingを維持。

kind api planはready/missing=[]/command=[]/deployReady=false。applyはtests/fixtures/api/orders-api配下にmodel.mjs、server.mjs、contract.test.mjs、openapi.json、README.md、.harness-fixture-only.jsonの6ファイルだけを生成。componentのapp.yaml/databricks.ymlは生成しない。

## 実行コマンドと結果

次のコマンドはfixtureのrootで実行。再現スクリプトforward-test.mjsは実行ごとに別の新規TEMPコピーを作る。

```powershell
node tools/harness.mjs setup --project-name orders-api-forward-test --skip-agent-skills
node tools/harness.mjs workload resolve --prompt 'Databricks Apps上で、社内の別システムが呼べる受注更新REST APIを作りたい。UIは不要。Lakebaseに登録し、重複リクエストに安全に対応したい。VS CodeのClaude CodeかCopilotで要件から開発したい。'
node tools/harness.mjs route --prompt 'Databricks Apps上で、社内の別システムが呼べる受注更新REST APIを作りたい。UIは不要。Lakebaseに登録し、重複リクエストに安全に対応したい。VS CodeのClaude CodeかCopilotで要件から開発したい。'
node tools/harness.mjs intake create --name orders-api --title '受注更新REST API' --summary 'Databricks Apps上で、社内の別システムが呼べる受注更新REST APIを作りたい。UIは不要。Lakebaseに登録し、重複リクエストに安全に対応したい。VS CodeのClaude CodeかCopilotで要件から開発したい。' --workload api --workload lakebase
node tools/harness.mjs scaffold plan --kind api --name orders-api
node tools/harness.mjs scaffold apply --plan work/scaffolds/20260907-231626-149-api-orders-api-a9ffc27f.json --yes
node --test tests/fixtures/api/orders-api/contract.test.mjs
node C:/Users/nimao/AppData/Local/Temp/harness-api-retest-4280cd2540aa48c8abddd7ada1cd5a0f/semantic-probes.mjs C:/Users/nimao/AppData/Local/Temp/harness-api-retest-4280cd2540aa48c8abddd7ada1cd5a0f/project-nMmZTk/tests/fixtures/api/orders-api
node tools/harness.mjs check
```

全てexit 0。setup/checkはHarness check passed。生成HTTPテストはtests=2/pass=2/fail=0/skip=0。

独立追加probeは未使用キー24同時送信を実HTTPで検証し、全て200/revision=1。その後の別キー更新はrevision=2、元キーの再送は最初の応答を再現、同じキー別内容は409。数量の型/上下限、orderId/keyの長さ境界、health/404を検証した。

別server process相当のfresh instanceに替えると、同じキー別payloadも200/revision=1になることを実測。これは説明済みのメモリ内receiptの消失で、製品の永続的冪等性は未実装。

## 保護確認

- applyの--yes省略: exit 1 / Review the plan, then pass --yes to apply local scaffold changes.
- 同名intake: exit 1 / Refusing to overwrite existing artifact。要件hash不変。
- 別planから同じAPI出力先への再apply: exit 1 / Refusing to overwrite generated artifact。6ファイル全hash不変。
- pending intentからphase=implement: exit 1 / Resolve the pending human gate before advancing.
- pending intentのsession close completed: exit 1 / Human gate remains pending: product-intent。
- DATABRICKS_APP_PORT=8000を指定したnode server.mjs: exit 1 / Fixture server must not run as a deployed Databricks App。

fixture生成を許可しても製品承認は付与されず、完了扱いにもならない。直接entrypointの環境検査は補助的な誤用防止であり、OS sandboxではない。

## 意味的レビューと残存事項

1. 生成されたHTTP契約は一般的なorderId/quantity例で、元依頼から確定した製品schemaではない。README/OpenAPIはfixtureであることを明示し、製品仕様への置換を求めている。妥当な境界。
2. 権限は固定mock bearer、receiptは単一processのMapで1000件まで。tenant認可、expiry、DBの原子性、分散同時実行、rate control、実OAuth/CAN USE、デプロイは未検証。PLAYBOOKのtransaction+unique制約+fingerprint+応答再現の実装/実DB証明が次工程。
3. 非阻害の改善候補: 同梱contract.test.mjsの同時再送試験は先にreceiptを作ってから5件送るため、初回同時リクエストを独立には検証していない。今回の別probeでは初回24件がpassした。回帰防止のため同梱テストに未使用キーのケースを追加するとよい。
4. 非阻害の文言残り: intakeの計画はAPI-onlyでも「If user-facing ... mock」、要件は「User journeys and UI states」を残す。実ゲートは不要になっているが「UIがある場合」の条件と「API契約レビュー」を使い分けると次agentの解釈が明確になる。
5. 受入条件は汎用AC-01/02のまま。skillの指示どおり、既に明示されたApps/Lakebase/UI不要を台帳へ記録し、未解決の業務契約のみを質問して具体的ACへ置換する必要がある。実Claude/Copilotの会話品質は今回未検証。

## 対象hash

検証後の現行sourceと次のsnapshot hashが一致。

```text
tools/lib/workloads.mjs c28cbfa2d65c1b931ec67f4e7d3f05f7aa028d0778f905d0774a09860bc17693
harness/workloads.json c4538775631126565aaf979dfe62ac984f81e9c0f7c0fe960aa4a2b712600fed
tools/lib/intake.mjs d27a54f60537c59f1e5743b217fb15f18dbec4361dc704fe76b456eee4bcc0a8
tools/lib/scaffold.mjs 01f2bb44a4787190ee4198929d18fddc576ba26525ae9778e555eb8b797d2da7
tools/lib/starters.mjs e98f29094e8bc8c12ed4045a528d4afff8219aae32873d7a699076553b39d852
harness/templates/starters/api/model.mjs e51dfe6b02e7a0e4b29244817a18f75c0ef0c125844e158fa8a737f6f07441bc
harness/templates/starters/api/server.mjs 3af5d46b580d8cb111fe47d7251e98359eeb722dcd7223aa2605c94119dec2c7
harness/templates/starters/api/contract.test.mjs 1d8c6696869fd62eebef3ea2c6677c65ef9a84930916395fc8b52b3a31b1daff
```

session checkpoint: work/sessions/20260907-231625-958-orders-api-delivery.md。完了closeや承認記録は作成していない。
