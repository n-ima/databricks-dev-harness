# HARD-08 independent implementation review — initial candidate

Date: 2026-09-10 (JST)
Reviewer: independent `deployment_contract_review` agent
Environment: Windows / Node.js v24.15.0
Decision: **P2 findings HI-01 and HI-02 remain; not ready for adoption.**
This report is an initial-candidate record, not a completion receipt or human adoption.

## Scope and method

`review-work` に従い、`INITIALIZATION_REPRODUCIBILITY.md` の INIT-01〜03 / ROOT-01〜04 を、retrospective validation の HIMP-08、実装、試験、red/green 記録と照合した。検証対象は Windows / Node.js のローカル fixture と injected CLI fake のみ。実 Databricks CLI、認証、ネットワーク、provider、案件 repository、配備は使用していない。対象実装、要件、承認、既存レビュー記録を変更していない。

独立コード・ログ:

- `work/evidence/2026-09-10-initialization-independent.test.mjs`
- `work/evidence/2026-09-10-initialization-independent.log`
- `work/evidence/2026-09-10-initialization-independent-baseline.log`

## Reproducible findings

### HI-01 — P2: 不正 UTF-8 の package が検査済みになる

- 対象: 初回 `tools/lib/scaffold-output.mjs:75`。`Buffer.toString("utf8")` は不正バイトを置換し、その結果を JSON.parse している。
- 負例: fake init が package.json に `Buffer.concat([Buffer.from('{"name":"'), Buffer.from([0x80]), Buffer.from('"}')])` を保存する。これは不正 UTF-8 だが、検査は置換後の JSON object を受け入れる。
- 観測: independent test `HI-01` は `Missing expected rejection`。apply は `applied` を返し、検査を通過して quarantine と fake validate まで進む。
- 契約差分: ROOT-02 の「valid JSON-object package.json」を満たさない入力を、構造上有効と記録する。未知の内容を検査後の副作用へ進めている。
- 採用条件: 不正 UTF-8 を fail-closed で拒否し、`failureStage=output-inspection` として記録する。init が生成した bytes / 元 Bundle を保存し、quarantine / validate を実行しない。合法 UTF-8 と 1 MiB 境界の正例は維持する。

### HI-02 — P2: validate 中に root が差し替わると未検証 root を applied にできる

- 対象: 初回 `tools/lib/scaffold.mjs:984`〜985、および `tools/lib/scaffold-output.mjs:85`。1 回の検査内では root identity を比べるが、検査間の identity は束縛していない。
- 負例: fake validate が、検査済み・quarantine 済みの `apps/independent` を sibling `validated-root-preserved` へ rename し、同じ expected path に新規 directory、別の有効 package.json、未 quarantine の databricks.yml を作って success を返す。移動はこのローカル負例だけで行い、製品側に自動復旧を要求しない。
- 観測: independent test `HI-02` は `Missing expected rejection`。初回 root と新 root は異なる directory object だが、再検査は新 root の構造だけを検証し apply は `applied` を返す。元の fixture marker / quarantine は旧 root にあり、現在の root は未 quarantine のまま。
- 契約差分: ROOT-04 の再検査結果と実際に検査・validate した root が相関しない。mock quarantine の既存保証も現在の expected root に残らない。これは外部の並行 hostile OS writer の仮定ではなく、注入した validate の明示的なローカル副作用で再現する。
- 採用条件: 初回検査、validate 直前、validate 後の expected root と必要な package / mock quarantine の不変条件を照合し、差し替えを `output-reinspection` などの明示的な段階で拒否する。`appliedAt` を付けず、未知の root は保存する。正当な同一 root 内の cache 追加・nested package を無差別に拒否する必要はない。

P1 finding: なし。実配備未実装や real CLI 未試験そのものを今回の阻害条件としていない。

## Commands and observed results

Repository root で実行:

```text
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-independent-baseline.log tests/initialization.test.mjs tests/scaffold-output.test.mjs tests/harness.test.mjs tests/scaffold-data.test.mjs tests/distribution.test.mjs
```

78 tests / 77 pass / 0 fail / 1 existing link-permission skip。

```text
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-independent.log work/evidence/2026-09-10-initialization-independent.test.mjs
```

13 tests / 11 pass / 2 fail / 0 skip。失敗は HI-01 と HI-02 のみ。

最小再現（ログは上書きしない）:

```text
node --test --test-name-pattern ^HI- work/evidence/2026-09-10-initialization-independent.test.mjs
```

