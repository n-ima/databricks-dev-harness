# HARD-02/07 simulation実装の独立再レビュー

日付: 2026-09-10 / reviewer: deployment_contract_review（実装担当と別のsubagent）

判定: **IR-01〜04を解消。今回のsimulation-only sliceに対する新規の阻害指摘なし。** 専用62試験、旧独立16試験、新規独立16試験がすべて成功した。下記snapshotをローカル候補の採用判断へ提示できる。これは人の正式採用、HIMP-02/07全体の完了、live配備の許可・適合性を代行する判断ではない。

対象は [初回レビュー](2026-09-10-deployment-simulation-review.md)の4件と、その修正による停止・記録境界の回帰。[実行契約](../../docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md)、[操作書](../../docs/harness/operations/DEPLOYMENT_SIMULATION.md)、core、専用試験、CLI/fixture/goldenの固定snapshotを確認した。親sessionは `20260909-214048-619-retrospective-hardening`。旧報告・旧独立test/log・初回candidate記録は変更していない。

## 指摘の解消証拠

| 指摘 | 修正と独立確認 | 判定 |
| --- | --- | --- |
| IR-01 / P1 policy入力link | coreのpolicyInputsは全対象path/既存ancestorをsafePath/lstatで検査し、bounded readを行う。旧capture時・validate中の同bytes junction反例を変更せず再実行して2/2成功。追加でpolicy ancestor、非policy拡張子のentry junction、JSON名のdirectoryを拒否。 | 解消 |
| IR-02 / P2 policy bytes | candidateにraw-byte policy inventoryが加わった。旧0x80→0x81の変更はcandidate-changedでvalidate後に停止。legacy policyHash自体の不変も確認。 | 解消 |
| IR-03 / P2 health payload保存 | URLをhttps/.invalidの正規化されたorigin直下に限定し、秘密値検査を適用。旧path payloadを保存しない。追加で保存済みrecordのpayload URLをshowが拒否し、非正規化originもhealth成功にならない。 | 解消 |
| IR-04 / P2 stopped stage | stopped eventを直近entered/passedから到達可能なstageへ限定。旧validate→healthの飛び越しと、追加のpreflight→start飛び越しを拒否。初期・次工程preflight・validate/healthの結果保存失敗は正常に読める。 | 解消 |

policyInputsのschemaはpath順、重複、bytes・hash・合計容量を検査する。追加試験では単一fileおよび合計8 MiB超過、hashを再計算した重複inventoryを拒否した。data本文の永続化は行わず、path/bytes/SHA-256を束ねている。

## 既存停止経路が保たれたこと

旧独立probeのうち、元のIR反例5件とPASS検査11件を同じfileから再実行した。deploy/observe/start/healthのrun相関、deploy-entry保存失敗時のdeploy0回、entry保存中のsource変化、start-result/stop保存失敗時の結果未確定、timeout後の遅延resolve、承認期限の等号、CLI不正optionの書込前拒否は引き続き成功した。

新規probeでは、厳しくした停止stage判定が次の正常な停止を拒否しないことも確認した。

- 最初のvalidate preflightでcandidateが変わり、全callback0回の停止。
- validate passedの保存後にsourceが変わり、次のdeploy preflightで止まる状態（deploy-entryなし）。
- validate passedの保存だけ失敗し、同じvalidate stageの停止を保存できた状態。
- health passedの保存だけ失敗し、同じhealth stageで停止する状態。healthはnull、reconciliationRequired:true。

同じrun IDの自動再実行や未知の副作用を成功に戻す変更はない。recordのsimulatedCallsは呼出し意図のentryであり、callback完了の証明ではないことを操作書も維持している。

## policyHashとdispatcherの新旧の区別

旧独立testのNOTEは「dispatcherを変更してもcandidateが同じ」という初回候補の観測である。修正版の期待と逆になるため、NOTEだけを選択から除外し、元fileを修正しなかった。

新規probeで、dispatcher bytesの変更と削除はcandidate IDを変え、validate中の変更はdeploy前に停止することを確認した。同じfixtureでlegacy policyHashは変わらず、coreが追加したpolicyInputsによってのみ差を検出する。`tools/lib/policy.mjs` 自体のSHA-256は初回レビューと一致した。既存completion verifierの対象範囲やHIMP-01の採用契約を変更したものとは扱わない。

保証は操作書の固定対象（AGENTS/config/hook、存在するdispatcher/workloads/router、tools/lib・harness/schemas・harness/evals直下のmjs/json）に限られる。全repository・実行コンテナ・実際にimport済みの全bytesの署名ではない。同一OS権限writerの悪意ある同時改変、故障filesystemの強制停止、実processのkillを保証しないという制約も保持している。

## 実行した試験

環境: Windows / Node v24.15.0 / win32 x64。すべて固定のローカルfixture。network、実Databricks/DB、認証、provider/モデル、外部command adapterは使用していない。

| 本reviewerの実行 | 結果 | log |
| --- | --- | --- |
| 専用試験・修正版snapshot | 62 pass / 0 fail / 0 skip、約30.2秒 | [standard](../evidence/2026-09-10-deployment-rereview-standard.log) |
| 旧独立testのIR/PASS、旧NOTEだけ除外 | 16 pass / 0 fail / 0 skip、約1.29秒 | [original probes](../evidence/2026-09-10-deployment-rereview-original-probes-r2.log) |
| 新規独立probe | 16 pass / 0 fail / 0 skip、約1.00秒 | [extra](../evidence/2026-09-10-deployment-rereview-extra.log) |

