# 品質契約CLI正式採用の独立コードレビュー

2026-09-15 JST。検証者: `/root/delivery_adoption_code_review`。対象は要件 `HARNESS-HUMAN-DELIVERY` の HD-01。結論: ローカルCLI・配布統合の確認範囲に未解消の指摘なし。初回に再現した終了値の不一致 HD-IR-01 [P3] は修正後に解消を確認した。

実装は検証者が変更していない。追加したのは本報告と `work/reviews/2026-09-15-delivery-adoption-probe.mjs`。関連セッション `20260914-230811-631-human-readable-delivery-adoption` と要件・設計・計画、`orchestrate-work` / `review-work`、文書標準、品質契約の運用手順、品質・安全性標準を読んだ。関連する別件のdirty変更を受入対象にしていない。

## 要件と確認した証拠

| HD-01の内容 | 独立に確認した証拠 |
|---|---|
| 正式CLIへ統合 | 複製した `tools/harness.mjs` を子processで起動し、check / hashes / helpと終了値0・1・2を確認 |
| 配布対象へ統合 | 一時fixtureのrelease manifestにmodule、2つの移植テスト、JSONひな型、運用手順が含まれ、それぞれのpayload hashと一致。案件用src / contractは配布対象外 |
| 元の不正入力・未実行・snapshot・独立性診断を維持 | 元候補との差分を確認し、移植した56試験を独立に再実行。欠落/重複ID、不正参照、未実行/失敗、環境不一致、古い結果/review、同一actor/context等を検出 |
| 受入証明を発行しない | 合成pass記録でも `mode:advisory` / `certifiesAcceptance:false`。件数は `recordedExecutions`、旧 `executed` は出力しない |
| commandを実行しない・read-only | 実行されればmarkerを書く文字列を記録し、CLI実行前後の一時fixture全通常fileの一覧とSHA-256が一致 |
| 読み取り境界 | 絶対/親/URL/隠し/予約pathとjunctionを拒否。元試験で1 MiB上限、合計16 MiBと128参照上限も確認 |

品質契約ひな型は未確定の設計材料であり、テスト結果はnull、reviewは空のまま。運用文書はhash計算・構造診断の限界、外部fetchなし、未対応のOpenAPI構造、独立レビューの必要性を記載している。`hashes` が古い参照でも記録からhashを計算できることと、`check` が同じ入力でARTIFACT_MISMATCHを返すことも確認した。

## 初回指摘と解消

HD-IR-01 [P3]: 不正な `--phase invalid` が `INVALID_SHAPE` 診断として終了1となり、運用文書の「2=引数/読取失敗」と不一致だった。独立probe初回は7件中6pass・1fail。受入条件は有効な契約で不正phaseを指定して終了2となること。

実装担当が `deliveryCommand` の読取前にphaseの列挙検査を追加した。最終再実行では同じ期待値の独立probeがpass。probe側のその後の変更は配布fixtureに不要なtools複製/削除を避ける準備処理のみで、失敗したassertionを緩めていない。

## 正確な検証コマンドと結果

環境: Windows / PowerShell / Node.js v24.15.0。作業directory: `D:\projects\databricks-dev-harness`。通常sandboxの初期化が失敗したため、許可された `require_escalated` でローカルfixture試験を実施した。

```text
node --test tests/delivery-assurance.test.mjs tests/delivery-independent.test.mjs work/reviews/2026-09-15-delivery-adoption-probe.mjs
tests 63 / pass 63 / fail 0 / skipped 0 / exit 0

node --test --test-name-pattern 'release owns only|keeps provider rules' tests/distribution.test.mjs
tests 2 / pass 2 / fail 0 / skipped 0 / exit 0

git diff --check -- tools/harness.mjs tools/lib/distribution.mjs
exit 0

node tools/harness.mjs delivery check --contract harness/templates/delivery-contract.json --phase invalid
exit 2
```

上記63件は修正後に検証者自身が再実行した。初回56件の成功や実装担当の試験報告を最終再実行の代用にしていない。配布テストはsynthetic packageのみを作成し、本repositoryのreleaseや他案件へ適用していない。一時fixtureは試験終了時に削除した。

## 最終検証snapshot（SHA-256）

| 対象 | SHA-256 |
|---|---|
| tools/lib/delivery-assurance.mjs | 9584432361f776c17f72beab197785b64b2e812380155ffa042bd9b65148a6da |
| tools/harness.mjs | 98f6ac9ea227cb5f34c3842b738f300a8129a3b4ff708e1a541439c88aede701 |
| tools/lib/distribution.mjs | 763eefafdb278ad3edd0113fa47150cd756d6af0f478e383f5535dcd2aa41a31 |
| tests/delivery-assurance.test.mjs | 8045b380de808992c47f97a65c80225c310a0fedaf5d1709195904acd982ffac |
| tests/delivery-independent.test.mjs | 596f544de3e7dcfa3b28a3f8d14e63740eede88f523a3d1815f26afc86854b39 |
| docs/harness/operations/DELIVERY_ASSURANCE.md | a31498656c91f746da1615cd442b64572b75ea9a767f2d5e206c5f5fd8eb7ca4 |
| harness/templates/delivery-contract.json | b883d5a2b6b4e411c48d781a0162f7776b119402799c6f73b4463715654df6ee |
| tools/lib/acceptance.mjs（依存、変更は別担当範囲） | fa8506f8c1d7c267135b4720958bb02933867c4f3fa8be1f6ce153c5ca1b39f3 |
| work/reviews/2026-09-15-delivery-adoption-probe.mjs | 2082809520c8c2dc2bceee310229c642d8210cb9c4c8e481636d04ef826bbb2f |
| docs/harness/requirements/2026-09-15-human-readable-delivery.md | 51ea7b7046c86dbecb8c7fa265624858950cce1a44b96e3a77aa5b68c3b95b1b |
| docs/harness/design/HUMAN_READABLE_DELIVERY.md | 72ff0637b5355fe022af2fe470b862ca974719025acda9b8983f74c26d1e3f76 |

## 残る確認範囲

HD-02〜HD-05の全体受入、全repository回帰、Claude Code/Copilot実provider、実Databricks、課金、remote操作、個別案件、Linux/macOS、敵対的filesystem同時操作は本独立レビューの実行対象外。合成fixture内のpass/devは実環境の成功を意味しない。診断はactor/contextの本人性、実行の真実性、業務上の意味や省略の妥当性を認証しない。この報告単独でsession完了receiptや承認gateを置換しない。

次: 親taskが本snapshotとHD-02〜HD-05の検証を合わせてsessionへcheckpointし、全体回帰・生成指示同期をまとめる。対象bytesが変わる場合は差分とsnapshotを再確認する。
