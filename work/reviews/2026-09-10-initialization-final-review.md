# HARD-08 independent final review

Date: 2026-09-10 (JST)
Reviewer: independent `deployment_contract_review` agent
Environment: Windows / Node.js v24.15.0
Decision: **HI-01〜HI-04 解消。今回のローカル限定 slice に未解消 P1 / P2 なし。**

この報告は独立検証結果であり、正式採用・完了 receipt・実環境への実行許可ではない。人への限定採用提示を妨げる技術的所見は残っていない。最終候補は下記 SHA-256 の版に限定する。

## Scope and method

`review-work` に従い、受入契約 INIT-01〜03 / ROOT-01〜04、retrospective の HIMP-08、変更実装、canonical tests、独立負例、red / green 記録を照合した。初回からの独立 33 probe は変更せず保存・再生し、最後に 9 個の control 型・診断互換・cache 正例を追加した。

全独立 probe は local temporary fixture / injected CLI fake のみ。実 Databricks CLI、認証、network、provider、案件 repo、実配備、push は行っていない。関連 baseline の Python subprocess は既存の標準ライブラリ fixture unittest に限る。reviewer の書込は新規独立 test / log / review のみで、実装・要件・canonical test・承認・以前の deployment 記録は変更していない。

## Final observed evidence

| Verification | Result |
| --- | --- |
| Independent: unchanged 33 probes + 9 new control probes | **42 pass / 0 fail / 0 skip** |
| Related canonical: initialization / scaffold-output / harness / scaffold-data / distribution / contracts | **152 tests / 151 pass / 0 fail / 1 existing link-permission skip** |
| Main-agent full-r6 log, read by reviewer (not a separate full run) | **505 tests / 504 pass / 0 fail / 1 skip** |
| Final core / scaffold hashes at independent run start and end | Identical |

`work/evidence/2026-09-10-initialization-final-r5-independent.log` の 41 pass / 1 fail も保持した。この失敗は型拒否自体ではなく、既存 collision probe が求める診断語の欠落であった。最後の変更はエラーへの `(control name collision)` の付加だけ。元の probe は変更せず、r6 で成功した。失敗ログを成功ログへ上書きしていない。

## Findings resolved

| Finding | Final verification |
| --- | --- |
| HI-01 / P2: invalid UTF-8 accepted | Fatal UTF-8 decode rejects isolated continuation / truncated multibyte sequences before quarantine or validate. Valid Unicode / BOM and exact byte limit remain accepted. |
| HI-02 / P2: validated root replaced | Exact bigint device/inode strings plus package / root-control byte hashes bind initial inspection, validation input and output. Different root with identical bytes is rejected. Same-root package / marker / quarantine drift and Bundle restoration are rejected without appliedAt. |
| HI-03 / P2: Windows case alias bypass | Package / 3 root control aliases are rejected with no automatic rename on every OS. Windows DATABRICKS.YML restoration is rejected. Fixture local-state exclusions compare case-insensitively. |
| HI-04 / P2: control directory invisible | Each reserved root control name must be a regular file. Absent→directory and original Bundle directory fail inspection; validate-added directories fail output-reinspection. Unknown output is preserved. |

P1: なし。未解消 P2: なし。上記の閉鎖は実装全体や実配備の無条件な安全保証ではない。

初回 mock marker / quarantine directory 衝突については、`outputInspection.status=failed` と副作用なしを維持しながら、既存の `failureStage=fixture-quarantine` 診断を保持する。初回 Bundle directory は `output-inspection`、validate 後の control directory は `output-reinspection` となることを独立に確認した。通常の cache directories、uppercase ordinary cache、nested packages、同じ root 内の同一 bytes package 再生成は成功する。

## Acceptance criterion coverage

