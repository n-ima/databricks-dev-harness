# HARD-03 scoped approval — 独立再レビュー

日付: 2026-09-10 / reviewer: independent agent `acceptance_contract_review`。

判定: **SIR-01解消。ローカル限定契約SCOPE-01〜08の今回の確認範囲に未解消の阻害指摘なし。**
独立実行は原24試験＋追加8試験の32 pass / 0 fail / 0 skip、Node exit 0。
正式採用は人に残す。HIMP-03全体、実配備統合、全8改善項目、リリース全体の合格ではない。
accepted化、receipt発行、実task完了、実案件変更、pushは行っていない。

## 修正と再レビュー範囲

初回報告 `work/reviews/2026-09-10-scoped-approval-review.md` のSIR-01を対象とする。
親は `tools/lib/scoped-approval.mjs` に `validAt(issued, expires, current)` を追加し、
record保存前とcheck初回/終了時に `issued <= current < expires` を検査した。
各checkpointの時刻は一度だけ取得され、public clock flagは追加されていない。

対象行: `tools/lib/scoped-approval.mjs:33`、`:187`、`:201`、`:217`。
canonical testsには元の反例と対応する巻戻り2件が追加されている。
この再レビューでは実装とcanonical testsを編集せず、元の独立24試験も変更せず実行した。
初回失敗logと初回報告はhash一致を確認し、失敗証拠の付替えを行っていない。

`orchestrate-work` / `review-work` / `improve-harness` に従ってcontext・関連session・改善手順を確認し、
独立した反例の保持、境界再試験、人による正式採用の分離を行った。
親のdurable sessionは `20260909-214048-619-retrospective-hardening`。別作業は再開していない。

## 独立実行

Windows / Node v24.15.0、合成ローカルfixtureのみ。実provider、DB、network、Git、実環境費用なし。
OS一時ディレクトリの明示prefix配下を用い、親ディレクトリ/prefix確認後にfixtureだけ片付けた。
実repoへの書込は新規追加probe・新規独立log・この報告に限定した。

```text
node --test --test-concurrency=1 --test-reporter=spec --test-reporter-destination=work/evidence/2026-09-10-scoped-approval-rereview-independent.log work/evidence/2026-09-10-scoped-approval-independent.test.mjs work/evidence/2026-09-10-scoped-approval-rereview.test.mjs
```

logの未存在確認後に新規作成。結果32 tests / 32 pass / 0 fail / 0 skip、約6.1秒。
PowerShell wrapperはNode終了コードを保存し、log表示後に同じコードで終了した。wrapperもexit 0。

| 再試験 | 観測 |
| --- | --- |
| 原I23/I24（変更なし） | 発行前への時計巻戻りでcheckは拒否、recordは保存前拒否。初回2失敗がともに成功 |
| R01/R03 | 発行時刻の等号は許可、1ms前はnot-yet-valid。record失敗後にgrant/lockなし、session/根拠不変。checkの原本/sessionも不変 |
| R02/R03 | expiryの1ms前は有効、等号はexpired。record拒否時にgrant/lockなし。checkpointごとのclock読取回数は想定どおり |
| R04 | 終了時clockがNaN/Infinity/負値/非整数/unsafe integerならrecordもcheckもinvalid-clockで拒否 |
| R05 | 発行からちょうど30日は許可、30日＋1msは拒否。30日の終端等号は失効 |
| R06 | 実fixtureへの部分write後にEIOを注入。部分原本は保存されたまま、retryはalready-recordedで非上書き、checkは拒否 |
| R07 | raw `scopeCommand` のrecord/check/revoke正常経路をfixtureで確認。scope一致でも未解決gateはそのまま、撤回後は拒否 |
| R08 | 撤回済み原本は通常時刻・発行前・期限切れでいずれも再利用不可 |
| 原I01/I15 | コピーしたtoolsの公開CLI positive checkと不正raw flag拒否を再実行。read-onlyとexecutionAuthorized:falseを維持 |

SIR-01は修正済みsnapshotに対して解消と判断する。新しい阻害指摘は今回の32試験では再現していない。

## SCOPE-01〜08の限定判定

| 契約 | 対応する独立証拠と限定判定 |
| --- | --- |
| SCOPE-01 案件・文書・controlの束縛 | I03/I04: 元session ID/要件pointer変更、nonaccepted/ACなし、control driftを拒否。設計proposedは正例成立。確認範囲に阻害なし |
| SCOPE-02 型・日時・有効範囲 | I11〜16/I22〜24/R01〜05: 重複JSON・文字列・上限・flag・実在日時・上下限を検査。SIR-01解消 |
| SCOPE-03 同範囲の引継ぎ | I01/I03: 元completed/blocked/supersededから別active sessionへ引継ぎ、進捗差は許可。元ID/対象不一致を拒否。確認範囲に阻害なし |
| SCOPE-04 不一致・失効・破損・撤回 | I02/I05/I07〜09/I16/R03/R08: 配列順のみ許可、縮小を含む各scope変更、改変、期限、撤回を拒否。確認範囲に阻害なし |
| SCOPE-05 排他・原本保存・再照合 | I06/I17〜21/R01/R02/R06: 二重writer、request/pointer/input変化、読取中撤回、部分writeの失敗を隠さない。確認範囲に阻害なし |
| SCOPE-06 入出力境界 | I12〜14: traversal/ADS/reserved path、hardlink、component/出力祖先junction、invalid UTF-8、1MiB超過、空根拠、既知secretを拒否。確認範囲に阻害なし |
| SCOPE-07 再利用と権限の分離 | I01/R07: positiveでも実行許可ではなく、identity/candidate/costの未認定を維持しgateを別表示。確認範囲に阻害なし |
| SCOPE-08 旧gate拒否・read-only | I01/I05/I07/I08/I10/I15: check全fixture bytes/構成不変、新grant/revocationの旧loop誤流用拒否・gate状態不変。確認範囲に阻害なし |