新規probe: [2026-09-10-deployment-rereview.test.mjs](../evidence/2026-09-10-deployment-rereview.test.mjs)。旧試験の期待値を書き換えてgreenにしたものではない。旧5件のredと修正版のgreenは別logで保持した。

```text
node --test --test-skip-pattern '^NOTE:' --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-deployment-rereview-original-probes-r2.log work/evidence/2026-09-10-deployment-independent.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-deployment-rereview-extra.log work/evidence/2026-09-10-deployment-rereview.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-deployment-rereview-standard.log tests/deployment-simulation.test.mjs
```

最初に正規表現の選択肢を含むtest-name-patternを渡した呼出しは、Windowsの引数処理でファイル名構文エラーとなり、probeを実行できなかった。上記test-skip-patternへ替えて正常に実行した。これは実装の試験失敗ではない。

専用fixtureのoverall timeoutが非deadline試験向けに2秒から10秒へ変更されていることを確認した。明示した1ms全体期限、5ms同期工程、20ms遅延応答の試験と、実装の既定/上限は保持されており、停止条件を緩めた修正ではない。

## 利用者入口の読取確認

修正版がこのrepositoryで保存した2件を本reviewerが公開CLIで読み取った。

```text
node tools/harness.mjs deployment show --id hard02-success-20260910-r2
node tools/harness.mjs deployment show --id hard02-stop-20260910-r2
```

成功記録は5工程・simulated-success・liveDeployment:falseを返し、期限が過ぎたhealthをsimulation-staleと表示した。停止記録はvalidateのみ・validation-incomplete-or-failed・deploymentId/health:null・not-observed。両方のcandidate IDは `30e113af4c63d15f7276330b07fbad19352002930cc5e8a2553aba099f4df9f7`。新しいraw-byte policy inventoryを持つ修正版の記録であり、初回candidateを現候補の証拠として再使用していない。

公開CLIのsimulateとexit codeは、専用62試験に含まれる実dispatcherの隔離fixture試験で確認した。このrepositoryへのreviewerの操作はshowのみ。

## 受入判定の範囲

HIMP-02のローカル停止制御とHIMP-07のsimulation候補/記録対応に関して、今回の指摘と追加反例に未解消項目はない。現snapshotに対する独立技術レビューの条件は満たした。人の正式採用や全8要件の完了receiptを発行していない。

親が報告した全回帰458 tests / 457 pass / 1既存skip、harness:check、adoption-check、diff --checkは親の証拠と区別する。本reviewerの独立再実行結果は上記62+16+16件である。

未検証範囲は実CLI adapter、実承認/権限/費用、実配備artifactの同一性、製品runtime、再開時の実状態照合、Claude Code/Copilotのモデル付きgolden評価、公開。golden JSONはproposed-not-promotedのまま。これらは今回のsimulation-only sliceを妨げる追加条件ではなく、後続scopeの残作業である。

## 修正版snapshot（SHA-256）

| path | SHA-256 |
| --- | --- |
| tools/lib/deployment-simulation.mjs | 74CAE5533B5CC990A13EE8C0206AABD9E23B97897B42C01057C6CE8D450011CA |
| tests/deployment-simulation.test.mjs | 9C941357E099040605BCA2D940D21D76F071B262424BEB02D8894AD2D2962221 |
| docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md | 12BD5388473B6AC9D6602A28A09670B094780507AF0F27F8E6A54F0F510C3D65 |
| docs/harness/operations/DEPLOYMENT_SIMULATION.md | 48ABA4CBC1D16BAA01CD892446EA3E24A9D5A4C8C5BB595E408F63DD5944220F |
| tools/harness.mjs | 3D21E195346750D83FD1E49E0C23D3550FBF4ED89E356B9B7A2E69DFB61EECF1 |
| tools/lib/policy.mjs | 55F1F1B8F609356D1CA5EFFBA417662AD9D7E57CB5B3F882F00B087AE2E12ACA |
| docs/harness/operations/CLI_REFERENCE.md | 290B9DFEFA42105A802C1653640FDB61622251F4C27771B0FEC2AADC1ED12544 |
| work/evidence/2026-09-10-deployment-golden-proposal.json | 157D7B85B60C65A816E26F55CD61F36B17238F103507B99A5B0A4C3B121F86CD |
| harness/fixtures/deployment-component/README.md | C6444A86FA1ED85ED6B911A6822AE178E9D6E433FA9B180AA71CEBDBB0E8FB53 |
| harness/fixtures/deployment-component/src/main.ts | 91C441856A5A56F94DE7F94200A78174746AAD01D6962C9FE30216CDEB1733D6 |
| harness/fixtures/deployment-component/tests/main.test.ts | 2DF039B164B0EBD19F1DDFB5E7E1B249EC7C202B7FA123EFD791532A60EB337F |

次の担当: 親がこのsnapshot、初回指摘、再レビュー結果をsession/evidenceへ結び付け、simulation-onlyの採用範囲を人へ提示する。reviewerの作業は本報告と新規独立test/logのみで完了した。