| Criterion | Evidence within the declared local scope |
| --- | --- |
| INIT-01 | Versioned allowlist excludes product config / Bundle / requirements / apps / history / local state / source baseline. Clean and contaminated sources produce identical hash inventories; source sentinels and selected input bytes remain unchanged. Mixed-case excluded names are covered. |
| INIT-02 | Fresh offline setup and independently initialized same-name setup pass. Product config, customized Bundle and installed baseline remain byte-identical. Different-name setup rejects without reset / rename. |
| INIT-03 | Existing / overlapping destinations, missing required inputs, source / destination ancestor links, dangling links and allowlisted-input links reject before destination creation or overwrite. Depth 20 / 20,000 entries / 100 MiB overflow is tested. |
| ROOT-01 | Expected root stays sealed apps/name. Existing / linked output rejects before apply authentication or init. A fake-auth-created output is caught by the second preflight; sentinel is preserved. |
| ROOT-02 | Expected root directory plus regular valid UTF-8 JSON-object package required. Links, hardlinks, unsupported types, control directories and case aliases reject. No quarantine / validate occurs on uninspected unsafe output. |
| ROOT-03 | Missing / nested-only / malformed output rejects with expected-root diagnosis. No guessed-path validation or relocation. Missing root records no fabricated generatedFiles. Legal root plus nested package validates only the expected root. |
| ROOT-04 | Bounded entry / depth / total-size inspection and package / control reads. Exact 1 MiB passes and +1 byte rejects. Identity / byte / control continuity binds validation. Init failure, validation failure, mock collisions and concurrent apply locks retain distinct behavior. |
| Distribution | New helper / tests are owned files; runtime and manifest are in owned directories. Ownership completeness and local release/update tests pass; new dependencies resolve in setup regression. |

## Reproduction

Run at repository root. These commands produced separate r6 logs; keep historical logs unchanged.

```text
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-final-r6-independent.log work/evidence/2026-09-10-initialization-independent.test.mjs work/evidence/2026-09-10-initialization-rereview.test.mjs work/evidence/2026-09-10-initialization-final.test.mjs work/evidence/2026-09-10-initialization-controls.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-final-r6-baseline.log tests/initialization.test.mjs tests/scaffold-output.test.mjs tests/harness.test.mjs tests/scaffold-data.test.mjs tests/distribution.test.mjs tests/contracts.test.mjs
```

Main full-regression evidence: `work/evidence/2026-09-10-initialization-full-r6.log`.

## Snapshot and preserved evidence (SHA-256)

This table was populated directly from Get-FileHash results. Previous failure logs and reports remain immutable.

