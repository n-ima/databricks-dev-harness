# HARD-03 scoped approval — 独立実装レビュー（初回 snapshot）

日付: 2026-09-10 / reviewer: independent agent `acceptance_contract_review`。

判定: **限定契約に要修正あり。正式採用の阻害指摘 SIR-01（P2）1件、独立試験 24件中22成功・2失敗。**
これはローカル台帳・照合候補のレビューであり、HIMP-03全体、live配備統合、全8改善項目、リリース全体の合格ではない。
accepted化・完了receipt・実task完了・既存レビューhashの付替えは行っていない。

## 対象と方法

HIMP-03と `docs/harness/design/SCOPED_APPROVALS.md` のSCOPE-01〜08に対して、
`recordScope` / `checkScope` / `revokeScope` / `scopeCommand`、公開CLI dispatchとhelp、
配布所有一覧への専用test追加、操作案内を確認した。旧approval/loopを比較対象として読んだ。

`orchestrate-work` / `improve-harness` / `review-work` を適用し、親session
`20260909-214048-619-retrospective-hardening` とルータ、改善手順、品質・セキュリティ標準を確認した。
独立検証器の役割として実装/canonical testsは変更せず、新規試験・log・この報告だけを保存した。

Windows / Node v24.15.0。独立fixtureはOS一時ディレクトリの `scope-independent-*` に限定し、
合成値とコピーしたローカルtoolsで構成。片付けは親ディレクトリとprefixを検証して限定した。
DB、network、実provider、Git、外部費用、案件repo、pushは一切呼ばない。
公開CLIはfixtureに対するread-only checkと不正flag拒否を実行。record/revokeはfixture内APIを実行した。
競合試験は `fs.promises.open` で実読取到達を数え、実ファイル変更後に元のopen/readを実行する。
偽bytesを返すmockではなく、試験ごとにフックを復旧し、所定読取到達もassertした。

独立試験:

```text
node --test --test-reporter=spec --test-reporter-destination=work/evidence/2026-09-10-scoped-approval-independent.log work/evidence/2026-09-10-scoped-approval-independent.test.mjs
```

logの未存在を検査してから初回作成し、上書きしていない。reporter結果は24 tests / 22 pass / 2 fail。
取得用PowerShell wrapperは後続 `Get-Content` によりexit 0を返したため、そのwrapper exitは合格根拠に用いない。
失敗内容と件数は保存済みNode test reporterに基づく。

## SIR-01 — P2: 最終時刻で発行時刻の下限を再確認しない

対象: `tools/lib/scoped-approval.mjs:183` および `tools/lib/scoped-approval.mjs:214`。

契約は `issuedAt <= now < expiresAt` を要求する。初回時刻の下限は検査されるが、I/O後の最終時刻は
`now >= expiresAt` の上限のみ検査する。このため時計が巻き戻った場合に契約を満たさない成功が返る。

再現:

1. `T0 = 2026-09-10T10:00:00.000Z`、expiryはT0+1時間。通常fixtureでissuedAt=T0の原本を作る。
2. I23ではcheckScopeの時計を順に `[T0+1ms, T0-1ms]` とする。初回は有効だが最終時点は発行前。
   実結果は `eligibleForReuse: true`、期待はfalse。実fixture全体のファイルbytes/構成不変は確認済み。
3. I24ではrecordScopeの時計を順に `[T0, T0-1ms]` とする。保存前の時刻が発行時刻より前でも
   rejectせず成功する。保存前拒否を期待したassertionが `Missing expected rejection` で失敗した。

通常の時計補正・巻戻りを決定的に再現するtest-only依存であり、public CLIへの `--now` 追加は要求しない。
本機能は常に `executionAuthorized: false` のため、これ自体が実配備や旧gate解除を行うものではない。
しかし現在有効な承認範囲の再利用を誤表示し、発行時刻が保存時刻より未来の記録も成功扱いにするため、
明示された時刻契約を満たすには修正が必要。

受入条件: record/checkの最終時刻を一度取得して下限・上限をともに検査し、発行前への巻戻りをfail-closedにする。
I23/I24を弱めず通過させ、I16/I22の等号失効・通常進行も維持する。新しい独立再検証logとsnapshotで確認し、
この初回失敗log・報告・対象hashを保存する。

## 通過範囲と受入対応

| 契約 | 独立観測 |
| --- | --- |
| SCOPE-01 案件・文書・controlの束縛 | I03/I04: 同bytesでも要件pointer変更を拒否、非accepted/ACなし拒否、control drift拒否。設計proposedの正例成立 |
| SCOPE-02 厳密型・期限 | I11/I12/I14/I15: JSON重複・Unicode不可視/孤立surrogate・wildcard・上限・path・raw flag拒否。I16/I22通常期限境界成功。I23/I24はSIR-01 |
| SCOPE-03 別session引継ぎ | I01/I03: active利用先、元completed/blocked/supersededと進捗変更でも正例成立。元ID/参照不一致は拒否 |
| SCOPE-04 不一致・失効・破損・撤回 | I02/I05: 配列順だけ同一、低費用/部分集合/各対象差分は拒否。I07〜09/I16で撤回/破損/期限を拒否 |
| SCOPE-05 排他的原本・保存前再照合 | I06: 同ID二重writerは成功1/失敗1、原本非上書き。I17/I18: request/source pointer変更でrecord拒否。I21: 原本bytes変化でrevoke拒否 |
| SCOPE-06 入出力境界 | I12〜14: traversal/ADS/reserved paths、hardlink、component junction、出力祖先junction、invalid UTF-8/1MiB超過/空根拠/既知secret拒否 |
| SCOPE-07 出力と権限の分離 | I01: positive CLIでもexecutionAuthorized/identityAuthenticated/candidateVerified/costEnforcedはfalse。未解決gateは別表示 |
| SCOPE-08 legacy拒否・read-only | I01/I05/I07/I08/I10: checkのfixture全bytes/構成不変。新grant/revocationを旧loop gateへ渡して拒否・状態不変。旧shape追加・simulation kindを新checkが拒否 |

