# HARD-02/07 simulation-only 契約の独立レビュー

日付: 2026-09-10 / reviewer: deployment_contract_review（実装担当と別のsubagent）

対象: [配備実行契約](../../docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md)の45–59行、[HIMP-02/07](../../docs/harness/requirements/retrospective-hardening.md)、[実行計画](../plans/2026-09-10-retrospective-hardening.md)。親sessionは `20260909-214048-619-retrospective-hardening`。本レビューはdraft契約の具体化であり、並行して作成中の実装に対する不具合判定ではない。

結論: simulation-only の最小sliceは妥当。実CLI、network、外部adapter、live承認、実artifact照合が未実装であることを今回の阻害条件とはしない。以下の6群を契約またはその拘束力のあるschema/testへ明示する必要がある。既存要件の意味を弱める変更は求めない。

本レビューの書込はこの報告のみ。実装・要件・既存記録・session/task・承認を変更していない。accepted化、seal、DB、外部処理、commit/pushも実行していない。

## 契約への指摘と具体的な負例

### DC-01 / P1 — session参照と要件参照の固定対象を定める

根拠: 契約49行は候補に「要件bytes、session参照」を束ねるが、sessionから要件を選択する参照自体と、その後のsession変更の扱いを明示していない。51行の「元file」がfixture承認だけか、候補の入力全体かも読み分けられる。

負例: session Sは要件Aを参照している。候補はAのbytesとSのIDから作成する。validate中にSの `requirement` をBへ変更する。AとBの本文を同じbytesにしておくと、Aのhash再読取とSのID比較だけでは変更を見つけられない。Sをinactiveへ変更する場合も、参照文字列は同じである。候補生成時と実行時で違う関係を使った記録を残せる。

受入条件: 正規化したsession/要件path、要件bytes、候補に必要なsessionの参照・有効状態を最初に固定する。各工程の直前・直後に、その同じ入力と関係を再確認する。Bのbytesが同じでも参照変更を拒否し、deploy呼出し0回にする。進捗本文などの変更まで候補失効させるかは明示してよいが、可変な進捗と候補の意味を決める参照を混同しない。解析対象bytesとhash対象bytesを別読取にしない。

### DC-02 / P1 — パス検査を除外判定より先に行い、記録の保存先にも適用する

根拠: 契約49行はsymlink/junctionを拒否する一方、同じ文でnode_modules/.git/dist/build/coverageを除外する。除外前に型を検査するか、除外がcomponent直下のみか全深度か、保存先のancestorにも拒否を適用するかが未確定。既存 `pathInside` はrepoの内側へ解決されるsymlinkとrepo root自体を許すため、このsliceの全条件の代用にはならない。

負例: component配下の `node_modules` をrepo内の別directoryへのjunctionにする。名前による除外を先に行うとjunctionを検査しない。同様に `work/simulations/deployments` のancestorがrepo内の別directoryへのjunctionである場合、`pathInside` のcontainmentだけでは意図した保存境界を保証しない。

受入条件: component、各entry、fixture approval/要件の入力path、保存先およびその既存ancestorを対象とする型・境界検査を明示する。少なくとも除外directory自身のsymlink/junctionを検査してから内容を除外する。固定除外はどの相対path/segmentに適用するかをpolicyへ記録し、`src/build/rules.ts` と直下の `build/rules.ts` の扱いをfixtureで固定する。除外配下の内容を走査しない選択は認められるが、その場合も内容を検証済みと表示しない。repository root自身、link経由の入力/保存、秘密設定fileは安全なcodeで拒否し、adapter呼出し0回を確認する。

### DC-03 / P1 — 工程entryのみ残った記録の意味を固定する

根拠: 契約53行はentry保存後にadapterを呼ぶこと、保存失敗で後続を止めることを定める。55行は未知の副作用をreconciliation-requiredとするが、entryの後に呼出結果を保存できなかった場合やprocess中断時に、showがどう判定するかは未指定である。