| Path | SHA-256 |
| --- | --- |
| tools/lib/scaffold-output.mjs | 9e4d137fe4653e103d4741f85fd7f0df5f81681ecbcb3a32513e2eea80212363 |
| tools/lib/scaffold.mjs | bdca8f564bf59c4efa047c75e580fb1df587933db6d44ee2d5b223223394c021 |
| tests/helpers/initialization.mjs | ed3cbc167863864b993d680126e96c9d8a37fb093c09b41718e4b787fd81cd86 |
| harness/fixtures/initialization/manifest.json | 3538de2abc6e074493ce24c7e55269731cdcaf7d856979678fec3bb8f589b312 |
| tests/scaffold-output.test.mjs | 64ef60287639cc8d8d2753ed97969d5187b9827f1a96240bdc31cff0dd73c9f0 |
| tests/scaffold-data.test.mjs | 94f0b9eb6c843933d3172f30e6f986af4694c8056a2e7e52e8e890388ba2aabd |
| tests/initialization.test.mjs | c693d419ccd5dc48f251c1b5567d75ee56eeebe7f556a1e60c9ce24dbca3b933 |
| tests/harness.test.mjs | e5a538cc611b55f2a976f5b0f0f927c2a81f2ee53f54cb6a75b247764f25cce3 |
| tests/contracts.test.mjs | 4989e13825c7875a1e5ef2cc10b2230ed1894805bdc3366a6e27c7da7a2ebadf |
| tests/distribution.test.mjs | 99f8b7d5daab50534206747f5837c4111fb295ca9d8273c47c7e4f796997bb0f |
| tools/lib/distribution.mjs | d9cc170e318c113625f83f4dcde632c2fcd2ebf0a306e22a797874dc0c5be799 |
| docs/harness/design/INITIALIZATION_REPRODUCIBILITY.md | 0328a0b2071bb114613a6be3c43041b8124a60849d93bb356092c1f6f3d6db12 |
| work/evidence/2026-09-10-initialization-independent.test.mjs | 9b16c1f2f0fb1a171bf18936770ca95b02a5bb1fbb963e0b8316958ccda559ab |
| work/evidence/2026-09-10-initialization-rereview.test.mjs | 3049dc0c773303c21350502c2d737acd86540602f2bbc722cc8fda6d06100a32 |
| work/evidence/2026-09-10-initialization-final.test.mjs | 71b8f98a91a04ba600e3342bd690f8bfc86bc90ecfebcf107c51a5a83e824137 |
| work/evidence/2026-09-10-initialization-controls.test.mjs | 0781eb3d983b6d65768382c16dd6fc05c35d141d0656d1cb44754d189626a79f |
| work/evidence/2026-09-10-initialization-final-r6-independent.log | 4e8b9ab8a9c3b1e59209b4f914b7d3a378ee8d4a0abbc24e1800293dc237681e |
| work/evidence/2026-09-10-initialization-final-r6-baseline.log | c2881cb6f759b8d3eec5913303b542e6c84add3f00fdbe680abc063539eec40c |
| work/evidence/2026-09-10-initialization-final-r5-independent.log | 3cabd55487dcf4bd307fca619c003620842dceede87a7d018b4cb83c24720303 |
| work/evidence/2026-09-10-initialization-final-r5-baseline.log | 257dc906e7f0badaa9cf00733b73d484b422050782c63ac8840237fd482ea669 |
| work/evidence/2026-09-10-initialization-independent.log | 1317e10632a9a10861b2e23c46ce7e7a4f61abf4a9fff0b4f6a776efa0e12634 |
| work/evidence/2026-09-10-initialization-rereview.log | 9b3e0d98e5083db374efa2fc3dcd5e0510086e05578c263c68e42572c10c2309 |
| work/evidence/2026-09-10-initialization-final.log | d0fead444d5ddbc3d04ba7a07c4fa4338d5881255b521bdea7758d35ab437e00 |
| work/reviews/2026-09-10-initialization-review.md | f3afff93033a6ef771b7c5c747f3d14a548ee7463da3c0fbf52dd142307c4d0c |
| work/reviews/2026-09-10-initialization-rereview.md | ea610f96ecf4c123f8d11de7c7ff5dafed7677b829ab9fc3b48c410530007c5a |
| work/reviews/2026-09-10-initialization-alias-review.md | 83a04ba3a5186cbc243d246247c490c523cbdf070d928bc30901d89f71a81ae8 |

## Initial report erratum

初回 `2026-09-10-initialization-review.md` の `tests/harness.test.mjs` hash 行だけに 2 文字の転記欠落があり、62 桁になっていた。正値は **e5a538cc611b55f2a976f5b0f0f927c2a81f2ee53f54cb6a75b247764f25cce3**。当初の tool 出力と今回の実ファイルで一致し、r2 以降の表も正値である。初回 report の bytes は変更せず、この erratum で補正する。対象変更や結果の再解釈ではない。

## Claim boundary and handoff

- 合格主張は、この版のローカル初期化 fixture と fake AppKit 出力検査に限る。real Claude Code / Copilot sessions、pinned Databricks CLI output compatibility、実 workspace、データ・権限・配備、application quality は未検証。
- post-validate inspection は node_modules 等を含む全生成 subtree に適用される。実 CLI が大量の依存物やリンクを生成すると上限・link 拒否で停止し得る。これは fail-closed 制約であり、今回回避を追加せず HARD-06 の実 CLI / AppKit 適合で検証する。
- local path checks は concurrent hostile OS process に対する sandbox ではない。snapshot は root / package / named controls を束縛するもので、通常 cache も含む全生成物の不変保証ではない。
- 最終候補への変更があれば、この hash 固定結果を流用せず必要な再検証を行う。HARD-08 の正式採用は人の gate に残る。完了 receipt は発行していない。

