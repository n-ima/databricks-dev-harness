# HIMP-01 独立実装レビュー

日付: 2026-09-10 / reviewer: acceptance_contract_review（実装担当と別のsubagent）

判定: **changes required — 阻害指摘3件。HIMP-01の完了・verifierの最終昇格は不可。** 独立した23試験は17成功・6失敗。失敗は下記3原因に対応する。正常なAC-D01を含む集合検証とintakeの最終再構成前拒否は改善されたが、未対応記法の条件脱落、承認対象の変化、receiptのhashと解析対象の不一致が残る。

対象は [HIMP-01要件](../../docs/harness/requirements/retrospective-hardening.md)、[設計セクション1](../../docs/harness/design/RETROSPECTIVE_HARDENING.md)、[受入記法契約](../../docs/harness/operations/ACCEPTANCE_CONTRACT.md)、acceptance/evidence/approval/intakeの候補と `tests/acceptance.test.mjs`。レビュー開始・終了時の対象8ファイルhashは一致した。後続変更は本判定の対象外。

本レビューによるrepository書込は本報告と [独立試験](../evidence/acceptance-independent/probes.test.mjs)、[試験log](../evidence/acceptance-independent/probes.log) のみ。実装変更、accepted化、実task/session完了、正式approval/合格receipt作成、案件変更、実Databricks、外部provider、network、commit/pushは行っていない。反例で完了したsessionや承認は、専用の合成temp fixtureだけに作成し、試験終了時に削除した。

## IR-01 / P1 — 未対応の定義候補が脱落し、不完全なreviewでsealと完了が通る

箇所: `tools/lib/acceptance.mjs:73`、同11行の `candidate`。

先頭が `AC` そのものかcolonを含む場合に限定して見出しを拒否しているため、共通candidateが認識できる別prefixや装飾IDの見出しを無視する。またU+2022のbulletは候補判定から脱落する。

再現入力は、それぞれ `- AC-01: visible` の後ろに次の1行を追加したheadingなし要件。

```text
# H-D01 must be verified
# **AC-D01** must be verified
• AC-D01: Unicode bullet requirement
```

3入力すべて、AC-01だけの独立fixture reviewがpassでsealされ、`closeSession` が正常終了してfixture sessionを `completed` にした。失敗logには各々 `rejected:false, fixtureSessionStatus:"completed"` が残る。これは抽出器の戻り値だけの指摘ではなく、実際の完了入口まで通る再現である。

受入条件: 見出しにも同じ候補判定を適用し、H等の対応prefixと装飾されたIDを追加guardで落とさない。定義候補の先頭にある非対応bullet等も、明示拒否する境界を定義して実装する。通常の見出し・本文中参照と識別した上で、3反例はseal前に拒否し、receiptを作成せずsessionはactiveのまま保持する。正式受入セクションの内外でも同じ脱落を許さない。

## IR-02 / P1 — product-intent承認が検証後に変わった要件・参照先を承認する

箇所: `tools/lib/approval.mjs:17`、25–26、30–37行。

要件の本文検証は初回読取のみ。その後、evidenceを読み、要件を別の読取でhashし、最後にsessionをロックする。ロック後の再確認はstatusとgateだけで、初回の `initialSession.requirement` と現在の要件参照の一致、検証した本文と承認hash対象の一致を確認していない。

独立fixtureのevidence読取境界で、次の2つの実ファイル更新をそれぞれ挿入した。

1. 初回検証で正常だった要件を、異なる本文を持つAC-01の重複定義へ変更する。
2. sessionのrequirement参照を、別の重複ID要件へ変更する。statusとgateは維持する。

両方とも `createApproval` は成功し、approvalを作成し、sessionを `gate_status: approved` にした。2ではsessionは変更先要件を指す一方、approvalは変更前の要件をhashしている。logの観測は両方 `rejected:false, approvalExists:true, gate_status:"approved"`。

受入条件: 検証と承認が同じsessionの要件参照と同じ本文bytesを対象にする。検証・hash・commitの間に変化があれば新しい承認を書かず、既存approvalとsessionの承認状態を変更しない。2試験を拒否へ変更し、ロック下の再確認・revision比較等で対象の一致を保証する。共有検証器を追加しただけでは閉じない、既存の読取・commit順序の不足である。

## IR-03 / P1 — receiptのhash照合とAC解析が別の本文を読み、不完全なreceiptで完了できる

箇所: `tools/lib/evidence.mjs:55`、58–61行。

`validateReceipt` はartifactHashesを順に照合した後、要件を再読取して受入IDを解析する。hashが一致した本文とcoverageを検証する本文が同一である保証がない。

再現: accepted要件にはAC-01とAC-D01がある。正しい現在のpolicyHash・要件hash・証拠hashを持つがAC-01しか検証していない、sealを経由しないfixture receiptを用意する。要件のhash照合が終わり、解析用に要件を再読取する境界で、要件をAC-01だけの本文へ変更した。

`closeSession` は正常終了して `completed` になった。この時点で、現要件hashとreceipt中の要件hashは一致しない。logは `rejected:false, currentHashMatches:false, fixtureSessionStatus:"completed", requirementReads:2`。同じ不完全receiptを要件変更なしで使う試験はMissing AC-D01として正常に拒否される。

受入条件: hash検証とstatus/AC/coverage検証に同じ読取bytesを使う。読取後の変化も扱うなら保存直前に照合する等、異なる時点の本文を混ぜた成功を避ける。対象試験はMissing AC-D01またはartifact changedとして拒否し、sessionをactiveのまま保持する。seal側にも同じ「解析対象とhash対象の一致」という観点で確認が必要。これも既存の複数読取に残っていた不足で、今回の共有coverage検証だけでは解消していない。

## 独立試験の方法と確認済み範囲

