# HIMP-01 独立実装再レビュー（IR-01〜IR-03）

日付: 2026-09-10 / reviewer: acceptance_contract_review（実装担当と別のsubagent）

**限定した再レビュー範囲に未解消の阻害指摘なし。IR-01〜IR-03は解消を確認した。** 独立v2試験は28成功・0失敗・0skip。これは下記snapshotと確認項目に対する結果であり、HIMP-01の正式accepted化、人のverifier昇格判断、8改善全体やrelease全体の合格、世界最高の達成を表すものではない。

対象: [HIMP-01要件](../../docs/harness/requirements/retrospective-hardening.md)、[設計セクション1](../../docs/harness/design/RETROSPECTIVE_HARDENING.md)、[受入記法契約](../../docs/harness/operations/ACCEPTANCE_CONTRACT.md)、acceptance/evidence/approval/intakeの候補と `tests/acceptance.test.mjs`。レビュー開始・終了で対象8ファイルのhashが一致した。前回の [実装レビュー](2026-09-10-acceptance-implementation-review.md)、元試験・元logは保存している。

## 指摘の再確認

| 指摘 | 修正の確認と独立試験 | 判定 |
| --- | --- | --- |
| IR-01: 未対応見出し・Unicode bulletの条件脱落 | 見出しも共通candidateを通し、検知時に非対応bullet・不可視format文字・装飾prefixを扱う。元のH-D01見出し、装飾AC-D01見出し、Unicode bulletの3反例をすべて拒否し、fixture sessionはactiveのまま。Q見出し例外は所定台帳・深さ・形式に限定されることも確認。 | 解消 |
| IR-02: 検証後に変わった本文・参照先を承認 | 解析済み要件bytesのhashを保存し、session lock内で参照と現在hashを再照合。元の2競合注入はいずれも `Approval requirement changed after validation` で拒否。新approvalはなく、sessionの承認状態とbytesは不変。 | 解消 |
| IR-03: hash照合と解析で別の本文を読む | `validateReceipt` はhashが一致した要件bytesを保存し、その同じbytesからstatus/ACを解析。元の不完全receiptをMissing AC-D01で拒否。実読取は1回、sessionはactiveかつbytes不変。初回読取前に本文が変わる反例もartifact changedで拒否。 | 解消 |

sealもreview/要件の解析済みbytesをhash対象として使い、保存前に再照合する。独立した2つの競合試験で、解析後に要件またはreviewを変更すると `Evidence input changed after validation` で拒否し、既存出力とsessionのbytesが不変であることを確認した。変更のない正常seal/validateReceiptは成功し、review/要件hashと実bytesの一致、AC-01/AC-D01の保持を確認した。

## 試験の維持と追加

証拠: [probes-v2.test.mjs](../evidence/acceptance-independent/probes-v2.test.mjs)、[probes-v2.log](../evidence/acceptance-independent/probes-v2.log)。前回の23試験のうち、最初の22試験とhelperは内容を変更せず維持した（改行正規化後のprefix一致を確認）。

23番目のIR-03試験だけは、「要件の2回目readへ必ず到達する」という旧実装に固有のassertionを変更した。今回の修正はその2回目readをなくすため、必須条件は「実際に1回以上要件を読み、不完全AC-D01 receiptを拒否し、sessionが不変」である。2回目readでの変更注入自体は残し、拒否理由をMissing AC-D01またはartifact changedに限定し、さらにsessionのbytes不変をassertした。

今回の観測値:

```json
{
  "rejected": true,
  "currentHashMatches": true,
  "fixtureSessionStatus": "active",
  "requirementReads": 1,
  "secondReadMutationReached": false
}
```

これを「競合を発生させたうえで検知した」とは表現しない。旧来の危険な2回目readが起きず、hash照合した2条件の本文を使って不足を拒否した証拠である。別に初回read前の実ファイル変更も注入し、artifact changedで拒否されることを確認した。

元23試験に追加した5試験は、seal中の要件変更、seal中のreview変更、receipt初回read前の要件変更、正常seal/validateReceipt、生成Q見出し例外の範囲・深さ・形式と不可視prefix。前回の通常の不完全receipt拒否、session/task/loopの状態不変、intake最終再構成前の全artifact不変も再成功した。

実行コマンド:

```text
node --test --test-reporter=spec --test-reporter-destination=work/evidence/acceptance-independent/probes-v2.log work/evidence/acceptance-independent/probes-v2.test.mjs
```

