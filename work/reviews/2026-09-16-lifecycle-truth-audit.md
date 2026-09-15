# セットアップ・更新・provider・記録機能の独立監査

2026-09-16 JST。担当: `/root/audit_lifecycle_truth`。Windows / Node.js v24.15.0。

結論: setup再実行の「既存ファイルは削除しません」という説明に、公開0.6.1でも再現する例外がある。provider実機、自然言語からの一連の運転、実provider切替後の復旧は未検証と明示されており、それ自体を今回発見した実装欠陥とは扱わない。ローカルの補助CLI・生成・記録・更新処理には実装とfixture試験がある。

## 対象と独立性

- 読取対象: README、docs/USAGE、setup/更新/provider/記録のoperations、関連要件・証拠・レビュー、setupスクリプト、asset生成、router、distribution、session/task/knowledgeの実装。
- `orchestrate-work`、`review-work`、`DOCUMENTATION_STANDARD.md`、`DELIVERY_ASSURANCE.md`を読み、`npm run harness:context`と関連active session・証拠を確認した。
- source HEADは`a77c96a`。working treeには未採用UIF/HARD-03が存在する。公開状態との照合には`.harness/runtime/publish-0.6.1-final`と`.harness/releases/0.6.1`を別々に使用した。今回のremote再取得はしていない。
- 公開manifest: version `0.6.1`、1,068管理ファイル、SHA-256 `d9c637a2c5a25182b58ce67c71792ccf02b1920ec22cc37f70afb209d71d726d`。これは[公開記録](../evidence/2026-09-15-publication-061.md)の値と一致する。
- 実装・実案件・認証・外部サービスへの書込みは禁止し、変更していない。テストは専用tempだけを書き換え、解決後の絶対pathを検査してそのtempだけ削除した。恒久追加は当報告と、主担当の追試用に依頼された[再現スクリプト](../evidence/2026-09-16-lifecycle-truth-probe.mjs)のみ。
- 通常sandboxは起動前に`helper_unknown_error: setup refresh had errors`で失敗。auto-reviewで許可された限定読取・temp試験を`require_escalated`で実行した。これは実装の試験失敗ではない。

## 再現した説明と動作の不一致

### LIFE-01 / P2: setup再実行が独自provider skillを消すのに、再開手順は削除しないと説明する

説明: [SETUP_WALKTHROUGH.md:234](../../docs/harness/operations/SETUP_WALKTHROUGH.md)は、ツール導入・更新後に同案件のsetupを再実行し、「既存ファイルは削除しません」と述べる。同233行にはsetupだけ失敗した場合の再実行もある。

実装: `tools/harness.mjs:377`はsetupのたびに`syncAgentAssets()`を呼ぶ。同189〜196行は両providerのskillディレクトリを`safeRemoveGenerated()`へ渡し、同158〜164行は対象全体を`rm(..., { recursive: true, force: true })`で削除する。canonical/vendorにない案件独自skillは復元されない。独自ファイルの事前検出、確認、backupはこの経路にない。公開0.6.1内の同関数も同じ処理だった。

独立再現:

追試: `node work/evidence/2026-09-16-lifecycle-truth-probe.mjs`。保存したスクリプトの再実行は主担当が行う。以下は当担当が先に同じ手順をinline Nodeで実行した観測である。スクリプトは再現成功をexit 0とし、実装が合格したという意味ではない。

1. 公開0.6.1の最終snapshotから`freshTemplateFixture()`で専用tempの案件を作る。
2. その案件で`node tools/harness.mjs setup --project-name published-0.6.1 --skip-agent-skills`を実行し、exit 0を確認。
3. `.claude/skills/project-only/SKILL.md`と`.github/skills/project-only/SKILL.md`へ架空の案件独自skillを追加。
4. 同じsetupコマンドを再実行する。
5. exit 0 / Setup成功だが、両ファイルは不存在。`product.config.json`と`databricks.yml`は元bytesを保持。
6. working treeから作った別fixtureでも同じ結果。

観測出力:

```json
{"label":"published-0.6.1","firstSetup":0,"repeatedSetup":0,"customSkillsRetained":[false,false],"productAndBundleRetained":true}
{"label":"working-tree","firstSetup":0,"repeatedSetup":0,"customSkillsRetained":[false,false],"productAndBundleRetained":true}
```

範囲の注意: [SAFE_LOCAL_UPDATE.md:65](../../docs/harness/operations/SAFE_LOCAL_UPDATE.md)は`agent-assets:sync`の再作成動作と独自skill保持の注意をすでに明示している。したがって「同期の削除動作自体が初発見」「safe updaterが独自skillを削除する」とは言わない。新しく確認したのは、通常のsetup再開経路が同じ削除へ入り、セットアップ手順の無条件な保持説明と矛盾する点である。

受入条件: setup再開の説明と実動作を一致させる。少なくとも独自skillがある場合に無警告で消失しないことを、再setupと公開用snapshot双方のfixtureで確認する。修正対象とする場合は、既存のcanonical/generated資産の契約を踏まえて保持・競合停止・明示した再生成のいずれを採るか決める。今回の監査では修正していない。

## 検証を配布先へ渡す際の不足候補（動作欠陥とは未判定）

公開0.6.1のsource snapshotにはあるが、release manifestと`files/`には次の3ファイルがない。

| ファイル | 公開source SHA-256 |
|---|---|
| `tests/acceptance.test.mjs` | `871176e7db53b007cf7e165c889507503c8c7d58d03081a5a005131764d7f96b` |
| `tests/deployment-simulation.test.mjs` | `9c941357e099040605bca2d940d21d76f071b262424beb02d8894ad2d2962221` |
| `tests/task-visibility.test.mjs` | `fe0b974640f4897d212ed3a06aeff5b5600317139aff01dda2ff8359078252cf` |

