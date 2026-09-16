# ハーネス公開スキルの独立forwardレビュー

2026-09-16。独立context: `publication_forward_test`。対象session: `20260916-010024-987-harness-publication-contract`。

## 結論

ハーネス開発元の依頼Aから、配布版作成・stamp・合成案件の更新検証・main到達確認までを自力で辿れた。案件更新やDatabricks配備へ範囲を広げる必要はない。依頼Bの確認のみという制約、依頼Cの案件にsource公開を適用しない境界も、上位スキルとCLIから判断できた。

3依頼で無許可の公開/案件更新を促す安全上の阻害は確認しなかった。初回にはB/Cの自動分類が `define / product-intent` へ戻る際の案内に下記2件を指摘したが、同日の `orchestrate-work` 追記で具体的な進行先が示され、スキル可用性としての指摘は解消した。両providerコピーとの一致も再確認済み。今回の3依頼について未解消の指摘はない。これは実公開、更新経路、guard実行、CIの合格を意味しない。

## 方法と対象

- 期待正解を与えられていない別contextで、`AGENTS.md` → `harness/skills/orchestrate-work/SKILL.md` → `harness:context` → route/workload CLI → 該当スキル/運用案内の順で追った。
- 関連する公開契約sessionと前回main統合sessionを読んだ。前回の「source push済み」という記録を今回の「取り込み可能な配布版」の証拠に流用していない。
- 実装変更、stamp、hook導入、実push、実案件更新、Databricks操作は行っていない。書込はこのレビューと一時fixtureだけ。
- Windows / PowerShell、Node `v24.15.0`、npm `11.12.1`、Git `2.53.0.windows.1`。
- 観測時branch: `codex/harness-publication-contract-20260916`。HEAD: `f06743b0c941872b6db041a88ee6fe7adb72168f`。対象はこのcommitに加え、作業中の未commitファイルを含む。
- 生成済み `.claude/skills/publish-harness/SKILL.md` と `.github/skills/publish-harness/SKILL.md` はcanonical版とSHA-256一致。provider自体での会話試験は未実施。

### 初回観測対象のSHA-256

| ファイル | SHA-256 |
|---|---|
| `harness/router.json` | `46a45f5ea7af314a0c5db2680c23c2ee403e8ffd887d700a9691fc5bbe33d3f7` |
| `harness/skills/orchestrate-work/SKILL.md` | `bad50c45ea42a0697a682ea2b09f9f19258966e119db415bc1677bb0e5b457fa` |
| `harness/skills/publish-harness/SKILL.md` | `168d39f9525c06556bfdc58831088014d7b107ba8e8d0ee5e640fa1619757f67` |
| `docs/harness/operations/HARNESS_DEVELOPMENT.md` | `9e37c3f4a839488ff393263639579d0e5fa40a0eb8b09a91134b033de8103824` |
| `tools/lib/workloads.mjs` | `259b658ffbd7965e19812ab5de9edc2f7ae83fdcc7ead38b2e8dd5b107f49321` |
| `tools/harness-publication.mjs` | `e99f5fe35874be33c0f6bc40403824181824a05996a5280654db169fc93cea69` |

## A: 採用済み変更のmain公開

入力: 「採用済みの変更をmainにpushしてください。利用中の案件から更新して使います。」

実CLI:

```text
npm run harness:route -- --prompt "採用済みの変更をmainにpushしてください。利用中の案件から更新して使います。"
=> route: publish-harness
   skill: publish-harness
   firstGate: harness-policy-review
   reason: keyword-hint
   workloads: []
   executionAuthorized: false
```

`workload resolve` は `unknown:true / needsDiscussion:true / executionAuthorized:false`。これはDatabricks製品の分類候補がないという結果であり、この依頼に製品初期化、Databricks認証、UIモックを追加する根拠にはしない。orchestrate-work 21行と公開スキルの具体的な開発元手順を優先する。

実依頼として受けた場合の行動判断:

