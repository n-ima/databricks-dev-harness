# 検証済み候補から配備への実行契約

状態: simulation-only実装範囲を正式採用（2026-09-10、[ADR-0007](../decisions/ADR-0007-deployment-simulation-adoption.md)）。live配備の設計部分は提案のまま。全要件完了の証拠ではない。

## 独立契約レビュー DC-01〜06 の具体化

実行可能なschemaと負例は `tools/lib/deployment-simulation.mjs` と `tests/deployment-simulation.test.mjs`、操作/制約は [DEPLOYMENT_SIMULATION](../operations/DEPLOYMENT_SIMULATION.md) に置く。

- DC-01: session path/id/status/requirement/gate/gate_statusをcandidateへ固定し、progress本文は除外。各工程entryの保存後にも再検査する。
- DC-02: 固定除外はcomponent直下のみ。除外判定より前にlinkを検査し、保存/lock祖先にも適用。深度32/entries2000/files1000/8MiBを上限とする。
- DC-03: entryは呼出し意図。deploy-entry以降で確定結果を失えばunknown/reconciliationRequiredを保持する。通常finallyは自身のlockだけを解放し、残存lockの自動削除はしない。
- DC-04: 単調時計、期限の等号、結果受理後の再検査で遅延成功を拒否。停止後の遅延Promiseは記録を書かない。filesystem I/Oや外部processの強制停止保証とは区別する。
- DC-05: stageごとにfield allowlist、run/candidate/identity/deployment IDの相関、厳密なUTC calendar、60秒のhealthを定義。showもhash/schema/順序/必須値を検査する。SHAは署名ではない。
- DC-06: raw CLI argvからsimulateのid/session/scenario、showのidだけを許可。重複・欠損・未知値は書込前に拒否。public CLIから外部adapterを読み込まない。

独立レビュー後もこのsliceの正式採用とlive適合性を混同しない。canonical golden tasksや既存verifier/budgetはこの実装で変更しない。追加golden taskは `work/evidence/2026-09-10-deployment-golden-proposal.json` の提案として扱う。

実装レビューIR-01〜04の修正: legacy policyHashを変えずcandidateにraw-byte policy inventoryを追加し、policy/dispatcherのlink・bytes変更を検出する。health URLは.invalid origin直下のみ、秘密値形式は拒否。stopped eventは直近のentered/passedから到達可能なstageだけに制限する。旧試験/旧snapshotは保存し、再レビューの結果を別に残す。

## 既存公式機能を利用する境界

Databricks CLI v1.6.0のローカルhelpと[公式CLI資料](https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands)を照合した。project deployはvalidation→deploy→runを備えるため、同じ配備エンジンを作り直さない。ただしAPI deployとの違い、testの既定省略、shell commandの連結、source/targetのドリフト、取得結果の最終状態、healthは別途契約を要する。