確認済みの正例・拒否条件:

| Contract | Evidence |
| --- | --- |
| INIT-01 | 既存 canonical の initialized-source sentinel / source hash 不変試験、および独立の nested `.env.local` / node_modules / `.local.` / product / history 汚染除外。clean と dirty source の payload を完全一致で比較。 |
| INIT-02 | fresh setup と独立 initialized fixture の same-name 維持 / different-name 拒否を canonical end-to-end で再実行。product config / custom Bundle / installed baseline の bytes を保持。 |
| INIT-03 | 既存 destination、source / destination ancestor junction、dangling output、allowlisted-input link、overlap の拒否を再実行。独立試験で mandatory input 欠落と depth / 100 MiB / 20,000 entry 超過が destination 作成前に停止することを確認。 |
| ROOT-01 | existing / linked 出力の auth 前拒否を再実行。独立試験で apply auth 中に生成された既存出力を 2 回目の preflight が init 前に拒否し、sentinel を保持。 |
| ROOT-02 / ROOT-03 | missing / nested-only / non-object / linked / hard-linked 出力で validate / quarantine を拒否する既存試験を再実行。独立 hard-linked Bundle は元ファイルを保持。HI-01 は未解消。 |
| ROOT-04 | depth / entry / total bytes の既存境界を再実行。独立 1 MiB exact pass / +1 byte reject、marker-directory collision 保持、validate 後 linked-root 拒否、合法 same-root cache 追加と nested package の exact expected-path validate を確認。HI-02 は未解消。 |
| Distribution | 新 test / helper の owned files、runtime / manifest の owned directories を読んで依存を照合し、distribution tests を再実行。親による所有完備性リスト追記は初回実行後であり、その追加 assertion の実行結果を本初回ログに帰属させない。 |

## Initial-candidate SHA-256 snapshot

下記はレビュー開始時の対象。以後の修正版に初回結果を流用しない。

| Path | SHA-256 |
| --- | --- |
| tools/lib/scaffold-output.mjs | c79e8d84c418330ed2dc7aa0005f7d0760d0f34fc09422695c56ad844cbe5045 |
| tools/lib/scaffold.mjs | 4673e0dc46c9faaaa21b1b1f3f1b6f49efa0c4d7f36d05d9440e0edba3a05133 |
| tests/helpers/initialization.mjs | a27aacc31cf0575025d7e63af92cbde17c9c022829ee4afd624db6e782e6d75b |
| harness/fixtures/initialization/manifest.json | 3538de2abc6e074493ce24c7e55269731cdcaf7d856979678fec3bb8f589b312 |
| tests/initialization.test.mjs | f632b560fbee9c5d64ddc2a06514bf5c352a620b87fc138813e251b74fe12f44 |
| tests/scaffold-output.test.mjs | 49a197c9ac3e31b0d28f26a4f87ecb6caf3f06d17d6777759f2c1d06b78a21dd |
| tests/harness.test.mjs | e5a538cc611b55f2a976f5b0f927c2a81f2ee53f54cb6a75b247764f25cce3 |
| tests/scaffold-data.test.mjs | f2379c2f19a3cab76ee6d3d24bedc7d4a723b3f961097f77a635489b662189be |
| tools/lib/distribution.mjs | d9cc170e318c113625f83f4dcde632c2fcd2ebf0a306e22a797874dc0c5be799 |
| docs/harness/design/INITIALIZATION_REPRODUCIBILITY.md | dfb6e456ff9d47e1f6e2b4500d4c105cdca35bfeffc38345fd34d6337dc3ccf9 |
| work/evidence/2026-09-10-initialization-independent.test.mjs | 9b16c1f2f0fb1a171bf18936770ca95b02a5bb1fbb963e0b8316958ccda559ab |
| work/evidence/2026-09-10-initialization-independent.log | 1317e10632a9a10861b2e23c46ce7e7a4f61abf4a9fff0b4f6a776efa0e12634 |
| work/evidence/2026-09-10-initialization-independent-baseline.log | 16697747d885d2ccceebf36c25b0fe4c14a3837e9f908a28eada7a8da8240645 |

## Handoff

親へ 2 件の最小再現と上記結果を共有済み。修正版は別ログ・別レビューで確認し、この初回 test / log / report を保存する。全回帰・人間による正式採用は主担当の記録と gate に従う。real provider / pinned CLI compatibility、実 workspace、OS hostile concurrency、application quality / data safety はこのレビューの合格主張に含めない。
