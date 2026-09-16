# ハーネス公開対策の独立実装レビュー

最新結論: **第2回でPCR-01/02の修正を独立再確認し、今回の実装レビュー範囲に未解消の阻害指摘はない**。全要件の最終受入、実版更新、全回帰、forward記録は別途照合が必要。第1回の不合格記録は履歴として保持する。

- 日付: 2026-09-16
- 担当/別context: `/root/publication_code_review`
- 対象: `HARNESS-PUBLICATION-20260916`、ローカル未commitの公開検査/guard/CI/skill/更新試験
- 結論（第1回）: **修正後の再確認が必要**。送信commitと作業treeの取り違えを1件再現。案件側回帰不具合は報告後に担当者が修正し、独立再試験で解消を確認した。
- 実装は変更していない。再現scriptと本レビューだけを追加。一時合成案件/一時Gitだけを使用し、実案件・Databricks・本物のremoteへ変更していない。

## 指摘

### PCR-01 / P1: 削除fileをstageし忘れた送信commitが検査を通る（PUBC-02/03）

場所: `tools/lib/publication.mjs` の `checkPublication`、第1回snapshotの40〜41行。

`committed`の変更検出対象は現作業treeのmanifestに残っているpathだけである。新stampから削除した管理fileが送信HEADではまだ存在していても、そのpathはscopeから外れるため未commit削除を無視する。

再現:

1. 1.0.0で`tools/obsolete.mjs`を配布/commit。
2. 作業treeから同fileを削除し、1.1.0をstamp。
3. 新stamp/config/package/lock/移行案内だけをstageしてcommit。削除はstageしない。
4. `checkPublication(root,{committed:true,revision:HEAD,base:old})`を実行。

独立観測: `git diff --name-only HEAD`は`tools/obsolete.mjs`、`git show HEAD:tools/obsolete.mjs`は旧内容。しかし結果は`status:stamp-valid`、`committed:true`、`version:1.1.0`。remoteから取り直すと削除前fileが復活し、stampの完全集合と一致しない。これは単なる悪意のあるhook回避ではなく、選択stageの漏れで発生する。

再現script: `work/evidence/2026-09-16-publication-deleted-file-probe.mjs`。

受入条件: Git側の全管理path/差分を所有ルールで判定し、削除/rename元や送信treeにだけあるfileも検出する。未stage削除の拒否、正しくcommitした削除の成功を試験する。現在の集合だけをdiff filterに使わない。

### PCR-02 / P2: 更新先案件で配布テスト自身が失敗（PUBC-04/05、修正後再確認済み）

場所: `tests/publication.test.mjs`、初回109〜110行。

自然言語ルーティング試験が、実行しているrepoをハーネスsourceと決めつけていた。このtestは配布対象であり、初期化済み案件では`product.config.json`が存在するので、source専用公開routeを期待するassertが必ず失敗する。

独立観測: 必要fileをコピーした隔離案件にproduct markerを置き、同testを実行すると`actual:'define'` / `expected:'publish-harness'`でexit1、0pass/1fail。

修正: 担当者がpositive側も専用temp sourceで試験するよう変更。その後、同じ独立再現scriptでexit0、1pass/0failを確認した。

再現script: `work/evidence/2026-09-16-publication-review-probes.mjs`。修正後test SHA-256: `51bbb87a0ed23dabeb514d71f01c2593eba30f8b34e1b464a5ab4e1f86f2bdf2`。

## 独立実行と静的照合

| 対象 | 観測 | 限界 |
|---|---|---|
| `node --test tests/publication.test.mjs` | 初回11pass/0fail/0skip、Node 24.15.0、Windows | source repo実行だけではPCR-01/02を捕捉できなかった |
| 初期化済み案件での自然言語test | 修正前1fail→修正後1pass | 実案件ではなく隔離fixture |
| 未stage削除 | stamp-validを誤って返す負例を再現 | 実remote pushは行っていない |
| Hook設置 | 標準hookの排他作成・冪等・既存hook/core.hooksPath保持、通常Git push試験を既存11試験内で再実行 | 利用者の実repoで導入済みかは親担当の別確認 |
| CI | fetch-depth 0、正確なPR base/push before SHA、source限定check、zeroのみ比較省略を静的照合 | Hosted Actions/required checksの有効性は未検証 |
| 手順/skill | main公開にstamp/更新試験/移行案内を含み、Databricks配備・実案件更新と分離、同じ採用判断の再要求禁止、read-only相談を維持 | Claude Code/Copilotでの実provider実地検証は未実施 |
| 品質契約verify | 13findings: 設計hash差7、未実行5、review欠落1、recordedExecutions0 | 仕上げ中の記録。これを受入済みと扱えない |