原因は`tools/lib/distribution.mjs:8〜22`の管理allowlistに3ファイルがなく、`tests/`全体も管理directoryではないこと。`collectOwned()`（99〜116行）はそこに指定されたものだけを収集する。現working treeでも同様。新規GitHub templateの全source取得と、既存案件への差分配布は集合が異なる。

公開source上で次を独立再実行し、133件成功、0失敗、0skipだった。

```text
node --test --test-reporter=tap tests/acceptance.test.mjs tests/deployment-simulation.test.mjs tests/task-visibility.test.mjs
# tests 133
# pass 133
# fail 0
# skipped 0
```

この3群には受入条件欠落・偽装完了の拒否、配備simulationの停止条件、task/context/checkpoint回帰が含まれる。[公開記録:22](../evidence/2026-09-15-publication-061.md)の全584件はsource snapshotでの試験結果であり、1,068管理ファイルの配布先へ全584件が自動導入される証拠ではない。

元repositoryの全試験集合をすべての更新案件へ渡すという明示的な約束までは確認できなかった。よって「公開試験が虚偽」「公開動作が壊れている」という指摘にはしない。配布先でも同じ回帰範囲を維持する方針なら追加が必要、という検証移送上の観測事項である。案件自身に以前から同名試験がある場合は、現allowlistでは新版へ更新されず古いまま残ることにも注意が必要。

## 実装と証拠に整合する範囲

| 項目 | 確認できたもの | 完成と呼べない範囲 |
|---|---|---|
| setup | 案件設定・Bundle初期生成、両provider skill/rules生成、元baseline登録、案件設定・Bundleの再実行保持。今回も隔離fixtureで成功 | app生成、npm依存導入、実resource/権限、deploy。ガイドは区別している |
| Claude/Copilot | 共通canonical skill、CLAUDE/Copilot instructions、path rules、hook設定とNode subprocessでのpayload試験 | 拡張/CLI/cloudで実modelが読み、発火し、一連の作業をした証拠。互換性表に未実行と明示 |
| 自然言語route | `harness/router.json`、`resolveRoute`、CLI、Claude route hook、更新専用skillと日本語例 | keywordは実行権限を与えない。Copilot command prompt hookのstdoutが採用されない点も文書化。実providerの意味判断は未試験 |
| 既存案件更新 | target明示CLI、固定source snapshot、元hash比較、競合停止、backup/journal、適用後の全管理hash確認。local source/extracted folderで動く | GitHub接続は必須でないがZIP取得/展開・供給者本人認証をupdaterが実施するものではない。復旧は自動rollbackではない |
| 日本語設計の配布 | 新規文書generator、canonical templates、documentation指示と両providerコピー。関連human-documents回帰を今回も実行 | 既存承認済文書の一括翻訳はしない。`docs/product/standards/FRONTEND.md`は案件所有で自動更新外。手動統合の明記がある |
| session/task/progress | 永続Markdown、current/next/gate/focus、省略数表示、revision照合、checkpoint履歴、完了receipt検査。task回帰を独立再実行 | `active`/`running`は実process監視ではない。表示も`Execution: not observed`を明示 |
| knowledge/復旧 | source・confidence・適用範囲・review date、index、supersession、provider共通ファイル、再開時の再確認手順 | 生チャットや未checkpoint操作の自動復元、実provider切替/compaction後の一連の再開試験は未検証 |

関係箇所: `tools/harness.mjs:342〜393`、`tools/lib/assets.mjs`、`tools/lib/distribution.mjs`、`tools/lib/memory.mjs`、`tools/lib/session-state.mjs`、`tools/lib/work-state.mjs`、`tools/lib/tasks.mjs`、`harness/instructions.json:19`、`docs/harness/operations/UPDATING_EXISTING_PROJECTS.md:80〜84`。

## 明示済み未検証事項

- `PROVIDER_COMPATIBILITY.md:9〜12`はClaude実model、Copilot拡張hook発火、CLI/cloudの試験不足を個別記載。26行はPreCompact通知が意味的checkpointの代用ではないと記載。24行はCopilot hook timeoutの制約を記載。
- `VALIDATION_STATUS.md`はL1を維持し、fake external responsesやtemp試験をlive OAuth/AppKit build/Databricks runtime証明としていない。
- `work/evidence/2026-09-15-publication-061.md:17`は実案件更新、実Claude/Copilot、Databricks操作を今回未実施と明示。remote CIは実測0件で成功扱いしていない。
- UI_RUNTIME_FIDELITY/HARD-03はworking treeの候補。今回の公開0.6.1の機能として数えない。
- 最新provider仕様のweb再確認、clean machine、Node22実機、macOS/Linux、実workspace/本番/費用を伴う評価は今回行っていない。履歴の公式参照日を現在の適合証拠へ置き換えない。

## 今回の試験

1. `npm run harness:context`成功。active sessionと明示された未検証状態を読取確認。
2. working treeで`node --test --test-reporter=dot tests/update-entry.test.mjs tests/distribution.test.mjs tests/task-visibility.test.mjs tests/memory.test.mjs tests/hooks.test.mjs tests/human-documents.test.mjs`を独立実行しexit 0。全repository回帰を当担当が実行したとはしない。
3. 公開0.6.1とworking treeの別temp fixtureでLIFE-01を再現。2環境とも初回・再setupは成功、独自skillは2つとも消失、案件設定・Bundleは保持。
4. 公開sourceの3つの未配布試験群を独立実行し133成功。manifest/path/hashを読み取りで照合。

過去の会話全文を監査したものではなく、現存する説明・実装・証拠を対象とした限定監査である。全機能実機適合、欠陥ゼロ、世界最高水準は証明していない。