この表は有限の独立fixture試験と今回の静的確認に対する判定であり、任意入力・任意OS競合の証明ではない。
初回で確認したdispatcher import/help/raw dispatchとdistribution専用test所有追加は今回も同じbytes。
旧approval/loopおよび共通acceptance/shared/configも初回から不変。

## 親の証拠は別扱い

親から専用52＋原独立24の76 pass、全回帰557 tests / 556 pass / 0 fail / 1既存skip、
harness:check成功が報告され、`work/evidence/2026-09-10-scoped-approval.md` に記録されている。
これは親の実行であり、独立32件に合算せず、独立全回帰を実行したとも扱わない。

## 最終対象snapshot SHA-256

主要候補5ファイルは独立再試験の前後で不変を確認。初回から変わった対象はvalidatorとcanonical testsである。

| ファイル | SHA-256 |
| --- | --- |
| docs/harness/requirements/retrospective-hardening.md | DE27EDCCFDA277D8D655E67C635E8BBD2BB5CD43994C742FF182400CF20DBF64 |
| docs/harness/design/SCOPED_APPROVALS.md | DE9B53617B1D55D73862C33D356FC38F0E36B14DBFC054F6E1ED335EA8B0B82D |
| docs/harness/operations/SCOPED_APPROVALS.md | 1B3EE904A07844FC95C2D72651C85A73A6F0FF4B3660F0A820C3F81242E762E3 |
| docs/harness/operations/CLI_REFERENCE.md | D56D7B1B152AB662D4718B23181CD784EEEFEACD8A6CCC7AA5271D7DBAFA9CC1 |
| tools/lib/scoped-approval.mjs | F6DD8A55792567CE3715853D7FAFBC0FA241ABF386D8EAD4F4B35AF5B3591FC1 |
| tools/harness.mjs | 066738544D868EB730D252B11C34BCDEBE6A1A4DF88FF07760AE491C85B0BDE0 |
| tools/lib/distribution.mjs | 582DFD9C83012075E730DAD30BD7623470B25B22491E4640733755DF61ACB830 |
| tests/scoped-approval.test.mjs | 1D4AF8D87FB330B5B420DD71AA5AB5CE452149C7B24C8ED46869DB3779E98319 |
| tools/lib/shared.mjs | D1BA0FC8078775B62FD7DDFE3776E3D36C718B78F31AA410FD9A16B9A0D5B251 |
| tools/lib/acceptance.mjs | A4785EF8688781D3BE53724F301D20E6B051D778B9F947F23102431DC2C4B8F0 |
| harness.config.json | 320885177CF71E65BE7AC2845D5AD392A27FFE84C73BC2B53449020C0CDB48E3 |
| tools/lib/approval.mjs（比較対象） | BF59255BD69EE57B24C18E1F9BDD7D44930CF81E0DFD36D43EC59C63F6355471 |
| tools/lib/loop.mjs（比較対象） | 71EA6817A53FAAD5804605EA46C08D1F7C73CD835A8361C33A9BA88C9148BAD9 |

### 独立証拠の保持

| ファイル | SHA-256 |
| --- | --- |
| work/evidence/2026-09-10-scoped-approval-independent.test.mjs（原24件・不変） | 54F6640D7B8B53836C2F9865C11BDB321EFB17C2E48402A5114D1558E4404FE8 |
| work/evidence/2026-09-10-scoped-approval-independent.log（初回2失敗・不変） | 1D3F774474679D3D984317B8130C445F05095C0D9AF9532E190EBE3FBCCD9DF4 |
| work/reviews/2026-09-10-scoped-approval-review.md（初回報告・不変） | F9F68D8AC10E5059939F213C6723B93E69C52C7E6DE51D60EA4A5CFE01A8143F |
| work/evidence/2026-09-10-scoped-approval-rereview.test.mjs（追加8件） | 777C03C376C6703D8DC39EDDF217CBFEB0C4D0E81A623EBE18634304293721C1 |
| work/evidence/2026-09-10-scoped-approval-rereview-independent.log（今回32件） | 30FC6DB278BE262178209FA9B4C86C62B9A1645F03C7144D546D3490F4A976C8 |

## 残余制約と人への引継ぎ

本人認証・署名・申告candidateとbuild/artifactの一致・費用測定/予約/強制・実provider canary・
実環境適合・実案件への配布適用・live adapter接続は、この独立再レビューの対象外で未検証。
同一config/文書のコピーcheckoutを所有者ごとに識別する仕組みや、同権限の敵対writerに対する
OS sandbox、全artifactの分散transaction、あらゆる読取後変更を防ぐ保証ではない。
この照合結果が旧gateや本番承認を置き換えることはなく、観測していない実稼働も主張しない。

次は、上記snapshotに限定した人の正式採用判断。新しい実行統合・scope拡大・実環境試行は
その判断から推定せず、別の対象範囲と必要な承認・検証を要求する。