さらにI19は利用先と発行元で同じinputを再読取する間の変更、I20は最終snapshot検査中に追加された撤回を拒否した。
空レコード・scope拡大・旧gate解除の反例は、この独立24試験の範囲では通過していない。

## 親の検証との分離

親の `work/evidence/2026-09-10-scoped-approval.md` を読み、専用50 pass、全回帰555件中554 pass/0 fail/1既存skip、
harness:check成功の記録を確認した。これは親の証拠であり、全回帰を独立再実行したとは扱わない。
独立判定は上記24件と静的確認に限る。既存approval/loopのbytesはこの新候補で変更されていない。
dispatcher差分はimport/help/厳密raw dispatch、新しいdistribution差分は専用test所有一覧への1行追加である。
新validatorと案内は既存のtools/docs/harness配布所有範囲に含まれる。

## 対象snapshot SHA-256

以下は2026-09-10の凍結候補で、試験前後に主要5対象の不変を確認した。

| ファイル | SHA-256 |
| --- | --- |
| docs/harness/requirements/retrospective-hardening.md | DE27EDCCFDA277D8D655E67C635E8BBD2BB5CD43994C742FF182400CF20DBF64 |
| docs/harness/design/SCOPED_APPROVALS.md | DE9B53617B1D55D73862C33D356FC38F0E36B14DBFC054F6E1ED335EA8B0B82D |
| docs/harness/operations/SCOPED_APPROVALS.md | 1B3EE904A07844FC95C2D72651C85A73A6F0FF4B3660F0A820C3F81242E762E3 |
| docs/harness/operations/CLI_REFERENCE.md | D56D7B1B152AB662D4718B23181CD784EEEFEACD8A6CCC7AA5271D7DBAFA9CC1 |
| tools/lib/scoped-approval.mjs | FBB524AC31B9A0BEEA7E51F17CAE0DFFD001486952BD16A4C68A4FB87ADD0173 |
| tools/harness.mjs | 066738544D868EB730D252B11C34BCDEBE6A1A4DF88FF07760AE491C85B0BDE0 |
| tools/lib/distribution.mjs | 582DFD9C83012075E730DAD30BD7623470B25B22491E4640733755DF61ACB830 |
| tests/scoped-approval.test.mjs | 41B271A1D4AFE75DBAF437EA8FC11AAE23616887B6AE81D7F9AFE92CD1661057 |
| tools/lib/shared.mjs | D1BA0FC8078775B62FD7DDFE3776E3D36C718B78F31AA410FD9A16B9A0D5B251 |
| tools/lib/acceptance.mjs | A4785EF8688781D3BE53724F301D20E6B051D778B9F947F23102431DC2C4B8F0 |
| harness.config.json | 320885177CF71E65BE7AC2845D5AD392A27FFE84C73BC2B53449020C0CDB48E3 |
| tools/lib/approval.mjs（比較対象） | BF59255BD69EE57B24C18E1F9BDD7D44930CF81E0DFD36D43EC59C63F6355471 |
| tools/lib/loop.mjs（比較対象） | 71EA6817A53FAAD5804605EA46C08D1F7C73CD835A8361C33A9BA88C9148BAD9 |
| work/evidence/2026-09-10-scoped-approval-independent.test.mjs | 54F6640D7B8B53836C2F9865C11BDB321EFB17C2E48402A5114D1558E4404FE8 |
| work/evidence/2026-09-10-scoped-approval-independent.log | 1D3F774474679D3D984317B8130C445F05095C0D9AF9532E190EBE3FBCCD9DF4 |

## 残余制約と引継ぎ

この機能は人の判断を記録し、現在のローカル入力との一致を照合するだけ。本人認証、署名、artifact/build実在確認、
課金予約/上限強制、実環境適合、実provider canary、実案件配布適用、live adapter統合は未検証かつ未実装範囲。
同一config/文書をコピーしたcheckoutの所有者識別や、同一OS権限の敵対writerに対する完全なatomic snapshot/防御も主張しない。
試験で扱った変更検知は具体的なI/O順序に限り、あらゆるOS競合への保証ではない。

次はSIR-01の小さい修正、原試験を変更しない再生、新snapshotの独立再レビュー。
阻害解消後も正式採用は人に残し、今回の限定検証をHIMP-03全体の完了証拠へ拡張しない。
