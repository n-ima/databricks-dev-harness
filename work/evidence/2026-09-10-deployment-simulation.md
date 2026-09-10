# 配備停止制御 / candidate識別 — simulation-only

状態: simulation-only範囲を正式採用済み（2026-09-10、[ADR-0007](../../docs/harness/decisions/ADR-0007-deployment-simulation-adoption.md)）。公開・HIMP-02/07全体の完了ではない。r2と初回の証跡を区別する。

採用後確認: [再実行log](2026-09-10-deployment-adoption-replay.log)は専用62件＋独立probe32件の94 pass/0 fail/0 skip（実行者はmain、独立レビューとは別）。旧版のdispatcher未束縛NOTEのみ対象外。採用直前11file一致、採用後は9file不変・2文書の状態/リンクだけ変更、元独立報告不変を確認。HIMP-01 adoption-check、harness check、diff --checkもpass。runtime/test・受入条件・fixture観測は変更せず、人の採用待ちだけを解消した。

## IR-01〜04 修正と再レビュー候補（r2）

初回の[実装レビュー](../reviews/2026-09-10-deployment-simulation-review.md)はP1 1件/P2 3件を再現した（反例5件）。元の独立test/log/報告と当時のcandidate記録は変更せず保持した。

| 指摘 | 修正 |
| --- | --- |
| IR-01 policy link | 全policy入力にもlink/祖先/型/件数/容量の検査を追加。 |
| IR-02 policy bytes | legacy policyHashは変更せずraw-byte inventoryをcandidateに追加。不正UTF8置換による同hashを候補同一と扱わない。CLI dispatcherも別途束縛。 |
| IR-03 health payload | 合成URLは.invalid origin直下のみ、秘密値パターンを保存前/表示前に拒否。 |
| IR-04 停止stage | 直近のentered/passedから合法な停止位置だけ受理。保存障害時のunknownは維持。 |

- [元の独立反例をmainが再実行](2026-09-10-deployment-independent-replay-fixed.log): `--test-name-pattern "^IR-"` で5/5 pass。独立reviewerの再レビュー結果とは区別する。
- [専用修正版](2026-09-10-deployment-fixed.log): 62/62 pass。その後、非deadline fixtureのoverall上限だけ並列I/O対策で2→10秒にした。実装budget・明示deadline試験は不変。
- [修正版の全回帰](2026-09-10-deployment-full-regression-r2.log): 最新test bytesで458 tests / 457 pass / 0 fail / 1既存skip。
- [HIMP-01の独立反例込み再実行](2026-09-10-deployment-acceptance-replay.log): 75/75 pass。shared policy.mjsや採用済み5code/testを変更していない。r2でもharness check / adoption-check / diff --checkはpass。
- 新公開CLIの[成功記録](../simulations/deployments/hard02-success-20260910-r2.json)と[検証停止記録](../simulations/deployments/hard02-stop-20260910-r2.json)は新IDで作成。candidate=`30e113af4c63d15f7276330b07fbad19352002930cc5e8a2553aba099f4df9f7`、liveDeployment=false。
- 初版candidateにはraw-byte policy inventoryがないため、厳格化したreaderは旧形式を受理しない。旧recordを編集・再sealせず当時の証拠として残す。リリース済み形式の移行ではなく、未公開prototype内の修正である。
- 再レビュー対象: core `74cae5533b5cc990a13ee8c0206aabd9e23b97897b42c01057c6ce8d450011ca` / tests `9c941357e099040605bca2d940d21d76f071b262424beb02d8894ad2d2962221`。
- [独立再レビュー](../reviews/2026-09-10-deployment-simulation-rereview.md): IR-01〜04の4指摘すべて解消、新規阻害指摘なし。reviewerが専用62/62、旧独立16/16、新独立16/16を実行し成功。全回帰458件とは別suiteで重複coverageもあるため、単純合算で固有scenario数を表さない。
- reviewerは新公開CLIのshowも読み、成功記録のsimulation-stale/liveDeployment:falseと、validate停止/health:nullを独立確認した。対象11fileのSHA-256を報告へ固定。実装者は再レビュー報告を全文読み、現在bytesと照合した。
- 正式採用の確認範囲は、このローカルsimulation runner/CLI・candidate/合成観測と付随試験/文書だけ。実CLI adapter、実承認/権限/費用、実配備、公開、案件反映、whole HIMP-02/07・全8項目、canonical goldenの昇格は含めない。
- HIMP-01の既存採用は維持。2026-09-10の「正式採用してよい」により今回のsimulation-only採用待ちも解消し、[採用記録](2026-09-10-deployment-adoption.json)へscopeと元レビューhashを固定した。HARD-02/07は全要件未完了のためverifyingのまま。次はHARD-08のfresh/initialized fixture分離と生成ルート拒否。