Bundle direct engineのplan適用は[公式bundle資料](https://docs.databricks.com/aws/en/dev-tools/cli/bundle-commands)を利用する。すべてのCLI版・workspace・engineで利用可能とは仮定しない。plan自体もローカルのbuild処理を起動するため、無条件に無副作用な検査とは分類しない。

## 3つの独立した記録

| 記録 | 主な内容 | 代用しないもの |
| --- | --- | --- |
| Candidate | session、要件、component root、source inventory/hash、lockfiles、build構成、CLI版、検証結果、必要なら公式plan hash | human approval、現在のruntime |
| Approval scope | actorの記録、根拠、workspace/target、resource、操作、principal、権限、費用、candidate参照、有効性 | actor認証の証明、他環境への拡大許可 |
| Deployment observation | candidate参照、deployment ID、環境、受理/最終状態、health、URL、観測時刻、証拠の出所 | 未観測の現在稼働、実行コンテナ全体のbytes一致 |

ローカルhashは同一OS権限の悪意あるprocessに対する署名ではない。CIでの認証、資格情報、branch protection、公式APIの観測を別の境界として扱う。候補リストにある既存fileだけでなく新規fileの追加・削除もsource inventory差分に含める。秘密値は保存せず参照と非秘密の構成だけを結び付ける。

## 実行と停止

1. component rootと許可された環境・CLI能力を確認する。既定target/profileへfallbackしない。
2. 検証対象のsource inventoryを確認し、所定のbuild/testを実行する。失敗時に配備を起動しない。
3. 検証中に元sourceが変わっていたら停止する。build生成物と検証専用ファイルは分類し、候補の意味を明示する。
4. 承認範囲・候補・公式planの一致を照合する。必要な人の判断がなければ停止する。
5. 固定されたadapterのargvをshellなしで実行する。skip-validation/skip-tests/force/force-lock/自動承認などの迂回を勝手に追加しない。
6. CLIのexit 0、操作受付、最終成功を区別する。対象deployment IDと環境を確認し、失敗/timeout/中断/不明状態ならstartや再配備へ自動で進まない。
7. 最終成功と別にhealthを観測して保存する。二重実行・再開時は前回の実際の副作用を照合し、盲目的retryをしない。

official project deployが内部で複数工程を実施する場合、ハーネスのlogでは「CLI呼出し1回」と「内部工程を独立観測した」を区別する。source-boundの検証を、実行imageの再現性・署名・完全一致と誤称しない。

## 最初の受入試験（副作用なしのadapter）

- validationの非0終了、throw、timeout、abortではdeploy呼出し0回。
- 直後のsource追加/削除/変更、root変更、host/target変更、失効承認ではdeploy0回。
- deployの失敗/受付のみ/不明状態/別deployment IDではstartとhealth成功判定0回。
- start失敗では成功のhealth記録0件。観測の期限切れは正常稼働と表示しない。
- 同じcandidateの競合実行は拒否し、再開はrecordと外部観測の整合後に限る。
- 既存hook、承認、検証器を緩めず、providerの自然言語自己申告で先へ進めない。
- 各fixtureの記録をstatus表示へ接続できる形式にするが、fixtureを本物の稼働として表示しない。

この設計だけでlive adapterを有効化しない。実装・独立レビューの後に、明示承認された専用dev対象で接続・identity・最小配備・拒否を確認して適合範囲を定める。

## 最初の実装範囲: simulation-only（2026-09-10）

HARD-02/07の最初のsliceは、公式CLIを呼ぶ前の制御契約を実行可能にする。実CLI adapterは同梱せず、network、shell、provider、認証、実配備を起動する入口も設けない。新規CLIは deployment simulate/show のみとし、明示した固定scenarioで合成結果を返す。simulationをliveでの合格や現実の稼働と表示しない。

候補はcomponent配下の全file inventory、要件bytes、session参照、明示した合成identity、fake adapter版、policy hashを束ねる。実行入力と検証専用入力を分類するが両方を候補digestへ含める。進捗はcomponent外へ保存する。rootそのもの・パス逸脱・symlink/junction・特殊file・件数/容量超過は拒否する。依存node_modulesと.git、生成dist/build/coverageは固定の除外境界として記録し、内容を検証したとは主張しない。秘密設定fileは候補に含めずエラーにする。除外規則を利用者入力で追加しない。

fixture approvalは実承認とは異なるkind/modeを持ち、候補digest、session、合成workspace/profile/target/resource/principal、deploy/start操作、費用0、発行/失効時刻に限定する。各工程前後で元fileを再読取し、失効・撤回・差替え・範囲不一致を検出する。このfixture承認は既存approval createや実環境の承認処理には登録・流用しない。

validate → deploy受付 → deployment終端観測 → start → health の順序を、有限の全体/工程時間とAbortSignalで制御する。入力/resultを検査し、候補・identity・deployment IDが一致する正常な終端以外は先へ進めない。工程のentryを保存してからadapterを呼び、保存失敗なら後続を呼ばない。エラー本文や生API応答を保存せず、安全なerror codeと段階を保存する。

同じcandidate/targetの同時実行をlockで拒否し、同じrun IDは上書き・自動再試行しない。中断後の未知の副作用はreconciliation-requiredとして保持する。初版にresume/force/自動lock削除は設けない。別run IDでの再試験は明示したsimulationに限り可能であり、live retryの許可ではない。Promiseのtimeoutは実子processの停止保証ではないため、将来のlive adapterには別途隔離・kill・実状態照合が必要。

記録は work/simulations/deployments/ 配下とし、candidate、fixture approvalのhash、工程events、合成deployment ID、合成health URLと観測時刻、停止理由を関連付ける。showは読取のみ。未知/古いhealthをcurrent runningと扱わない。HIMP-03の実承認範囲台帳、HIMP-04の製品runtime表示、HIMP-07の実配備artifact対応はこの初版で完成扱いにしない。

公式[Apps CLI](https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands)と[Bundle CLI](https://docs.databricks.com/aws/en/dev-tools/cli/bundle-commands)を2026-09-10に再確認。Apps project/API経路とskip-tests既定、非同期終端の違いを維持する。本state machineの工程は契約の試験用であり、公式project deploy内部の各工程を独立観測したとは記録しない。
