# UI契約・承認・loopの独立コードレビュー

- 確認日: 2026-09-15
- 担当: `/root/ui_fidelity_design_review`（実装担当と別context）
- 試験: `work/evidence/2026-09-15-ui-fidelity-independent.test.mjs`
- 対象: `tools/lib/ui-contract.mjs`、`tools/lib/approval.mjs`、`tools/lib/loop.mjs`、`tools/lib/scaffold.mjs`。後半でscaffold移行の独立合成試験も追加した。
- 再レビュー判定: **今回の限定コード範囲は合格。UIF-C01は修正後に再現しなくなった。独立45件と既存安全性等97件、合計142件成功・失敗0件。** 人の採用判断・文書/全回帰・実案件への反映は別に判断する。

## 実行結果

すべて合成fixture。実際のAppKit package、React画面、ブラウザー、Claude Code、GitHub Copilot、Databricks、本人の承認を実行・認証していない。provider/checkは関数stubで、実サービスを呼ばない。試験専用のtemp directoryは各試験後に、確認済みの専用pathだけ削除する。実案件、HARD-03、既存配布payloadは変更していない。

最初の実行中に実装側へ`runtime.sources`が追加されたため、旧fixtureでschema前段24件が失敗した。これは製品の欠陥として集計せず、独立fixtureに画面とSharedButtonのsource参照を追加した。

```text
node --test work/evidence/2026-09-15-ui-fidelity-independent.test.mjs
30 tests / 30 pass / 0 fail / 0 skip
duration 2818.5637 ms
```

その後に追加した依存版不整合の反例:

```text
node --test --test-name-pattern='incompatible manifest' work/evidence/2026-09-15-ui-fidelity-independent.test.mjs
1 test / 0 pass / 1 fail
AssertionError: Missing expected rejection.
```

## UIF-C01: manifestとlockの解決版が両立しないのにUI承認される

重要度: 高。`ui-contract.mjs`はAppKitのmanifest依存指定について文字列であることとlock rootの同じ指定を確認するが、lockの解決版との適合を確認していない。

反例は、package.jsonの`@databricks/appkit`依存とpackage-lock.packages[''].dependenciesをともに`9.9.9`へ変え、node_modules/@databricks/appkitのlock versionと契約runtime.versionを`1.2.3`のままにする。契約のファイルhashと別contextレビューのbasis hashを更新すると、`createApproval`はapproved receiptを書き込み成功する。npm ciで成立しない組合せを「package/lock版一致」と扱っている。

修正案: 正確なresolved versionとdependency specの整合を検証する。任意のnpm specを自前で広く解釈する必要はなく、対応するexact/caret/tilde等を明示し未対応をfail-closedにできる。正当なAppKit初期化結果の依存指定が不用意に拒否されないことも回帰対象にする。ロックのpackage宣言を検査しているだけで、実際のインストールや描画を確認したという意味にはしない。

## 確認できた強化

- 契約と正常承認のsource/style/fixture/lock/review hashが紐づく。`certifiesAppearance`と`identityAuthenticated`はfalseで返る。
- 別session、別appRoot、別AppKit version、legacy receipt、自己review、空画面、未確認状態、未解決差分、古いreview、無承認の外部hostingを拒否する。
- source、共有部品、style、fixture、lock、reviewの承認後変更を拒否する。拒否時に新approved receiptが存在せず、pending gateが残るケースを確認した。
- runtime-htmlはpreviewのみ許し、実行可能ui-mock承認には利用できない。
- external hostingと別frameworkは、対象と要件hashに合った明示例外を記録すると成功し、違う対象の例外は拒否する。
- loopはgate解除時だけでなく、次run、別gate後、providerがUIを変えた直後、achieved記録時にもUI契約を再検証する。古いUIのままprovider/checkを続けないことをstub呼出回数で確認した。
- 非UIのproduct-intentとloopにUI契約を強制しない。ui-initは下書きだけを作り、既存契約を上書きしない。

## 意味上の限界

列挙したruntime.sourcesに含めた共有部品の変更は検出するが、import graphの完全性を自動証明してはいない。独立レビューは共通部品、theme、asset等の列挙漏れも確認する必要がある。テストでは正しく列挙したSharedButtonを変更して拒否を確認したのであって、未列挙ファイルをすべて見つけたという試験ではない。