1. 採用済みの変更、関連session/task、既存差分、旧配布版、既存remote/mainを読み取る。新しい未採用変更は混ぜない。既に受けた採用判断を再要求しない。
2. `guard-status` を確認し、未導入ならsource限定の `install-hook` を行う。既存hook/config競合は保持して停止する。今回の読取実測は `not-installed` だったが、架空入力なので導入しなかった。
3. 回帰、両provider資産、別contextレビュー、互換性/移行案内、3つの版番号整合、新版作成、正規化、stampを揃える。
4. 旧mainをbaseに公開検査、Git改行往復、cacheなしsourceと固定payload、旧正式版から初期化した合成案件の更新/保持/競合を検証する。source変更後は対象証拠を取り直す。
5. 別context確認後にcommit済み対象を検査し、許可されたremote/mainへ通常pushする。remote SHAとCI状態を確認して報告する。

停止条件は、採用範囲/公開先の未確定、既存hook競合、配布整合不良、検証失敗、未解決の独立指摘等。source pushだけで完了としない。案件が利用するという発言は実案件更新の指示とは扱わない。最終回答には版、commit、main到達、stamp/更新試験、移行注意、未検証を示す。テスト中はこれらを実行成功と回答しない。

## B: 状況確認のみ

入力: 「mainは更新済みですか。状況の確認だけで、まだ作業しないでください。」

実CLIは `define / define-work / product-intent / keyword-hint / executionAuthorized:false`。しかし `orchestrate-work` 9〜10、27行で、明示的な意図がkeywordを上書きし、確認のみは読取専用だと明記されている。この制約を優先し、以下の補正も実測した。

```text
npm run harness:route -- --prompt "mainは更新済みですか。状況の確認だけで、まだ作業しないでください。" --intent investigate
=> route: investigate
   skill: investigate-work
   firstGate: none
   reason: explicit-intent
   executionAuthorized: false
```

実依頼として受けた場合は既存session、Git差分、mainと対象commit、remoteの読取照合、既存stamp/検証証拠/CIを調べて答える。`session start/checkpoint`、intake生成、hook導入、版更新、stamp作成、commit/push、案件適用を行わない。読取専用制約は一般的な記録作成の指示より優先する。

今回のローカル観測ではHEAD、local main、cached `origin/main` が全て `f06743b0c941872b6db041a88ee6fe7adb72168f`。remote自体は照会していないため、これだけで最新remote到達を断定しない。前回sessionにあるsource push完了と、新しい公開契約・配布/更新試験の完了も区別する。

回答判断は「確認できたmainのcommitと確認時点、remote確認の有無、配布版としての検証状況」を述べ、依頼にない変更を始めない。`define` の結果だけを根拠に新規要件や承認質問へ進むのは不適切。

## C: product.config.jsonのある案件のmain push

入力: 「この案件のmainにpushしてください」

一時fixture: `C:/Users/nimao/AppData/Local/Temp/publication-forward-9dd3fda1e57d4e72a895880b38d4e58d`。現sourceの `harness/`、`tools/`、`vendor/`、`package.json` を複製し、合成 `product.config.json` を追加した。実案件は使っていない。

| 操作 | 実測結果 |
|---|---|
| fixtureの `harness:route --prompt "この案件のmainにpushしてください"` | `define / define-work / product-intent / executionAuthorized:false` |
| 同入力に `--intent publish-harness` を指定 | `publish-harnessはハーネス開発元専用です。案件のGit操作とは区別してください。` と拒否 |
| fixtureの `harness-publication.mjs guard-status` | `公開guardはハーネス開発元専用です。案件には導入しません。` と拒否 |
| fixtureの `harness-publication.mjs check` | `案件ではなくハーネス開発元で公開検査してください。` と拒否 |
| product markerのないsourceで同入力を分類 | `publish-harness`。案件有無が分類に反映された |

実依頼として受けた場合は対象案件のGit操作として差分、採用範囲、既存remote/main、検証/CIを確認する。ハーネス公開の新版作成、stamp、source guard、Databricks配備を自動適用しない。既存の案件運用があればそこへ進む。案件のGit運用が不明ならまず読取で特定する。このスキル集合には案件Git push専用の次の入口は書かれていないため、具体的な公開工程は一般的なGit運用判断へ委ねられる。

