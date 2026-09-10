# HARD-02/07 simulation実装の独立レビュー

日付: 2026-09-10 / reviewer: deployment_contract_review（実装担当と別のsubagent）

対象は [実行契約](../../docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md)、[操作書](../../docs/harness/operations/DEPLOYMENT_SIMULATION.md)、simulation runner/CLI、固定fixture、専用試験、golden提案。要件はHIMP-02/07の最初のローカルslice。親sessionは `20260909-214048-619-retrospective-hardening`。

判定: **このsnapshotの正式採用は保留。P1が1件、P2が3件。** 既存56試験は独立再実行で全成功したが、追加17試験のうち5件が失敗し、4件の修正対象を再現した。live adapter未実装や実Databricks未試験は明示された範囲外であり、この判定の理由ではない。

この報告は下記hashの初回候補に固定する。親へ反例を先行共有し、親は修正を準備している。修正後の結果をこの報告の成功として混ぜず、再レビューで別に記録する。

## 再現された指摘

### IR-01 / P1 — policy入力のjunctionが候補のパス検査を迂回する

箇所: `tools/lib/deployment-simulation.mjs:178`、`tools/lib/policy.mjs:9`、同15–19行。

候補はcomponent/要件/sessionをsafePath経由で読む一方、policyHashの入力は共通関数内で直接readFile/readdirする。policyのdirectory/entry/ancestorはlstatもbounded readも受けない。候補の一部であるpolicyだけ、契約DC-02の「入力の既存ancestorとlinkを拒否する」境界から外れる。

再現: `harness/schemas/example.json` を持つ隔離fixtureで、`harness/schemas` を同repo内の `harness/schema-target` へのjunctionへ替える。captureは拒否せず候補を返す。さらに正常候補生成後、validate中に同bytesのdirectoryをjunctionへ置き換えると、`[validate, deploy, observe, start, health]` の全工程が呼ばれ `simulated-success` になった。リンクの内容を変更してhash差を作る必要はない。

証拠: 独立試験 `IR-policy-directory-link` と `IR-policy-link-replacement`（2件red）、[独立log](../evidence/2026-09-10-deployment-independent.log)。どちらもWindows directory junctionを使用し、skipしていない。外部リンクや実データを使った試験ではない。

受入条件: simulation候補が依存する全policy path/既存ancestorも、型・link・件数/容量・境界を検査したsnapshotに束ねる。開始時のlink拒否と、validate中の同bytes link置換時にdeploy0回を確認する。既存policyHashの別用途の契約を不用意に変える必要はなく、simulation固有の追加snapshotでもよい。

### IR-02 / P2 — policyの異なるbytesが同じ候補として受理される

箇所: `tools/lib/deployment-simulation.mjs:178`、`tools/lib/policy.mjs:10`、同13/19/22行。

共通policyHashはfileをUTF-8文字列へ変換してからhashする。不正なUTF-8 bytesはreplacement characterに補正されるため、raw bytesが異なってもhashが同じになる。component/要件はBufferのhashに束ねるが、policyは同じ保証を持っていない。

再現: 合成 `AGENTS.md` のbytesを `[0x80]` として候補を作り、validate中に `[0x81]` へ変更した。候補は失効せず、全5工程が呼ばれ `simulated-success` になった。実repositoryのAGENTS.mdや既存verifierは変更していない。

証拠: 独立試験 `IR-policy-bytes`（red）。この試験はencoding境界の負例であり、人間向け規約の意味を変えた実案件試験ではない。

受入条件: policy入力をraw-byte inventoryへ束ねるか、不正encodingをhash前に明示拒否する。異なるbytesを同じ検証候補として扱わないことを確認する。既存のHIMP-01採用済みverifierを変更しない方法を優先する。

### IR-03 / P2 — 合成health URLに含まれた秘密値形式の文字列が永続化される

箇所: `tools/lib/deployment-simulation.mjs:238`–239行、同317行、同371–376行。

health URLはhttps/.invalid/資格情報・query等を検査するがpathnameは自由で、保存前のassertNoSecretsもない。candidate/identityの秘密値検査と異なり、untrusted result由来のURLがそのまま記録とshow結果へ出る。

