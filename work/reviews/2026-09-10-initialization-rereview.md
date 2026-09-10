# HARD-08 independent implementation re-review — r2 candidate

Date: 2026-09-10 (JST)
Reviewer: independent `deployment_contract_review` agent
Environment: Windows / Node.js v24.15.0
Decision: **HI-01 / HI-02 resolved; new P2 HI-03 remains. Not ready for adoption.**

この記録は初回修正版の独立再レビューであり、正式採用・完了 receipt ではない。初回 `2026-09-10-initialization-review.md` と初回 test / log は変更していない。実装、canonical test、設計、承認は reviewer が変更していない。

## Scope and results

`review-work` に従い、更新された INIT-01〜03 / ROOT-01〜04 と対象変更を照合した。全実行は Windows の temporary local fixture / injected CLI fake に限定。実 Databricks CLI、認証、network、provider、案件 repo、配備、公開は未実施。

- 元の独立 13 probe を変更せず再生: **13 pass / 0 fail / 0 skip**。
- 関連 canonical 6 test files の独立再実行: **142 tests / 141 pass / 0 fail / 1 existing link-permission skip**。
- 新規独立 13 probe: **12 pass / 1 fail / 0 skip**。失敗は HI-03 のみ。

HI-01 の不正 UTF-8 は fatal decoder により `output-inspection` で拒否し、quarantine / validate 前に停止する。正常 Unicode、UTF-8 BOM、package exact 1 MiB の正例も通る。

HI-02 の root 差し替えは exact bigint device/inode の相関で拒否する。元の反例に加え、同じ package / control bytes を別 root に複製した反例でも `output-reinspection` で拒否する。初回検査→validate 直前→validate 後の package / control hash を照合し、同一 root での package 内容変更、marker 内容変更 / 削除、quarantine 内容変更、通常綴りの Bundle 復元、marker hard link を拒否した。

正常な同一 root への cache 追加、同一 bytes の package file 再生成、nested package、元 Bundle がない mock は成功する。成果物全体の凍結や自動移動は要求・実装されていない。missing output の generatedFiles は空であり、存在しなかった生成物を成功証拠にしていない。

## New finding

### HI-03 — P2: Windows control-name case alias bypasses continuity

- 対象: r2 `tools/lib/scaffold-output.mjs:60` の `CONTROL_FILES.has(entry.name)`。root control 名の判定が case-sensitive であり、対象外名は内容を hash しない。
- 負例: mock の fake validate 内で `writeFile(join(target, "DATABRICKS.YML"), "bundle:\n  name: unquarantined\n")` を実行して success を返す。元の package / marker / quarantine と root identity は変更しない。
- 観測: 新規独立 test `HI-03` の `assert.rejects(context.apply())` が `Missing expected rejection` で失敗する。apply は成功する。Windows の case-insensitive path ではこの Bundle は `databricks.yml` として到達できるが、control map に追加されず、新しい control の存在を継続性検査が検出しない。
- 契約差分: ROOT-04 の configuration / fixture controls の相関と、mock の未 quarantine Bundle 復元拒否を別の大文字小文字表記で回避する。通常の cache 生成許容とは異なり、固定 control の OS 上の別表記である。
- 採用条件: filesystem の alias を考慮し、少なくとも 3 つの root control 名に対する case alias を reject または canonicalize して同じ境界に含める。package の同種曖昧さと control directory / size 境界も一貫させる。別表記の未 quarantine Bundle 復元は `applied` にせず、生成物を保存して診断付きで停止する。小文字の正常 control と cache の正例は維持する。

P1 finding: なし。初回 P2 2 件の修正結果を新規 P2 と混同しない。

## Reproduction and logs

Repository root で実行。元の test / log は上書きしない。

```text
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-rereview-original.log work/evidence/2026-09-10-initialization-independent.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-rereview-baseline.log tests/initialization.test.mjs tests/scaffold-output.test.mjs tests/harness.test.mjs tests/scaffold-data.test.mjs tests/distribution.test.mjs tests/contracts.test.mjs
node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-10-initialization-rereview.log work/evidence/2026-09-10-initialization-rereview.test.mjs
```

HI-03 の最小再現 (Windows):

```text
node --test --test-name-pattern ^HI-03 work/evidence/2026-09-10-initialization-rereview.test.mjs
```

## r2 candidate snapshot (SHA-256)

| Path | SHA-256 |
| --- | --- |
| tools/lib/scaffold-output.mjs | d975076d7b4c2cda38bd8a92d9eb7496a1203b1b7245b22cb2918efac52e5958 |
| tools/lib/scaffold.mjs | 5795f96fad04fc7f106f1f5d0715e3837fe55930fed280821c502ff5df2db2de |
| tests/scaffold-output.test.mjs | 87099387ea8aff38b2ba06c1f474edbabac33d7acf777e81e51dabf8a7ec60a3 |
| tests/scaffold-data.test.mjs | d1bf3676c8171b947e334cd580676f900840b7f8bbadaf5a2241200676177cc2 |
| tests/helpers/initialization.mjs | a27aacc31cf0575025d7e63af92cbde17c9c022829ee4afd624db6e782e6d75b |
| harness/fixtures/initialization/manifest.json | 3538de2abc6e074493ce24c7e55269731cdcaf7d856979678fec3bb8f589b312 |
| tests/initialization.test.mjs | 630293bd4ef041f153df31f34530f6b1d13b48206adf26afe1c6eb1fb8099e8e |
| tests/harness.test.mjs | e5a538cc611b55f2a976f5b0f0f927c2a81f2ee53f54cb6a75b247764f25cce3 |
| tests/contracts.test.mjs | 4989e13825c7875a1e5ef2cc10b2230ed1894805bdc3366a6e27c7da7a2ebadf |
| tests/distribution.test.mjs | 99f8b7d5daab50534206747f5837c4111fb295ca9d8273c47c7e4f796997bb0f |
| tools/lib/distribution.mjs | d9cc170e318c113625f83f4dcde632c2fcd2ebf0a306e22a797874dc0c5be799 |
| docs/harness/design/INITIALIZATION_REPRODUCIBILITY.md | bf4b9a46a0cb4b037b9bbbbcf3a381b1df33932462710b2cc9071194d0a8937f |
| work/evidence/2026-09-10-initialization-rereview.test.mjs | 3049dc0c773303c21350502c2d737acd86540602f2bbc722cc8fda6d06100a32 |
| work/evidence/2026-09-10-initialization-rereview.log | 9b3e0d98e5083db374efa2fc3dcd5e0510086e05578c263c68e42572c10c2309 |
| work/evidence/2026-09-10-initialization-rereview-original.log | 54c956059beda595d9a9fe0ec25039a76caf63e983b9cc5ef87f9781206ffcc4 |
| work/evidence/2026-09-10-initialization-rereview-baseline.log | 2168ba0d2e68796526698991365c7f531208282ded03b49881a21e1534d62d4b |

## Remaining scope and handoff

INIT の fixture 汚染除外 / existing refusal / mandatory input / bounds、setup の same-name / rename refusal、distribution の新規 helper / tests / runtime / manifest 所有指定は関連試験で成功を再確認した。root control の case alias 修正後に HI-03 と正常小文字・cache 境界を再検証する。親へ新規反例の最小再現と snapshot は共有済み。

本レビューは実 CLI 版別互換、real provider、実 workspace、application quality / safety、hostile OS concurrency の保証ではない。その未実装・未試験を限定 slice 自体の追加 blocker にしていない。最終 full regression と human adoption は親の durable records / gate に従い、今回の r2 証拠を後続版に流用しない。
