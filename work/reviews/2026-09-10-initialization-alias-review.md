# HARD-08 independent alias re-review — r3 candidate

Date: 2026-09-10 (JST); environment: Windows / Node.js v24.15.0.
Reviewer: independent `deployment_contract_review` agent.
Decision: **HI-01 / HI-02 / HI-03 resolved; P2 HI-04 remains.**

これは case-alias 修正版の限定再レビュー。正式採用や完了 receipt ではない。初回 / r2 の report、test、log は保持し、reviewer は implementation / canonical tests / design / gate を変更していない。新規検証は temporary local filesystem のみ。再生試験の CLI も injected fake に限定し、実認証、Databricks CLI、network、provider、案件 repo を使用していない。

## Verified

- 初回 / r2 の未変更 independent tests: 26 tests / 26 pass / 0 fail / 0 skip。
- 関連 6 canonical test files: 148 tests / 147 pass / 0 fail / 1 existing link-permission skip。
- 新規 7 probe: 6 pass / 1 fail / 0 skip。失敗は HI-04 のみ。
- HI-03 の `DATABRICKS.YML` は非 canonical 名として拒否される。混合 case の 3 control 名と nested `PACKAGE.JSON` も拒否し、生成物を rename / relocate しない。
- control alias は 1 MiB 超過内容でも case 判定で先に拒否する。一般的な大文字 cache ファイルは合法で、同一 root の継続性検査を通る。
- mixed-case `.ENV` / `Node_Modules` / `.HaRnEsS` / `.GiT` / `.DaTaBrIcKsCfG` / `__PYCACHE__` / `.LOCAL.` / `BASE-RELEASE.JSON` を除外し、clean / contaminated source の fixture hash map が完全一致する。source sentinel は不変。

## HI-04 — P2: control directory の出現が継続性検査に現れない

対象: r3 `tools/lib/scaffold-output.mjs:58`〜61 の directory branch。package.json 以外の directory を通常 subtree として扱うため、3 つの reserved root control 名でも regular-file 契約に入らない。

独立最小再現:

1. expected root と合法 package.json だけを作り `before = inspectAppOutput(...)` を取得。
2. `mkdir(expectedRoot/databricks.yml)` を実行。
3. `after = inspectAppOutput(...)` と `assertOutputContinuity(before, after)` を実行。

期待は configuration path の不正な型 / 出現の拒否だが、両検査とも passed となる。root と package は不変、controlFiles は両方空のため、reserved control の absent→directory 変化を見落とす。`HI-04` は `Missing expected rejection` で再現する。通常 directory の cache 生成と異なり、固定 configuration path の型不整合である。

契約差分は ROOT-04 の root configuration / fixture controls の相関と、ROOT-02 の inspected structure の fail-closed 境界。実配備が通るとまでは主張しないが、固定 control path が不正な状態でも継続性判定が成功する。

採用条件: package と同じく 3 root control 名も存在時には regular file 必須とし、directory / special file を inspection で拒否する。未知の出力は保持し、自動修復しない。通常の cache directories、canonical file、合法 nested packages は維持する。P1 finding はない。

## Evidence and commands

```text
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-final-replay.log work/evidence/2026-09-10-initialization-independent.test.mjs work/evidence/2026-09-10-initialization-rereview.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-final-baseline.log tests/initialization.test.mjs tests/scaffold-output.test.mjs tests/harness.test.mjs tests/scaffold-data.test.mjs tests/distribution.test.mjs tests/contracts.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-final.log work/evidence/2026-09-10-initialization-final.test.mjs
node --test --test-name-pattern ^HI-04 work/evidence/2026-09-10-initialization-final.test.mjs
```

## Reviewed candidate SHA-256

| Path | SHA-256 |
| --- | --- |
| tools/lib/scaffold-output.mjs | 557130d636332e667efcd9750522357c625b66f0fff31fc5f74278a761e43f9b |
| tools/lib/scaffold.mjs | 5795f96fad04fc7f106f1f5d0715e3837fe55930fed280821c502ff5df2db2de |
| tests/helpers/initialization.mjs | ed3cbc167863864b993d680126e96c9d8a37fb093c09b41718e4b787fd81cd86 |
| tests/scaffold-output.test.mjs | 9d58662b6ad02ee70fabcb6f432b4132778b3298f3d0516b41f4959905fcafb9 |
| tests/scaffold-data.test.mjs | d62d6d98d0c41b4deaab6ee351825c301daeab20456ba474b6e6912bbde31e63 |
| tests/initialization.test.mjs | c693d419ccd5dc48f251c1b5567d75ee56eeebe7f556a1e60c9ce24dbca3b933 |
| docs/harness/design/INITIALIZATION_REPRODUCIBILITY.md | 03aa9358d2087c783c8125ac987d11480697bcd79c03b6f097abe57eff8f874c |
| work/evidence/2026-09-10-initialization-final.test.mjs | 71b8f98a91a04ba600e3342bd690f8bfc86bc90ecfebcf107c51a5a83e824137 |
| work/evidence/2026-09-10-initialization-final.log | d0fead444d5ddbc3d04ba7a07c4fa4338d5881255b521bdea7758d35ab437e00 |
| work/evidence/2026-09-10-initialization-final-replay.log | 23310706d914662f46f132b7f1df78aeda09506fc10352eceeb20a1c36fe5865 |
| work/evidence/2026-09-10-initialization-final-baseline.log | 38953d2560ab489d66a2d5f4729082daa7a1d4993a4a96c05d5a82f5f77ee4ee |

## Claim boundary

初回指摘の修正状態と後続版の採用を混同しない。HI-04 は親へ最小再現を共有済み。型境界修正後に、過去 probe を保持して別の final review で確認する。

実 CLI validate が node_modules 等へ大量依存物や link を生成する場合、全生成 tree に対する現在の上限 / link 拒否で停止し得る。これは意図した fail-closed 挙動で、除外・回避を追加せず、HARD-06 の real CLI / AppKit 適合で確認する残課題とする。この slice は real provider / pinned CLI compatibility / 実 workspace / application quality / hostile OS process sandbox を保証しない。
