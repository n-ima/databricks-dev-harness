# HARD-08 — 初期化fixtureと生成ルート検査

Status: adopted local slice — 2026-09-10 / ADR-0008. Private source push authorized; no versioned release or live deployment.

最新判定: HI-01〜04を解消。全体505 tests / 504 pass / 0 fail / 1既存skip、
独立42 probe / 42 pass。関連の独立再実行152 tests / 151 pass / 1既存skip。
正式採用は[ADR-0008](../../docs/harness/decisions/ADR-0008-initialization-safety-adoption.md)に記録済み。
実環境適合・versioned releaseは別であり、ハーネス全体の完了ではない。

出版前の[過去ログ追補](2026-09-10-initialization-log-erratum.md): 旧aliasレビューの
再生log1件に名前再利用による参照不一致がある。旧参照を採用根拠から外し、
別名で保持された最終r6証拠と26ファイルの一致で今回の限定採用を判断する。

## 対象と再現

ユーザーの「進めてください」に基づく HIMP-08 のローカル改善。
個別案件や実DBへの操作ではない。
[契約](../../docs/harness/design/INITIALIZATION_REPRODUCIBILITY.md)に INIT-01〜03 / ROOT-01〜04 を定義した。

修正前の fresh test と同じ全体copyをテストhelperへ抽出し、初期化済みsourceから
product.config.jsonが混入する反例を再現。fake CLIのnested-only出力では想定外の
rootのままvalidateが呼ばれ、fixture markerも作られることを再現した。
[red](2026-09-10-initialization-red.log): 2 tests / 0 pass / 2 fail。
これは実CLI v0.69.1の出力がnestedである証明ではない。

## 変更

- v1 allowlistと固定の最小package/READMEを用い、テスト時の案件設定・Bundle・履歴のコピーを廃止。sourceは書かず、新しいfixtureのみ排他的に作成。
- 初期化済みfixtureの同名再実行で設定・ユーザー変更・baselineを保持。改名は引き続き拒否。
- AppKit applyはauth/init前に空き出力・linkを確認。生成後、quarantine/validate前に実root/package/全treeの型と上限を確認。
- nested/unknown/linked/invalid出力を移動せず保存し、failureStageと期待rootを記録。validate成功後も再検査。
- marker/quarantine衝突時は上書きしない。テストhelperと新規テストを配布対象に含め、更新時の依存欠落を防ぐ。

## 検証状況

| 証拠 | 観測 |
| --- | --- |
| [初回green](2026-09-10-initialization-first-green.log) | 27 pass / 0 fail / 0 skip |
| [関連回帰](2026-09-10-initialization-focused.log) | 78 tests / 77 pass / 0 fail / 1 skip、約12秒 |
| [初回全体回帰](2026-09-10-initialization-full.log) | 487 tests / 485 pass / 1 fail / 1 skip。旧validation失敗試験のinit fakeに生成ファイルがないため、先に新検査で拒否された |
| [全体回帰r2](2026-09-10-initialization-full-r2.log) | 487 tests / 486 pass / 0 fail / 1 skip、約40秒。旧fakeを補正、既存の失敗assertを維持しfailureStage=validateも追加 |
| [採用済み範囲の不変確認](2026-09-10-initialization-preservation.log) | 受入判定5 code/test +3 docs注記、simulation11 snapshot、両独立レビュー不変。harness check成功 |
| [初回独立レビュー](../reviews/2026-09-10-initialization-review.md) | P2 HI-01（不正UTF-8）/HI-02（root差し替え）を検出。独立13件は11pass/2fail。初回証拠を保存 |
| [HI-01/02修正の再生](2026-09-10-initialization-fixes.log) | 主担当が元の独立testを変更せず再生し、関連を含め58pass/0fail。独立再レビューの代わりではない |
| [全体回帰r3](2026-09-10-initialization-full-r3.log) | 495 tests / 494 pass / 0 fail / 1 skip、約39秒。HI-03/04修正前の履歴 |
| [HI-03修正の元probe再生](2026-09-10-initialization-case-fix.log) | 1 pass / 0 fail。Windowsの大文字Bundle復元を拒否 |
| [全体回帰r4](2026-09-10-initialization-full-r4.log) | 501 tests / 500 pass / 0 fail / 1 skip、約39秒。HI-04修正前の履歴 |
| [最終全体回帰r6](2026-09-10-initialization-full-r6.log) | 505 tests / 504 pass / 0 fail / 1 skip、約32秒 |
| [最終独立probe](2026-09-10-initialization-final-r6-independent.log) | 旧33probe＋型境界9probe、42 pass / 0 fail / 0 skip |
| [最終独立関連回帰](2026-09-10-initialization-final-r6-baseline.log) | 152 tests / 151 pass / 0 fail / 1既存skip |