環境: Windows、Node.js `v24.15.0`。テストは実装候補をimportし、`mkdtemp` で作った `harness-ac-independent-*` 配下だけで実行。cleanup前にはtemp base配下と固有prefixをassertした。loopはallowlistをassertするfake Git/provider/check関数で実行し、実プロセス起動は0回。

IR-02/IR-03では `fs.promises.readFile` の呼出し境界を同一テストプロセスで観測し、`syncBuiltinESMExports` で読取境界を差し込んだ。戻り値や本体の検証結果を偽造していない。指定境界でfixtureファイルへ実際に書き込み、その後に元のreadFileを実行する、再現可能な競合注入である。各試験のfinallyで元関数へ戻した。これは通常の同時編集との時点整合性の検証であり、同一OS権限を持つ敵対的主体の完全統制を要求するものではない。

実行コマンド:

```text
node --test --test-reporter=spec --test-reporter-destination=work/evidence/acceptance-independent/probes.log work/evidence/acceptance-independent/probes.test.mjs
```

| 独立確認 | 結果 |
| --- | --- |
| H-01、AC-D01、AC-DATA-02、checkbox、BOM/CRLF、case違い正式見出し、閉じた例の除外 | 成功 |
| コメントだけの空本文、別受入範囲の重複、範囲外の定義、不整合fence、不正小文字ID、未閉鎖comment | 6試験で正常拒否 |
| 非対応見出し2種・Unicode bulletの定義候補 | 3試験失敗、いずれも不完全reviewでfixture完了を再現（IR-01） |
| ID末尾改行 | 正常拒否 |
| sealを経由しないreceiptの不足・余分・重複・空・不正ID・null結果 | 6試験でvalidateReceiptとsession closeが拒否、session bytes不変 |
| task done + 不完全AC-D01 receipt | Missing AC-D01で拒否、task/session bytes不変 |
| loop achieved + 不完全AC-D01 receipt | Missing AC-D01で拒否、loop/session bytes不変 |
| intakeの最終回答再構成に含まれる追加ID | 拒否。requirement/architecture/plan/session/manifest/既存approvalの全bytes不変 |
| product-intent検証後の本文変更・参照先変更 | 2試験失敗、approval作成とgate承認を再現（IR-02） |
| receiptの要件hash照合後の解析対象変更 | 1試験失敗、hash不一致のままfixture完了を再現（IR-03） |

前回契約指摘F-01/F-02は仕様に反映されたが、IR-01の実装不足がある。F-03のintake最終再構成前検証は独立fixtureで確認できた。既存要件の承認対象一致にはIR-02が残る。

親の [全回帰log](../evidence/2026-09-10-hardening-full.log) は387件中386成功・0失敗・1skipと確認したが、これは親の実行結果であり本レビューの独立試験ではない。全回帰は二重に実行していない。親が報告した実案件のAC-D01〜05読取確認とharness:checkも、独立で再実行していない。本レビューはlive Databricks、実provider、実UI、release全体を検証していない。

## 対象と証拠のSHA-256

以下8ファイルはレビュー開始・終了で一致。

| 対象 | SHA-256 |
| --- | --- |
| docs/harness/requirements/retrospective-hardening.md | 8C32ADD25200E9F5D58F15C0540158DDD5DBD1F87F8A84093E71AC5C64E731C0 |
| docs/harness/design/RETROSPECTIVE_HARDENING.md | 885A17AC2C51AA5CAE24C9FEC56738DBB1ADD5A59C0976FB42B0B38F1E430F09 |
| docs/harness/operations/ACCEPTANCE_CONTRACT.md | 338B2B0025BA813C0E7F8D9D8D7885F3FAD55E6335DE5F22668F9E1D7C514409 |
| tools/lib/acceptance.mjs | F722F574A0BD548C2BDD119C79E6E38C79C6B140DDF7692D5CA6995745F13273 |
| tools/lib/evidence.mjs | 4A60CD8E8ADD14E6D7CAF934268458B2DB3A267C031FA30B7F0A0298429E7975 |
| tools/lib/intake.mjs | B18E116AD6541034E0EE3B554CF795BF260DEFAA9AE492D7D6CD9C33ED2BFB63 |
| tools/lib/approval.mjs | 3F133E94ACD80BC10D883C8CFB643A8C48A91EFB41CC608421A5891E84534E43 |
| tests/acceptance.test.mjs | 61ED2EA52AB338121C87CCE2008F1BABB9B5DB32DC79E48DA7A474D578BBF241 |

完了入口と独立証拠の終了時hash:

| 対象 | SHA-256 |
| --- | --- |
| tools/lib/policy.mjs | 55F1F1B8F609356D1CA5EFFBA417662AD9D7E57CB5B3F882F00B087AE2E12ACA |
| tools/lib/memory.mjs | A12149F1DB2E4442EF12E2778423701B97272A4DC4DAF3BEBCB6163570DB9801 |
| tools/lib/tasks.mjs | 402264587BCA1058E03751FD95A10A53F782DFBB36B0C04FC08B07FDEF6D2B87 |
| tools/lib/loop.mjs | 71EA6817A53FAAD5804605EA46C08D1F7C73CD835A8361C33A9BA88C9148BAD9 |
| work/evidence/acceptance-independent/probes.test.mjs | 2F338D0760616AF83CF0819B9684BFCFEAAF8DCB8881210F0E1ED2F65FAFF2E0 |
| work/evidence/acceptance-independent/probes.log | E5A82AD7A74A262423114CB56572CECEF6442A0E97E3DA544D6DE85D30C6F7FC |

次の担当: IR-01〜IR-03を修正候補に反映し、同じ独立反例を再実行する。修正後の対象hashを固定した再レビューが必要。人の最終判断・正式昇格は未実施。