再現: 合成adapterが `https://review.invalid/token=synthetic-review-canary-do-not-persist` を返すと `simulated-success` になり、markerがrecordに保存された。markerは試験専用の無害な文字列で、実tokenではない。public CLIの固定scenarioが任意URLを受け付けるという指摘ではなく、明示されたprogrammatic test APIのresult境界への指摘である。

証拠: 独立試験 `IR-health-secret`（red）。エラー本文を永続化しない既存56試験は成功しているが、URL経路は対象外だった。

受入条件: 合成URLの許容表記を狭く固定し、少なくとも秘密値パターンを保存・返却前に拒否する。showによる既存recordの読取にも同じ制約を適用する。合成のorigin直下だけを許可する仕様は、このsliceの用途に対して十分である。

### IR-04 / P2 — showが不可能な停止工程への飛び越しを受理する

箇所: `tools/lib/deployment-simulation.mjs:351`–352行、同362行。

entered/passedの順序は検証するが、最後のstopped eventはSTAGESに含まれるだけで受理する。body.stageとの一致も同じ不正値へ合わせれば通るため、停止原因がどの工程にあったかの監査記録を検証できていない。

再現: validate失敗によるrecordの最後のstopped eventとbody.stageだけをhealthへ変更し、公開された形式に従いintegrityを再計算する。simulatedCallsは `[validate]` のままだが、showは拒否せずhealth停止として返す。

証拠: 独立試験 `IR-event-stage`（red）。同じ権限のwriterに対する署名を要求する指摘ではない。既存試験もhash再計算後のmode/event順/成功必須値を検証しており、本件はその構造検査の不足である。live成功に昇格することは再現していない。

受入条件: 最後のentered/passedの位置から合法な停止stageを導く。現在工程、直前結果の保存失敗、次工程preflight失敗は区別して許可し、validateからhealthへの飛び越しを拒否する。保存障害の正常なunknown recordを誤って拒否しない回帰も必要。

## 成功した独立確認

`node --test tests/deployment-simulation.test.mjs` を本reviewerが実行し、56 pass / 0 fail / 0 skip（約16.8秒）。session参照・gate・source追加削除変更・approval scope/expiry・同期deadline・遅延Promise・junction・result保存障害・既存record改変・固定CLI全scenario・実dispatcher/exit codeを含む。実dispatcher試験もコピーした隔離fixture内だけであり、Databricks CLI等は実行しない。

追加試験は [2026-09-10-deployment-independent.test.mjs](../evidence/2026-09-10-deployment-independent.test.mjs)。17件中12 pass / 5 fail / 0 skip（約1.23秒）。passのうち11件は以下の正負検査、残る1件は既存policyHashの対象範囲を観測するNOTEである。

- 合成成功とshow読取前後のbytes不変。
- deploy/observe/start/healthの過去run IDを拒否し、後続0回。
- start-resultと停止記録の保存失敗後に、最後のentryを結果未確定として表示。
- deploy-entry保存失敗ではdeploy0回。
- entry保存中のsource追加をadapter呼出し前に検知。
- deploy timeout後の遅延resolveで記録と後続呼出しが変わらない。
- fixture承認のexpiryと現在時刻が等しい場合は全callback0回。
- CLIの未対応assignment形式・余分な位置引数・target指定は記録作成前に拒否。

再現command:

```text
node --test tests/deployment-simulation.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-deployment-independent.log work/evidence/2026-09-10-deployment-independent.test.mjs
```

環境: Windows / Node v24.15.0 / win32 x64。追加probeは自身の `work/evidence/deployment-review-fixture-*` だけを生成し、解決済みpathがevidence配下であることを確認して試験終了時に削除した。保存する成果物は独立test/logとこの報告のみ。実装・既存テスト・既存報告・要件・session/task・承認・canonical evalを変更していない。

## policyHashの保証範囲

現行 `policyHash` が読むものはAGENTS.md、harness.config.json、tools/agent-hook.mjs、存在するharness/workloads.json/router.json、およびtools/lib・harness/schemas・harness/evals直下のmjs/jsonである。再帰的な全repository snapshotではなく、tools/harness.mjs、docs、tests、fixture、実行時のimport済みbytes全部の署名でもない。