skipは既存distribution試験のファイルsymlink権限不足。directory junctionの拒否、
dangling junction、source/destination ancestor、generated child、hard linkは実行済み。
全実行は Windows / Node 24.15.0、ローカル一時fixtureと注入fakeのみ。
コード/CLI利用面の相違はないためClaude Code/Copilotの双方に同じ検査が適用される設計だが、
今回実providerやVS Code上のエージェント動作は試していない。

## コスト・制約

fixture allowlistにはsetupの必須入力追加時の更新コストがある。生成物の走査には上限を
設け、大きなstarterは黙って省略せず停止する。20,000 entry上限の試験は実ファイルを
使うため約8秒を要した。package JSONの構造確認は品質・脆弱性検査ではない。
パス検査は同権限の敵対プロセスを隔離するOS sandboxではない。

HIMP-01 / HARD-02・07 simulation-onlyの正式採用は維持。旧candidateのpolicy hashは
新しいコードに合わせて付け替えず、必要な新規実行は新規candidateとして扱う。
L1のまま。実CLI生成、認証、実配備、paid/provider評価、個別案件への反映、commit/push、
releaseは実装・検証時点で実施していない。その後のユーザー指示により、今回の
正式採用と累積ハーネス変更のprivate source pushを別途承認済み。
全8要件の完了や「世界最高」の比較実証も主張しない。

[golden候補](2026-09-10-initialization-golden-proposal.json)に自然言語fixtureと
成功条件を記録した。既存golden正本は変更せず、実providerでの評価も未実施。

## 独立指摘への修正

HI-01: fatal UTF-8 decoderで置換読み込みを禁止。不正bytesは加工せず保持して停止する。
HI-02: rootのdevice/inodeをbigint文字列で記録し、初回・検証直前・検証後の同一性、
packageのbyte hash、root Bundle/fixture marker/quarantineのhashを照合する。
同一pathでも別directory、または同一root内のpackage/control変更は失敗。
正当な同一rootでのcache追加は引き続き成功する。制御ファイルの読取上限も1 MiB。
変更後の機能差分は独立再レビューへ送り、実装ファイルは凍結した。
初回指摘は「なかったこと」にせず、元報告・probe・logを保存する。

再レビューで HI-03（Windowsのcase別名によるBundle復元）も検出された。
package/controlファイル名の非canonicalな大小文字表記を全OSで拒否し、上限や
quarantineの回避を防止。fixtureのlocal-state/baseline除外も大文字小文字を無視して
比較するよう補強した。別綴りを自動改名せず、元bytesを保持する。
恒久回帰へcase別名4種、validate中の復元、uppercase fixture汚染の負例を追加した。

HI-04: root制御ファイル名のdirectoryもregular-file契約で拒否。初回mockの既存
marker/quarantine衝突は、outputInspection=failedのまま従来のfixture-quarantine診断を
維持し、検証後の型変更はoutput-reinspectionで停止する。通常cache directoryは許容。
独立33probeの初回再生は32pass/1fail（既存衝突メッセージの互換のみ）だったため、
元assertを変更せずエラーへcollisionの説明を補足し、当該2probeが成功することを確認。
[文言互換の再生](2026-09-10-initialization-collision-message.log)。失敗logも保存する。

実CLI適合の追加制約: post-validate検査はnode_modules等を含む全生成treeが対象。
実CLIが大量依存物やlinkを生成すれば上限/link拒否で停止する場合がある。今回は
例外規則を足さずfail-closedとし、HARD-06で実測すべき残課題として記録する。

## 最終引継ぎ

独立レビューは [最終報告](../reviews/2026-09-10-initialization-final-review.md) を正本とする。
初回・r2・r3の報告と失敗ログを保存し、元probeは改変していない。
HARD-08はverifyingのまま、今回の限定採用を人へ確認する。全8項目の完了receiptは
発行しない。採用後の予定はHARD-03/04/07の承認範囲・稼働状態表示の改善であり、
実Databricks・provider・個別案件・GitHubへの変更は別途範囲を確認する。
