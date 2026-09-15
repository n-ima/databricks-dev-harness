# HARD-03 — 案件の承認範囲台帳と引継ぎ照合

Status: independently reviewed local implementation candidate; human adoption pending; not adopted or published.

## 目的と対象

ユーザーの「では続きを再開して」に基づき、既存計画HARD-03を再開した。
ハーネス本体はGitHubで管理してPC/CIで使う。Databricksへの配備対象は案件成果物のみ。
今回はその成果物に関する承認範囲のローカル記録・照合であり、実環境へは接続しない。

既存approvalはgate/session/artifact hashを保持する一方、環境・資源・主体・操作・
権限・費用・期限の共通照合を持たない。既存のhuman gateを弱めず、別kindのscope原本と
撤回記録、read-only照合を追加した。[契約](../../docs/harness/design/SCOPED_APPROVALS.md)、
[利用方法](../../docs/harness/operations/SCOPED_APPROVALS.md)。

## 実装と検証

- `approval-scope record/check/revoke`を共通CLIに追加。Databricks/外部adapter呼出しなし。
- 案件config・要件・設計・根拠・control codeのraw bytesを束縛。同一scopeだけ引継ぎ可能。
- 期限/撤回/不一致/破損・重複JSON/上限/リンク・hardlink・競合を検査。
- 旧gate/receipt/loop/policyは変更せず、新台帳で旧loop gateを解除できないことを試験。
- 原本を上書きせず、checkは読取のみ。既知の未解決gateも別フィールドで返す。

| 実行 | 結果・解釈 |
| --- | --- |
| scoped-approval-red.log | 32 tests / 11 pass / 21 fail。新CLIが未実装で必要な正常経路が成立しない。既存の範囲拡大通過を再現したログではない |
| scoped-approval-green-r1.log | 11 pass / 21 fail。秘密検出式を含むcontrol code自身をuser evidenceと同様にscanしたため誤拒否。失敗を保存 |
| scoped-approval-green-r2.log | 32 pass / 0 fail。control codeはhashのみ保存・入力/根拠はsecret scanを維持 |
| scoped-approval-green-r3.log | 50 pass / 0 fail / 0 skip。期限/撤回/終了元session/別active session/旧gate拒否/link/上限などを追加 |
| scoped-approval-full-r1.log | 555 tests / 554 pass / 0 fail / 1既存skip。Windows / Node 24.15.0、約48秒 |
| scoped-approval-independent.log | 独立24件 / 22 pass / 2 fail。時計巻戻りの期限下限漏れをSIR-01/P2へ集約 |
| scoped-approval-clock-red.log | 正式な回帰試験へ2負例を追加し、修正前0 pass / 2 fail、exit 1 |
| scoped-approval-clock-green.log | 修正後、専用52件＋原独立24件の76 pass / 0 fail / 0 skip、exit 0 |
| scoped-approval-full-r2.log | 修正後557 tests / 556 pass / 0 fail / 1既存skip、exit 0。約32秒 |
| scoped-approval-rereview-independent.log | 独立再実行: 原24件＋追加8件の32 pass / 0 fail / 0 skip、exit 0。SIR-01解消 |
| npm run harness:check | passed |

各logはこのディレクトリ内の`2026-09-10-`付きファイル。同名の過去ログへ上書きしていない。
原本の追補対象だった過去ログは変更しない。provider本体は実行していない。

## 初期独立契約所見への反映

1. 新recordにlegacy `decision/sessionId/gate/actor/evidence` shapeを持たせず、逆向き誤流用を試験。
2. 元sessionは終了後も存在/対象一致が必要。利用先active必須、元終了だけでscopeは撤回されない。
3. 閉じたenvelope、厳密UTC/期間、原本hashへ束縛した撤回、破損時停止。
4. 入れ子/escapeを含む重複JSON key、文字列上限・不可視/control/wildcardを拒否。
5. 同じconfig/文書をコピーしたcheckoutの識別限界を明記。Git本人認証ではない。
6. 要件accepted＋有効AC、設計は参照/bytes束縛。設計status:proposedの通常intakeと互換。

## 独立実装指摘と修正

[初回レビュー](../reviews/2026-09-10-scoped-approval-review.md)はSIR-01/P2を再現した。
処理中に時計が発行時刻より前へ戻ると、record保存直前/check終了時の上限だけの検査では
未来発行の保存・有効範囲の誤表示が可能だった。`validAt`で一度取得した最終時刻の
下限と上限を共に検査する。既存の期限等号失効・有効時刻正例を維持し、public clock flagは追加しない。
原独立24試験・失敗log・初回レビューは変更せず、2負例をcanonical suiteへ追加した。
76成功は実装者による再生結果である。その後の
[独立再レビュー](../reviews/2026-09-10-scoped-approval-rereview.md)は原24件＋追加8件の
32件すべて成功し、SIR-01解消・限定SCOPE-01〜08の確認範囲に未解消の阻害なしと判断した。
実装者は報告自身のSHA-256と表の18対象（比較対象・初回証拠を含む）を実bytesと照合し、全件一致を確認。
再レビューSHA-256は`330eb84c80e723f686f55f3442526ea5ba4fa02b025068cc09db33d019be3de6`。
親の全体回帰と独立32件は別の実行として扱い、独立した全回帰の実施とは主張しない。

## 旧採用・検証記録の扱い

開始時HEADは`0d77f62514cafd00f4dc00d190e955a99a0acd35`。
既存scopeなし承認と検証器の実装はそのまま。新commandのdispatcher、配布所有一覧、
CLI案内の差分は新候補のレビュー対象に含める。旧レビューのhashは新bytesへ更新しない。
旧スナップショット照合は開始commitの版に対して再現するものであり、新版へ昔の証拠を
流用しない。新しいtools/libにより既存policyHashの観測値が変わるのは意図した失効である。

旧HARD-08最終レビューの26対象をraw SHA-256で再照合した。25対象は不変、残りは
今回の専用testを所有一覧へ加えた`tools/lib/distribution.mjs`のみ。旧レビューの26一致を
新版で主張せず、この差分を今回のレビュー対象とする。`git diff --check`も成功した。

## 費用と未検証

専用52試験と原独立24試験の同時再生は約16秒。承認recordの照合では数個の固定control fileを読むためI/Oが増える。
scopeの完全一致は安全側だが、範囲縮小でも新規判断が必要なv1互換コストがある。
actor・candidate digest・費用上限はいずれも宣言/記録であり、本人認証・build一致・課金の
強制ではない。CLIはすべて`executionAuthorized:false`を返し、旧gateを自動解除しない。

live実行統合、課金計測、実provider試行、案件への適用、HARD-04の稼働状況表示は未実施。
HARD-03/HIMP-03全体の完了receipt、成熟度昇格、「世界最高」の比較実証も未主張。
今回の限定候補は独立レビュー済みで、人の正式採用判断待ち。pushは今回の再開から推定しない。
