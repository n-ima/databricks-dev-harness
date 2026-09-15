# Delivery assurance候補の独立再レビュー

日付: 2026-09-14 (JST)。結論: DA-IR-01 [P2]は解消。今回確認したローカル候補の範囲に未解消の阻害指摘なし。正式採用・案件受入・実環境検証を意味しない。

原作者: main agent `/root`。検証者: 別context `/root/delivery_candidate_verification`。初回レビュー: [2026-09-14-delivery-candidate-review.md](2026-09-14-delivery-candidate-review.md)。初回報告・独立テストは変更していない。再レビューで実装変更は行っていない。

## 修正確認

`check.mjs`はOpenAPI path itemに`Object.hasOwn(item,'additionalOperations')`がある場合、操作集合を合格扱いせず`UNSUPPORTED_CONTRACT`を返す。通常操作に追加操作を併記した初回反例にも作用し、追加操作の黙示的な脱落を防ぐ。追加操作の全仕様対応を導入せず、未対応として止める変更は初回指摘の受入条件に合う。

READMEと設計にもOpenAPI 3.2 `additionalOperations`を未対応として診断する境界が明記され、実装と整合する。初回と比較して変更された検査対象は実装・README・設計の3ファイル。要件、既存テスト、独立テスト、既存acceptance parserのhashは不変。

## 独立実行結果

Windows、PowerShell、Node.js v24.15.0。原作者の実行報告を転記せず、検証者自身が再実行した。

```text
node --test work/candidates/delivery-assurance/check.test.mjs work/candidates/delivery-assurance/independent.test.mjs
tests 56
pass 56
fail 0
skipped 0
```

既存35件と独立21件が成功。初回に失敗した`independent additionalOperations omitted inventory must be diagnosed`も同じ独立テストbytesのまま成功した。要件集合、通常API操作集合、正負ケース、concern、証拠bytes/参照/basis/review、同一context、未実行状態、サイズ・件数制限、CLI終了コードの回帰も成功。

## 再確認snapshot (SHA-256)

| 対象 | SHA-256 |
|---|---|
| work/candidates/delivery-assurance/check.mjs | ec4aa321730ea1914b9ff1d27ca951addd7ce3537b16abb57c3bf97b424bdf77 |
| work/candidates/delivery-assurance/check.test.mjs | 8125bd41d0bde3aee4840c658e68e58ce697e2d568e2042144484d3497ff7286 |
| work/candidates/delivery-assurance/independent.test.mjs | 9ec4ebd9d1115dae2f545b84065a9b7e29a1e8ef2bc7cc6f9d685bfb60c56653 |
| work/candidates/delivery-assurance/README.md | 5b44bfd3e5475c1701df62923cd7a222292480118b4350f81c06eb56ddf2239a |
| docs/harness/requirements/2026-09-14-delivery-assurance.md | b4734ac640df40cac5ce22c8040b3622eec1a8e4411c95acfb27eef7b4bb7716 |
| docs/harness/design/DELIVERY_ASSURANCE.md | 43ac5bea2b4a8763649121912eb94fa3d096230b2bf781e71fc19716e0bb1ee0 |
| tools/lib/acceptance.mjs (既存依存、未変更) | a4785ef8688781d3be53724f301d20e6b051d778b9f947f23102431dc2c4b8f0 |

## 検証範囲と残り

初回のAC対応表のうちAC-02〜AC-07に関するローカル候補の診断項目を再確認し、AC-03の唯一の実装指摘を解消した。AC-01の再調査全体、AC-08の比較計画そのものは別担当範囲のため、この再レビューで受入判定していない。

providerやDatabricksの呼出し、全repository回帰、業務意味の完全網羅、本人認証、敵対的filesystem TOCTOU、配備・公開は今回の独立検証に含まれない。合成fixtureのpass/devは実環境証拠ではない。候補は`advisory`、`certifiesAcceptance:false`を維持しており、この結果だけで既存gateを解除しない。

次: 親taskはこのsnapshotと実行証拠をsessionへcheckpointし、全体回帰・別担当の調査と評価計画を統合する。標準フローへの正式採用と実環境評価は別の判断として扱う。
