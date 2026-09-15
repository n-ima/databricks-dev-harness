# FIX-01 / FIX-04 / FIX-05 独立レビュー

2026-09-16 JST。担当: `/root/audit_lifecycle_truth`。Windows / Node.js v24.15.0 / Python 3.12 / PyYAML 6.0.3。

結論: **下記の最終snapshotについて、担当範囲に未解消の阻害指摘なし。** Lakebase技能訂正、skill同期の保持・事前停止・backup/再試行、Metric SQLの埋込YAMLをローカルで独立検証した。実Databricks、実provider、ネットワーク、公開版更新の受入はしていない。

## 範囲と独立性

要件`docs/harness/requirements/2026-09-16-truth-repair.md`、設計`docs/harness/design/TRUTH_REPAIR.md`、同期/上流訂正/Metric生成の実装、既存3試験を読んだ。既読の`orchestrate-work`・`review-work`、文書標準、品質契約手順に沿ってcontextと関連sessionを確認した。FIX-02/03のloop/session制御は別担当範囲であり、ここでは合格判定しない。

実装sourceは変更せず、別の合成fixtureと追加反例を[独立試験](../evidence/2026-09-16-truth-assets-independent.test.mjs)へ作成した。主担当の追加依頼により、非Pythonの20ケースだけを[通常CI向け試験](../../tests/truth-asset-boundaries.test.mjs)へ移し、import・未使用を調整した。元の独立試験は保持した。

全書込みは専用temp、依頼された証拠/レビュー、追加CI試験に限定。Databricks installerとlegal fetchを通す試験は、子Node内でそれぞれ固定応答に置き換えた。未定義の外部commandは例外にし、実CLI/ネットワークへfallbackしない。これを実refresh成功とは表現しない。

## 要件と観測

| 要件 | 独立確認したこと | 限界 |
|---|---|---|
| FIX-01 | 元0.2.10のhashへ逆変換できる訂正、二重適用の冪等性、改変元の拒否、両providerとcanonical vendorの一致。実CLIのsetup/refresh経路を模擬installer/legal応答で実行し、同版は訂正が維持され、版違い/hash違いは現vendor・lock・両providerのbytesを保持して失敗 | 実Databricks Appsのresource型やroleを操作していない。公式内容の再検索は今回行わず、親監査が確認した根拠に対する訂正の伝達と維持を確認 |
| FIX-04 | 両targetそれぞれに未知file/空directoryを置き、どちらの既存skillにも書く前に拒否。target全体/配下のjunction、hardlinkを拒否。初回同期、通常再実行、全上書き対象のbackupとmanifest/hash、write/rename失敗後の再試行、cleanup自体失敗時の正確な残骸path表示と保持 | file symlinkの作成はhost権限で1skip。junction/hardlinkは実行済み。同一OS権限の敵対的な同時writerやprocess強制終了からの自動rollbackを保証しない |
| FIX-05 | 埋込本文と正本YAMLが同じbytes、PyYAMLで同じmappingに解釈されること、日本語・引用符・colon・#の保持、description/dimension/measure名の`$$`がSQLを途中終了させず元表示値へ戻ること、DRAFT表記とnoExternal依存による非実行 | ローカル構文・生成契約のみ。Databricks DDLの実行、catalog/権限、Metric Viewの実クエリ意味は未検証 |
| FIX-06の担当分 | 独立失敗・成功ログ、CI移植、最終hash、既存候補の非重複8ファイル、公開0.6.1 manifest/1,068payloadの保持 | 全repository回帰と品質契約全体は主担当が実施。今回の3機能判定から全HARNESS要件や他OS適合へ拡張しない |

## レビュー中に見つけて修正を確認した事項

### ASSET-R01 / P2: description等の`$$`でMetric SQLの文字列が閉じる

`description='Profit $$ USD'`でplan/applyが成功したが、`AS $$`内のcommentに入力した`$$`が入り、SQL本文の最初の区間は`comment: "Profit `で途切れた。同じ問題はdimension/measureの表示名にもあった。expressionの既存拒否だけでは防げなかった。

主担当は`metricYaml()`の二重引用文字列中の`$`をUnicode escape `\u0024`へ置換した。最終試験では正本/埋込の両方が一致し、PyYAMLで元の`Profit $$ USD`等へ戻ることも確認。単に区切り文字数を合わせただけではなく、表示値の意味も保持される。原指摘はinline tempで再現後に通知し、保存試験r1の実行時点では既に修正されていたため、r1中の当該3ケースはpassである。

### ASSET-R02 / P2: atomic rename失敗の一時fileが同期の再試行を阻害する

2番目のproviderへのrenameを決定的に失敗させると、両providerの旧bytesはbackupされたが、`SKILL.md.tmp-...`が残り、次の同期はその自身の残骸を未知fileとして拒否した。r1/r2で再現した。