構造とhashだけでは、HTMLが本当にそのruntimeから描画されたか、画面や操作が要件に合うか、actorが実在するかまでは証明しない。これらは本実装と同じ部品の画面確認、別contextレビュー、対象を示した人の承認が引き続き必要。実providerと実案件は未検証。

## 対象hash（30件成功後・追加反例確認時点）

```text
ui-contract.mjs b88fc6281faa9c4dc2339f8ea819bfc5f361f92fccac696ccc19c69568d1153d
approval.mjs    5636a238d15de0587221b80ade9899eb93e232223c8decde6503e778eff3a9d9
loop.mjs        f1a6ae9de6e2890e6b864762b24adc3f0ec081e333c7f7371e42324e7490009d
```

この記録後にコードが変わった場合は、変更hashで再試験して追記する。一般回帰、provider資産同期、文書一貫性、採用判断、公開は本記録の合格範囲に含まない。

## 再レビュー: UIF-C01解消と安全性の維持

実装担当が`versionSatisfies`を追加し、manifest指定とlock解決版の整合を確認するようにした。stableのexact/caret/tilde、pre-releaseのexact一致に限定し、npm alias・URL・複合rangeなど未対応指定を推測で通さない。

独立試験へcaret/tildeの正常・不適合、0.x/0.0.xの境界、pre-release、alias、複合rangeの計12ケースを追加した。UIF-C01の9.9.9/1.2.3も拒否する。AppKit本体の実インストール成功はこの結果からは主張しない。

さらに新integration planがneeds-inputとなることと、旧ready integration planもapply時に拒否されることの2ケースを追加した。両方で外部呼出0回、旧planのbytes保持、出力appなしを確認した。既存fixture appは同一ソースの通常buildを継続し、別appへ再initしただけで以前のUI承認を転用しない、という互換性変更は妥当。

`tests/contracts.test.mjs`の認証直前再確認と生成後validation失敗の試験は、廃止するintegrationではなくmock成功経路へ移して維持されていた。単に早期拒否でそれらが未到達のままgreenになる変更ではない。出力のsymlink/junction/hardlink、byte/depth/entry上限、case alias、root制御ファイル、loop競合・policy改変・受入receiptの拒否も独立に再実行した。

```text
node --test work/evidence/2026-09-15-ui-fidelity-independent.test.mjs tests/contracts.test.mjs tests/scaffold-output.test.mjs tests/loop-concurrency.test.mjs
142 tests / 142 pass / 0 fail / 0 skip
duration 8324.9087 ms
独立新規45件 + 既存97件
```

設計/利用説明では「scaffold integrationの承認を共通validatorで許可する」のではなく「新旧integration initを拒否して既存appのbuildへ誘導する」と実装通りに説明する必要がある。この文書整合の依頼は実装担当へ伝達した。

### 再試験時点のSHA-256

```text
tools/lib/ui-contract.mjs 0f68b0c966416c2b56b9a314cadaf1d59d7620a6a3af3511eaca7b0041d5a6ab
tools/lib/approval.mjs 5636a238d15de0587221b80ade9899eb93e232223c8decde6503e778eff3a9d9
tools/lib/loop.mjs f1a6ae9de6e2890e6b864762b24adc3f0ec081e333c7f7371e42324e7490009d
tools/lib/scaffold.mjs d1b95ff08738c880c099ca19a4c2643ba9b290494e454c631f6dbc9c2d40cbf8
tests/contracts.test.mjs 9c2a5a840b788ed5e3e2915c8105b5712237b93091abe6e814e9babbc1d96aa0
tests/scaffold-output.test.mjs 64ef60287639cc8d8d2753ed97969d5187b9827f1a96240bdc31cff0dd73c9f0
tests/loop-concurrency.test.mjs 1af3fcdc0c12e067cc11cdd5db372baa0acd4e39412b7a62f0a32a871ba951cd
work/evidence/2026-09-15-ui-fidelity-independent.test.mjs d9f8c07cc0189004aeea361a90c5e10d228ebc652f2c33e8388f3e5f2dfaecb7
```

先の不合格結果は修正経緯として保持しており、現在の判定はこの再試験結果に基づく。