負例: deploy-entryを保存し、合成adapterが受付ID Dを返した直後にresult保存を失敗させる。停止理由の追加保存も失敗させると、永続記録にはdeploy-entryしか残らない。showが最後の成功工程を採用するとvalidated/not-startedに見え、実際には呼出されたか不明な状態を失う。start-entry後の同型も含む。

受入条件: entryに対応する確定result/停止記録がない場合は、呼出し済みである可能性を保持し、showはreconciliation-required（simulation）または同等のunknownを返す。result保存失敗後にstart/healthを呼ばない。完了記録を書けなかったrunを成功や未実行へ戻さず、同run ID再実行・上書きを拒否する。通常終了時の自分のlock解放と、残存lockの自動削除禁止を区別する。保存失敗/中断の際にlockを残すか解放するかも明示し、残ったentryを見て安全側へ表示できることを独立に試験する。汎用transaction機構の新設は求めない。

### DC-04 / P1 — deadline境界と遅延完了を終端状態へ反映しない

根拠: 契約53行は有限の全体/工程時間とAbortSignalを求めるが、期限の等号、時計の種類、結果受理時の再確認、timeout後のresolveを定めていない。Promise.raceだけでは同期処理中に過ぎた期限を検出できない。

負例: 5msの工程上限を与え、合成工程が同期的に30msを使ってから成功Promiseを返す。メモリ内probeではPromise.raceの結果はSUCCEEDEDになった。別の負例として、timeout/abort後に保留した合成Promiseを成功resolveさせる。後続工程や最終成功を書けると停止が取り消される。

受入条件: 時間予算は正の有限整数かつ実装の安全な上限以下とし、全体期限は一度だけ定める。経過時間はmonotonic clockで比較し、工程呼出し前と結果受理後の両方で `now >= deadline` を停止として扱うなど境界を固定する。abort/timeout/停止が確定したrunは終端とし、遅延したresultによるevent・health・後続呼出しの更新を禁止する。fixture承認時刻は別途UTCの有効区間として検査する。実processの強制停止を保証する要求ではなく、初版の記録・制御上の保証である。

### DC-05 / P2 — 合成結果とshowの読取にも相関・時刻・信頼境界を定める

根拠: 契約53/57行は候補・identity・deployment ID一致と古いhealthの除外を定めるが、成功に必須のfield、時刻の妥当性、run間の相関、既存記録をshowが読むときの検査が未指定である。

負例: 同じ候補/targetを使うrun R1/R2を作り、R2の終端観測またはhealthにR1の合成deployment IDを渡す。さらにhealthに未来の `observedAt`、古い `observedAt`、`2026-02-30T00:00:00.000Z` を入れる。Date.parseに依存した後者は2026-03-02へ補正される。保存済みrecordのmode/schemaを未知値にし、success/currentRunningだけtrueにする読取負例も用意する。

受入条件: 固定adapter各工程のresult schemaと成功条件を狭く定める。IDは当該runのdeploy受付結果から固定し、後続の候補・identity・IDと照合する。合成health URLは固定された合成形式に限定する。時刻は妥当なUTC日時として検査し、鮮度の上限、未来時刻の許容有無、期限の等号を定義する。showは読取専用でもrecordを信頼済みとして扱わず、未知schema/mode、不正なevent順序、欠けた必要field、相関不一致を拒否または明示unknownとする。表示時刻からfreshnessを計算し直し、保存済みsuccess/currentRunningをそのまま現実の稼働へ昇格させない。freshな合成healthでもlive稼働とは表示しない。

### DC-06 / P2 — CLIの未知・重複・欠損optionを状態作成前に拒否する

根拠: 契約47行はsimulate/showだけを入口とし固定scenarioを求める。既存 `parseOptions` は未知optionを受け入れ、重複optionを配列へ変える汎用parserであり、今回のcommand schemaはまだ明記されていない。

負例: `deployment simulate --run-id R1 --run-id R2 --live --adapter ./external.mjs`。メモリ内probeでparseOptionsはrun_id配列、live:true、adapter文字列をそのまま返す。未知optionを無視して既定simulationへ進む実装も、配列を文字列化してrun名にする実装も、このparser単独では排除できない。`--scenario` の値欠損はboolean trueになる。