環境: Windows / Node.js v24.15.0。独立実行は28成功・0失敗・0skip、Node runnerの所要時間約0.85秒。temp fixtureを使い、loopのGit/provider/checkはallowlist確認付きfake関数のみ。read境界の競合注入は元のreadFileの返却値を偽造せず、fixture実ファイルを書き替えてから本来の読取を続ける方式。元関数をfinallyで復元し、temp fixtureは安全な範囲確認後に削除した。

親の [r2全回帰log](../evidence/2026-09-10-hardening-full-r2.log) は396件中395成功・0失敗・1skipと読み取り確認した。本レビューが全回帰を独立再実行した結果ではない。親のharness:check成功、実案件read-only解析、関連169試験成功は [親の証拠](../evidence/2026-09-10-acceptance-hardening.md) の結果として区別する。

## 残余限界と扱い

- 今回は既知のIR-01〜IR-03、元23試験、修正に直接関係する5試験に限定した。CommonMark全体、すべての自然言語的な条件表現、未知の構文の完全な検出を保証しない。
- hashと再照合はローカル読取時点の整合性を検証する。複数ファイルのdatabase transaction、全書込が終わるまでの全writer排除、同一OS権限を持つ敵対的writerへの完全防御は検証・保証していない。
- 実Databricks、実Claude Code/Copilot/model、実UI/browser、案件への移植、production、release、外部認証は未検証。親のWindows全回帰1skipを成功に含めない。
- 本レビューでは実装・既存レビュー・元log・実要件のaccepted状態・正式approval/receipt・実task/sessionを変更していない。新たな永続ファイルは本報告とv2試験・logのみ。正常系のfixture receiptはtemp内だけで生成し、fixture sessionを完了へ変更しない。
- 要件・verifierの最終昇格には、既に記録された人の判断が残る。本報告自体を正式な受入receiptとして使わない。

## 対象snapshot（SHA-256）

以下8ファイルは開始・終了で一致。

| 対象 | SHA-256 |
| --- | --- |
| docs/harness/requirements/retrospective-hardening.md | 8C32ADD25200E9F5D58F15C0540158DDD5DBD1F87F8A84093E71AC5C64E731C0 |
| docs/harness/design/RETROSPECTIVE_HARDENING.md | 1C47FDABE27E989C286551961E0A122BA3A93FE6ADB0BDE7AFE4FD80DB95EA1A |
| docs/harness/operations/ACCEPTANCE_CONTRACT.md | 70927BF744944FB0CFDD144B48664E38FB6325C3662A342B28E10BB3A3E471C6 |
| tools/lib/acceptance.mjs | A4785EF8688781D3BE53724F301D20E6B051D778B9F947F23102431DC2C4B8F0 |
| tools/lib/evidence.mjs | 10D68BE98AC11C0C17921573D9F02FF23843F0B8B236A851FC9BB8C03D850E7D |
| tools/lib/intake.mjs | B18E116AD6541034E0EE3B554CF795BF260DEFAA9AE492D7D6CD9C33ED2BFB63 |
| tools/lib/approval.mjs | BF59255BD69EE57B24C18E1F9BDD7D44930CF81E0DFD36D43EC59C63F6355471 |
| tests/acceptance.test.mjs | 871176E7DB53B007CF7E165C889507503C8C7D58D03081A5A005131764D7F96B |

独立証拠:

| 証拠 | SHA-256 |
| --- | --- |
| 元probes.test.mjs（変更なし） | 2F338D0760616AF83CF0819B9684BFCFEAAF8DCB8881210F0E1ED2F65FAFF2E0 |
| 元probes.log（変更なし） | E5A82AD7A74A262423114CB56572CECEF6442A0E97E3DA544D6DE85D30C6F7FC |
| probes-v2.test.mjs | 4779C60BD3A81FD8390B165A48F69625F13482C73F89FE4B62532D71ACD074BB |
| probes-v2.log | A2E6BFF62791213458B367BA4EFC6CA18534BA9D3A49E8BC11A4116E9D186BF6 |

引継ぎ: IR-01〜IR-03の限定再レビューは完了。修正snapshotの証拠として親のsessionへ反映できる。後続の対象変更はこのhashから差分を確認し、必要な再検証を行う。正式昇格の人の判断と残り改善の進捗は別に保持する。