主担当は共通`atomicWrite()`を、`wx`で排他的に作成した一時fileだけを所有し、write/rename例外時にはそのpathだけをunlinkする処理へ修正した。最終試験でwrite途中失敗・rename失敗とも旧backupを保持し、明示再試行が成功した。cleanupをさらに失敗させると元例外に残骸の正確なpathが記載され、未知残骸を消さずに再同期を拒否する。強制終了/cleanup失敗の個別復旧と、全体rollbackではないことも設計へ追記された。未知ファイル全体の削除は導入されていない。

### 説明の一致

`TRUTH_REPAIR.md`は、上流原本そのものを保持するという旧表現から、「版・原本hash・可逆な差分を保存しcanonical vendorを訂正後に両providerへ同期」へ更新された。これは現実の処理に一致する。`SAFE_LOCAL_UPDATE.md` / `UPDATING_EXISTING_PROJECTS.md`の旧「生成先全体を再作成」の説明も、是正後の保護と旧版の違いを説明する内容へ更新された。`SETUP_WALKTHROUGH.md`は案件設定/Bundleの保持と、独自skill検出時の停止・backupを区別する。

## 試験結果

| 実行 | 結果 | 証拠 |
|---|---|---|
| r1: 既存3＋初期追加反例 | 22件、19pass/2fail/1skip | [r1](../evidence/2026-09-16-truth-assets-independent-r1.log) |
| r2: offline refresh・YAML意味確認を追加 | 25件、23pass/1fail/1skip。残るfailはASSET-R02 | [r2](../evidence/2026-09-16-truth-assets-independent-r2.log) |
| r3: atomicWrite修正後、write/cleanup失敗を追加 | **27件、26pass/0fail/1skip** | [最終独立ログ](../evidence/2026-09-16-truth-assets-independent-r3.log) |
| 通常CI用の非Python試験単体 | **20件、19pass/0fail/1skip** | [CI単体ログ](../evidence/2026-09-16-truth-asset-boundaries-ci.log) |

r1のもう1failは独立試験側のPython stdinがWindows既定encodingで読まれたこと。`python -X utf8`を明示して解消した。製品のYAML欠陥として数えていない。全runのskipはfile symlink作成権限のケースのみ。既存3件＋独立24件とCI移植20件には重複があるため、47件の別ケースとは数えない。

```text
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-16-truth-assets-independent-r3.log tests/truth-assets.test.mjs work/evidence/2026-09-16-truth-assets-independent.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-16-truth-asset-boundaries-ci.log tests/truth-asset-boundaries.test.mjs
```

## 最終snapshotと保持確認

| 対象 | SHA-256 |
|---|---|
| `tools/lib/skill-sync.mjs` | `2421b22a3457f8052aed9dd070ed11969fc4500ceba8b580488ecbc69d0343c6` |
| `tools/lib/vendor-patches.mjs` | `c927473eb0c32ac8d6cd72b1eb66f6f172ee3593eaea252d16df20e172ffa3c1` |
| `harness/vendor-patches.json` | `6a869a029cc96495af65bb76175fec848bcd357f480cab34e083eed3aff34735` |
| `tools/harness.mjs` | `878336a39d405e72143fdaa95f0db905617117e1d713206a77a76285d7a20965` |
| `tools/lib/scaffold.mjs` | `cb94cbb978f6a4f28e1c67691378267a0cddeb2f405f30a77a679c1e3dd35d8b` |
| `tools/lib/shared.mjs` | `7263c67f48e4acaa4422f4b0f3737afac5824aec8fe6e5621b43b7021b2321e6` |
| `tests/truth-assets.test.mjs` | `5fb1ccd4ffe48a140c5e9d21fcf2c72679f03ef8fd63cead73390748e5f085e7` |
| `tests/truth-asset-boundaries.test.mjs` | `2578b1ce550044e9db7d44f325edd25646cf2b623292f325a0281b3b7d53ca16` |
| `work/evidence/2026-09-16-truth-assets-independent.test.mjs` | `477ba0b19b3a0e1766605be75edb0a5a6cdf25b3636e0a55e4c834e87d41942f` |

`2026-09-16-truth-repair-baseline.json`に対して、AGENTS、ui-contract、scoped-approval、approval schema、FRONTEND標準、build/mock/reviewのcanonical技能の8ファイルを独立照合し一致した。共通ファイル内にあるUIF/HARD-03との全差分分離の検証を、この8ファイル一致で代用しない。

公開0.6.1 manifestのSHA-256は`d9c637a2c5a25182b58ce67c71792ccf02b1920ec22cc37f70afb209d71d726d`のまま。全1,068payloadのhashをmanifestと再照合し一致した。今回の修正はその公開payloadに入っていない。

この結果はFIX-01/04/05のローカル是正の独立証拠であり、providerが実際の会話で指示へ従うことや、本番運用を認定するものではない。