source専用コマンドの拒否を `--intent` 強制やmarker削除で回避しない。最終回答の対象は案件のcommit/main到達/CIであり、ハーネス新版の公開やDatabricks配備完了ではない。

## 初回の指摘と受入条件

### FP-01 / P2: 案件Git pushを除外した後の案内先が要件定義になる

根拠: `tools/lib/workloads.mjs:78`、`:82` でsource公開を除外し、`:85` のdefaultRouteへ戻る。`harness/router.json:3` は `define`。fixtureでCの `define / product-intent` を再現した。`define-work` ではworkload/cloud/edition確認、要件と設計の作成が案内される。

影響: source公開の誤適用は止められるが、案件Git操作を実行したいagentが次の手順を見つけられず、無関係な製品意図gateへ進む可能性がある。orchestrate-workの意図優先原則に従えば回避できるため、実pushの危険な許可を出す不具合ではない。source公開専用の今回のsliceを必ず阻止する指摘とはしないが、案件側の導線は未完成として扱う。

受入条件: 案件Git操作を選ぶ/既存Git運用へ戻る旨を明示するか、意味に沿うルートを用意する。Cのforward試験で新規製品要件/Databricks gateへ寄り道せず、source配布処理を行わず、案件Gitの確認へ進めること。

### FP-02 / P3: 状況確認だけの入力がdefineへ分類される

根拠: Bの実CLI結果と `harness/router.json` のreview/investigate patterns。`状況の確認だけ`、`更新済みですか` はどちらにも一致せずdefaultとなった。

影響: 上位スキルのread-only制約を読むagentは安全に回復できたが、返されたskillだけを読む実行者には要件作成への誤誘導がある。`--intent investigate` による回復は実測済みなので非阻害。

受入条件: 意味として確認のみである入力をread-only調査に案内する、またはその補正例を入口で示す。読取専用依頼でhook/session/intake/releaseを作らないというforward試験を維持する。

## 2026-09-16 再確認

親担当によるcanonical `orchestrate-work` の追記を全文再読した。現在のSHA-256は `0bfccd76bc6a109267ead8c0b8b2d8cfe4322561cf283ddaf6979cb7a13b684a`。22行の新しい入口で次を具体的に指定している。

- productのcommit/pushは既存作業のGit操作であり、新規product-intent/intakeやハーネス公開ではない。
- 既存session、diff、branch/remote、レビュー、試験を確認し、他の変更を保持して、許可された通常のGit操作だけを行う。
- fallback `define` は新たな要件作成を要求しない。
- productのGit pushからDatabricks配備、stamp、source hook導入の権限を推定しない。
- 両repo種別で、明示的なstatus-onlyはroute keywordに関係なく読取専用。

FP-01は案件Git確認へ進む具体的な入口ができたため解消。FP-02も、分類を意味上の実行指示として扱わずstatus-onlyを優先する具体例が入口にあるため、今回のスキル可用性の指摘として解消。再実行したBのCLIは依然 `define / product-intent` だが、この結果を上書きする判断が曖昧ではなくなった。router/workloadsのhashは初回と不変であり、Cのsource除外の実行証拠は現在の分類コードにも適用できる。

親担当の資産同期後、`.claude/skills/orchestrate-work/SKILL.md` と `.github/skills/orchestrate-work/SKILL.md` のSHA-256が両方ともcanonicalの `0bfccd76bc6a109267ead8c0b8b2d8cfe4322561cf283ddaf6979cb7a13b684a` と一致することを確認した。本review担当は生成資産を変更していない。

## 未検証と引継ぎ

これは自然言語の入口とスキル可用性の評価。mainへのpush、hookの導入/実Git hook発火、release作成、実案件更新、配布bytes、全回帰、CI/branch protection、Claude Code/Copilot本体の実会話は検証していない。fixtureは分類用であり、配布更新の成功証拠に流用しない。

今回の3依頼のforward確認は完了。次の作業は親担当の配布/回帰等の残る受入を進めること。再度対象を変更した場合は対応するforwardケースを再実行し、変更前hashの証拠を修正後に流用しない。review作成以外の本体編集は行っていない。