受入条件: 各subcommandのoption allowlist、scalarの型、必須項目、値域を入口で検証する。未知option、scalar重複、値欠損、未知scenario、adapter/mode/live/force/resume等の未対応入口を拒否し、run/candidate/approvalを作成しない。既定target/profileやscenarioへのfallbackを行わない。`show` は入力の不正も含めて記録を書き換えない。外部adapterが実際に読み込まれることを再現した指摘ではなく、固定入口を検査可能にする要求である。

## 実施した確認と証拠

`AGENTS.md`、`orchestrate-work`、`review-work`、`improve-harness`、IMPROVEMENT_LOOP、TASK_VISIBILITY、QUALITY、SECURITY、関連session/設計/計画を読んだ。`npm run harness:context` は親sessionのHARD-02/07をrunningと表示した。これは記録上の状態でありlive processの検査ではない。明示 `--intent review` のrouteは `review-work`、`executionAuthorized:false`。workloadは未選択で、product実装を開始しなかった。

Windows / Node v24.15.0 / win32 x64で、PowerShell literal here-stringを `node --input-type=module` のstdinへ渡すメモリ内probeを実行した。ファイル・fixture・approvalは作らなかった。

| probe | 観測結果 | 結論の範囲 |
| --- | --- | --- |
| 5ms deadline、同期30ms後の成功をPromise.race | elapsedMs:30、SUCCEEDED | race単独は結果受理時のdeadline検査を代替しない。候補実装を試したものではない。 |
| new Date('2026-02-30T00:00:00.000Z').toISOString() | 2026-03-02T00:00:00.000Z | date parse成功だけではcalendar dateの妥当性を示さない。 |
| pathInside(repository, '.') | repository rootを返した | 共通helperは今回のroot拒否に追加条件が必要。 |
| parseOptionsでrun-id重複/live/adapter | run_id配列、live:true、adapter文字列 | 共通parserのあとにcommand schemaが必要。 |

読み取った `shared.mjs` では `pathInside` がrealpath containmentのみを検証し、`withFileLock` はfinallyで自分のlockを解放する。これら自体の既存契約を変更する提案ではなく、今回のslice固有の制約を呼出側が担う範囲を明示した。

初回の通常sandboxの読取は `helper_unknown_error: setup refresh had errors` で起動前に失敗し、Node fallbackも起動失敗した。対象を限定したrequire_escalatedの読取・メモリ内probeで実行できた。自動承認による却下ではない。

## 受入条件の対応と未検証範囲

| 要件 | 今回確認した契約部分 | 実装レビューで必要な証拠 |
| --- | --- | --- |
| HIMP-02 | 同一候補/環境/fixture承認、各工程停止、有限時間、保存前後の失敗 | 上記DC-01/03/04/06を含むnegative tests、成功trace、呼出し回数、CLI結果 |
| HIMP-07 | 候補の入力分類、inventory/digest、配備ID/観測の関連、simulation表示 | DC-01/02/05のinput/record置換試験、追加/削除/変更のdrift、出力の再読取 |

未実施: 並行作成中の候補実装の試験、live adapter/Databricks/provider、実承認、review receiptとの実artifact対応、実runtime表示。本レビューはHIMP-02/07全体の完了または正式採用を証明しない。

## 対象snapshot（SHA-256）

| 対象 | SHA-256 |
| --- | --- |
| docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md | 655E795E30B8B0AC027C3A73FB3C4B682721644DBC11BD31DC42C7759D66CCB2 |
| docs/harness/requirements/retrospective-hardening.md | DE27EDCCFDA277D8D655E67C635E8BBD2BB5CD43994C742FF182400CF20DBF64 |
| tools/lib/shared.mjs | D1BA0FC8078775B62FD7DDFE3776E3D36C718B78F31AA410FD9A16B9A0D5B251 |

次の担当: DC-01〜06の扱いを契約/schema/testへ反映した候補snapshotを親から受け取り、実装を変更しない独立レビューでCLI・停止・保存/読取を再検証する。親のsession checkpointから本報告を参照して引き継ぐ。