独立NOTE試験では、隔離fixtureのtools/harness.mjsだけを変更してもcandidate IDとpolicyHashは不変だった。CLI入口まで同じ候補として固定する場合は追加snapshotが必要。この範囲不足を既存HIMP-01採用の取消しや、すべての既存policyHash利用の不具合へ拡張していない。今回runnerの制約と、共通関数の従来の対象範囲を分けて評価した。

HIMP-01の最終採用、承認/receipt経路、canonical予算・goldenは本差分で変更していない。新golden JSONはproposed-not-promoted、providerRuns:not-runの提案であり、実provider評価の合格として扱っていない。

## 受入可否と残り

| 要件 | 観測した証拠 | 初回snapshot判定 |
| --- | --- | --- |
| HIMP-02のsimulation停止制御 | 成功trace、各工程失敗/timeout/abort、scope/session/source不一致、保存前後失敗、CLI拒否 | policy link/bytes反例の修正が必要。 |
| HIMP-07のsimulation候補・記録相関 | source/validation区別、inventory、entry/ID、run相関、show/鮮度 | policy snapshot、health値の保存境界、停止event構造の修正が必要。 |
| 既存安全・採用境界の保持 | 限定diffとgolden提案を確認。実adapter/network入口なし | 本reviewerは人の採用判断や完了receiptを発行していない。 |

親の全回帰452 tests / 451 pass / 1既存skip、harness:check、HIMP-01 adoption-checkと75件は親の証拠として読んだ。本reviewerが再実行した結果とは区別する。上記4件を修正し、旧反例を保持した再レビューで新候補を確認するまで採用可能とは扱わない。live適合性、実権限/費用、実artifact同一性、製品runtime、両providerのモデル付き評価、公開は範囲外である。

## 初回候補snapshot（SHA-256）

| path | SHA-256 |
| --- | --- |
| tools/lib/deployment-simulation.mjs | 96E9550BE7EE13275F45B699B18AEE30A2160C21D61E675D96A05230FCB7AB71 |
| tools/harness.mjs | 3D21E195346750D83FD1E49E0C23D3550FBF4ED89E356B9B7A2E69DFB61EECF1 |
| tests/deployment-simulation.test.mjs | 9A6B690CC2E6F40AB6A22D2AB797032848A514AB4D4C0AB69389D52EB98277E3 |
| docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md | 34F30DE88178A12E9391E31D301C0F347F00493CC12C0B38E36462FE2E8575E3 |
| docs/harness/operations/DEPLOYMENT_SIMULATION.md | 7E4C325131F0EACFDB5FB832C66BBD99C2706F9A871D16CF12F11BE1CE7D9864 |
| docs/harness/operations/CLI_REFERENCE.md | 290B9DFEFA42105A802C1653640FDB61622251F4C27771B0FEC2AADC1ED12544 |
| work/evidence/2026-09-10-deployment-golden-proposal.json | 157D7B85B60C65A816E26F55CD61F36B17238F103507B99A5B0A4C3B121F86CD |
| tools/lib/policy.mjs | 55F1F1B8F609356D1CA5EFFBA417662AD9D7E57CB5B3F882F00B087AE2E12ACA |
| harness/fixtures/deployment-component/README.md | C6444A86FA1ED85ED6B911A6822AE178E9D6E433FA9B180AA71CEBDBB0E8FB53 |
| harness/fixtures/deployment-component/src/main.ts | 91C441856A5A56F94DE7F94200A78174746AAD01D6962C9FE30216CDEB1733D6 |
| harness/fixtures/deployment-component/tests/main.test.ts | 2DF039B164B0EBD19F1DDFB5E7E1B249EC7C202B7FA123EFD791532A60EB337F |

次の担当: 親はIR-01〜04の最小修正と回帰を行う。reviewerは新snapshotを受けて再レビューし、旧NOTE（dispatcher未束縛）と修正後の期待を別の試験版で区別する。旧独立test/logは上書きしない。