## 初回snapshotの対象と根拠

個別案件のretrospectiveを現行ハーネスに照合した改善計画のHARD-02/07。前段のHIMP-01のみ正式採用済み。実行契約は [DEPLOYMENT_EXECUTION_CONTRACT](../../docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md)、操作は [DEPLOYMENT_SIMULATION](../../docs/harness/operations/DEPLOYMENT_SIMULATION.md)。

変更は固定fixtureを使うsimulation runner/CLI、candidate/scope/result schema、時間・競合・保存/読取境界と試験。公式Apps/Bundle CLIの再実装やlive adapterは作っていない。既存verifier/approval/budget/golden基準は変更していない。

## 初回snapshotの検証

環境: Windows / Node v24.15.0 / npm 11.12.1。外部CLI/ネットワーク/Databricks/DB/provider/モデル課金なし。

| 証拠 | 結果 |
| --- | --- |
| [初回red](2026-09-10-deployment-red.log) | module未実装で1 suite failed。既存runの35個の制御不良を観測したという意味ではない。 |
| [最初の試験](2026-09-10-deployment-first.log) | 当初35/35 pass。後の厳格化より前のsnapshot。 |
| 専用試験 `node --test tests/deployment-simulation.test.mjs` | 56 pass / 0 fail / 0 skip。DC-01〜06の反例と公開CLIを含む。 |
| [全回帰](2026-09-10-deployment-full-regression.log) | 452 tests / 451 pass / 0 fail / 1 skip。既存file-symlink権限試験がskip。今回のdirectory junction試験はpass。 |
| `node tools/harness.mjs check` | pass |
| `node work/evidence/2026-09-10-acceptance-adoption-check.mjs` | HIMP-01の採用対象5code/test bytes・3docsの許可範囲・独立報告・8条件維持、全てpass |
| `git diff --check` | pass |

## 初回snapshotの利用者入口での確認

公開CLIをこのrepoのactive sessionに対して実行した。隔離fixtureでのCLI試験に加えた操作確認であり、本番/開発Databricksに接続したものではない。

- [hard02-success-20260910-01](../simulations/deployments/hard02-success-20260910-01.json): 全5合成工程、mode=simulation、liveDeployment=false、simulated-success。
- [hard02-stop-20260910-01](../simulations/deployments/hard02-stop-20260910-01.json): validateのみ、validation-incomplete-or-failed、deploymentId/healthなし。終了1は期待した停止。
- candidate ID: `c164e76988f542e47440b7eee44b3cd1517a623a966d3db86efbd3a8d0691a26`。記録は当時の候補であり、その後のcode変更時に現候補の合格へ流用しない。
- fixture approvalは同じIDの `work/simulations/deployment-inputs/` にあり、実承認台帳に登録していない。
- 合成healthには60秒の期限がある。showは読取時にstaleを再計算する。URLは.invalidであり開いて利用する画面ではない。

## 初回時点の独立レビュー依頼と残り

[契約レビュー](../reviews/2026-09-10-deployment-contract-review.md)のDC-01〜06を契約と試験へ具体化。独立エージェントによる実装レビューを依頼済み。指摘と再試験結果を追記するまで採用可能とは扱わない。

[golden task提案](2026-09-10-deployment-golden-proposal.json)は未promote。両providerで同一Node CLIを使う設計だが、Claude Code / GitHub Copilotのモデル付きgolden実行は未実施。安全基準や予算を自己承認で変更しない。

実配備/承認範囲台帳/実artifact同一性/製品runtime画面/外部状態照合/release/案件への反映は未実施。HARD-02/07のtaskは検証中であってdoneではない。whole requirementの8条件を満たすreceiptも発行していない。
