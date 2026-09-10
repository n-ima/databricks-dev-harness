# 配備停止制御のローカル模擬試験

状態: ローカル模擬試験機能として正式採用済み（2026-09-10、[ADR-0007](../decisions/ADR-0007-deployment-simulation-adoption.md)）。未公開。HIMP-02・HIMP-07全体の完了や実配備の証明ではない。

## 何ができるか

検証 → 配備受付 → 終端観測 → 起動 → health の順序で、失敗・候補変更・承認範囲の不一致・期限切れ・中断時に後続を止める契約を試験する。結果はすべて合成。build/typecheck/lint/testという検証結果もfixtureの値であり、このコマンド自体はそれらを実行しない。

CLIは固定fixtureだけを使い、Databricks CLI、ネットワーク、認証、DB、モデルを呼ばない。programmatic APIのadapter注入はリポジトリ内の信頼された試験コード用であり、任意コードを安全に隔離するsandboxではない。実環境の接続や配備のために使用してはいけない。

## 手順（通常はエージェントが行う）

1. `npm run harness:context` で対象sessionを確認する。IDを省略しない。
2. sessionがactiveで要件pathを持ち、未解決のhuman gateがないことを確認する。試験のためにgateを解除しない。
3. 未使用のrun IDとscenarioを指定する。
4. showで保存記録を読む。実アプリのURLや現在稼働ではない。

```text
npm run harness -- deployment simulate --id demo-stop-001 --session SESSION_ID --scenario validation-failed
npm run harness -- deployment show --id demo-stop-001
npm run harness -- deployment simulate --id demo-ok-001 --session SESSION_ID --scenario success
```

| scenario | 期待される到達点 | simulateのexit code |
| --- | --- | --- |
| success | 合成healthまで / simulated-success | 0 |
| validation-failed | validateで停止 | 1 |
| deployment-failed / deployment-timeout | deployで停止 | 1 |
| deployment-pending | observeで停止。自動poll/retryしない | 1 |
| start-failed | startで停止 | 1 |
| health-failed | healthで停止。成功healthなし | 1 |
| scope-mismatch | adapter呼出し前に停止 | 1 |

停止scenarioのexit 1は期待した試験結果でもある。showは正常な記録を読み取れれば0であり、配備成功のexit codeではない。未知/重複/欠損option、未知scenario、live/adapter/mode/force/resume指定は記録作成前に拒否する。optionは表記通り `--id VALUE` 形式のみで、`--id=VALUE` は未対応。

## 保存先と読取

- `harness/fixtures/deployment-component/`: 固定の非配備用入力。
- `work/simulations/deployment-inputs/<id>.approval.json`: 自動生成するfixture approval。kind=fixture-approval、mode=simulation。実承認ではなく、既存承認台帳へ登録しない。
- `work/simulations/deployments/<id>.json`: candidate・scope hash・工程events・合成ID・health・停止理由。入力sourceの本文や秘密値は保存しない。
- `.harness/runtime/deployment-simulation/` と `deployment-cli/`: 同時実行の排他。

showの `simulatedCalls` は工程entry（呼出し意図）であり、callbackが実際に完了した回数ではない。entry後の保存障害/中断では `in-progress` と `reconciliationRequired:true` が残り得る。これは「稼働中」でも「未実行」でもなく結果未確定。成功へ戻したり同じIDで再開したりしない。正常/例外終了では自分のlockを解放するが、process異常終了で残ったlockは自動削除しない。担当者がprocessと当該記録を確認するまでその対象を再実行しない。

`healthFreshness` はsimulation-fresh / simulation-stale / unknown-clock / not-observed。合成healthは観測から60秒でstaleとなる。freshでもlive稼働を示さない。showは記録のhash・schema・工程順・必須値を検査し、時刻から鮮度を計算し直す。hashは改変検出であり、同じOS権限の書込者に対する署名ではない。

## 入力境界

candidateはsession IDだけでなく、sessionのpath/id/status/requirement/gate/gate_statusと要件path・bytesを固定する。同じ本文の別要件へ参照が変更されても失効する。進捗本文や更新時刻のみの変更は失効させない。

既存verifierのpolicyHashは変更せず、別のraw-byte policy inventoryをcandidateへ追加する。AGENTS.md/harness.config.json/agent-hook、存在するCLI dispatcher/workloads/router、およびtools/lib・harness/schemas・harness/evals直下のmjs/jsonを対象とし、link/祖先/型/容量も検査する。不正UTF-8の置換で既存hashが一致してもcandidateは失効する。最大1000 policy files/合計8 MiB。これは共有policyHashそのものの保証を変更した意味ではない。

component root自身、入力/出力/lockの既存ancestor、列挙entryのlinkを検査する。component直下の.git/node_modules/dist/build/coverageだけ内容を除外し、除外root自体のlinkも拒否する。src/buildは除外しない。除外配下の内容は未検証。最大1000 files、2000 entries、8 MiB、深度32。秘密設定名・特殊file・逸脱は拒否。入力を同一権限の別processに同時改変させない運用も必要。

## 時間・相関・制約

既定は全体30秒/工程5秒、API上限は全体120秒/工程30秒。正の整数のみ。経過はmonotonic clockで期限以上を停止とし、同期callbackの遅い終了も結果受理時に検出する。timeout後にPromiseが成功しても後続/event/healthを変更しない。外部processの強制停止や故障したfilesystem I/Oの時間上限は保証しない。

各結果はrun ID・candidate ID・identity、および配備受付後は同じdeployment IDに束ねる。必要fieldの欠損・余分なfield・不正なUTC日時・未来/60秒より古いhealthを拒否する。URLはhttpsの.invalid origin直下（末尾/を含む正規表記）だけ。path payload/query/fragment/秘密値パターンは保存・表示しない。停止eventは直近の工程順から合法な位置だけを受理する。

## 検証と採用条件

`node --test tests/deployment-simulation.test.mjs` が、固定CLI・失敗停止・scope/source drift・junction・保存障害・deadline・遅延応答・記録改変を検証する。Claude Code / GitHub Copilotで同じNode CLIを利用できる設計だが、このsliceの両providerモデル実行は未実施。利用者の自然言語からの自律実行成功率は未測定。

追加のcontext消費は必要時だけ本書を読む方式。試験はローカルCPU/ディスクのみで、外部API課金は0。代わりに各工程前後のinventory再走査のI/O負担がある。実案件の大規模sourceにそのまま使わない。

実配備adapter、実承認/権限/費用、deployされたartifactとの同一性、runtime画面、再開時の外部照合は後続slice。リリース前に独立・人のレビューと両providerのgolden-task評価が必要。