PUBC-01は手順の静的適合、PUBC-02/03はPCR-01未解消、PUBC-04は最小fixtureのみ、PUBC-05は本レビュー以外のforward/全回帰/生成コピーの最終記録待ち。要件全体の完了をこの第1回レビューで認定しない。

## 第1回のレビューsnapshot

下記は読取直後のbytes。担当者による進行中の修正と区別するため、PCR-01は旧publication hash、PCR-02のtestは修正後hashを明記する。

| path | SHA-256 |
|---|---|
| tools/lib/publication.mjs | e6e5f2ffe2c4249a0853d8d224682f2af926fb851a52228ab0af27a80b6ce618 |
| tools/harness-publication.mjs | e99f5fe35874be33c0f6bc40403824181824a05996a5280654db169fc93cea69 |
| tools/lib/distribution.mjs | 86e7805161891c7868c1661c57ca39ffd092a359f180e4e64e631d05abad91d2 |
| tools/lib/workloads.mjs | 259b658ffbd7965e19812ab5de9edc2f7ae83fdcc7ead38b2e8dd5b107f49321 |
| tests/publication.test.mjs（PCR-02修正後） | 51bbb87a0ed23dabeb514d71f01c2593eba30f8b34e1b464a5ab4e1f86f2bdf2 |
| .github/workflows/harness-ci.yml | 431bbb76a4c2b5f92b88b3cdfad1a671a8c007788f3063616dacb22ce9809fea |
| harness/router.json | 46a45f5ea7af314a0c5db2680c23c2ee403e8ffd887d700a9691fc5bbe33d3f7 |
| harness/skills/publish-harness/SKILL.md | 168d39f9525c06556bfdc58831088014d7b107ba8e8d0ee5e640fa1619757f67 |
| harness/skills/improve-harness/SKILL.md | 3c036897340c811c75d0024a8e6bcfdecb792478f4d28746ba4a605cd1c1209b |
| harness/skills/orchestrate-work/SKILL.md | bad50c45ea42a0697a682ea2b09f9f19258966e119db415bc1677bb0e5b457fa |
| harness/skills/release-work/SKILL.md | 8f7cf7e044b2535a27cf1fa2a3e4e73e29f99f72bd78ad03f81c0e01879b8591 |
| docs/harness/operations/HARNESS_DEVELOPMENT.md | 9e37c3f4a839488ff393263639579d0e5fa40a0eb8b09a91134b033de8103824 |
| docs/harness/design/HARNESS_PUBLICATION.md | 2dce093c5077771adda668b97bf3a5d0fc921a1b79e7f3da6de6e76a0dc8df9b |
| docs/harness/requirements/2026-09-16-publication-contract.md | c00c67d6c59a9e9d55f0a1e3a64bae56ddc3ba1af0403da608c3d1ee81c8a4c1 |

## 第2回・修正後の独立確認

担当者が`assertPublicationCommitFiles`を追加し、Gitのindexではなく送信対象HEADの`ls-tree`から所有対象の完全集合を取得してmanifestと比較した。これにより作業treeでは既に消えているpathも確認対象となる。

- `node work/evidence/2026-09-16-publication-deleted-file-probe.mjs --expect-fixed`: exit0。未stage削除は`送信commitの管理file集合がstampと一致しません`として拒否し、削除をcommitした後は`stamp-valid`となる正常系も独立確認。
- `node --test tests/publication.test.mjs`: exit0、12pass/0fail/0skip（Node 24.15.0 / Windows）。追加の未stage削除回帰を含む。
- PCR-02の独立初期化済み案件probeも前記のとおり修正後exit0/1pass。
- 新たな阻害指摘なし。これらはローカル実装/拒否試験の確認であって、GitHub到達、Hosted CI、実provider、実案件への適用の証拠ではない。

| 第2回で更新された対象 | SHA-256 |
|---|---|
| tools/lib/publication.mjs | 76029a34d1efe153139bbee0be8908ff6b798ef2ccdb371dea632855095a2c1c |
| tools/lib/distribution.mjs | f34254d8a863d744577d7c9f4a372018fdb66efd52cfb59fca4677a311bc4409 |
| tests/publication.test.mjs | b3e3771b8a94935e157221273207a597a1c2d94d3907c6c2e8febe122624f217 |

独立レビューの指摘解消を、配布工程全体の完了へ拡大しない。最終snapshotの改行正規化や版/移行案内の追加後には、その差分と実版の更新証拠を照合する。
