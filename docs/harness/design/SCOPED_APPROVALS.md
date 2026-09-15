# HARD-03: 案件の承認範囲を安全に引き継ぐ

Status: proposed local slice / 2026-09-10. 親要件 HIMP-03 は変更しない。

## 境界

ハーネスはGitHubで配布・保守し、PC/CIの開発支援に用いる。Databricksへ配備するのは
案件で作る成果物であってハーネスではない。今回作るのは案件リポジトリ内の承認台帳と
read-only照合であり、Databricks SDK/CLI、network、shell、配備adapterを呼ばない。
元ハーネス（product.config.jsonなし）では台帳への新規承認記録を拒否する。

既存のproduct-intent/ui-mock承認、loop gate、receipt、simulation承認は変更しない。
新台帳は旧gateを解除せず、旧/合成承認を実承認へ変換しない。既存のscopeなし承認から
環境・権限・費用を推定することもない。本候補はHIMP-03全体のlive実行統合ではない。

## ローカル操作

`approval-scope record --id ID --session SESSION --request PATH --actor ACTOR --evidence PATH --expires-at UTC`
は、人が実際に決定した記録を新規作成する。actorは本人認証ではない。
`approval-scope check --id ID --session SESSION --request PATH` は現在の入力と照合する。
`approval-scope revoke --id ID --actor ACTOR --evidence PATH` は別の撤回記録を排他的に追加する。
checkは一切書込まない。record/revokeもsessionや既存gateを更新しない。

保存先は `work/approvals/scopes/ID.json` と `ID.revocation.json`。原本を上書きしない。
全コマンドはraw argvを厳密に検査し、未知/重複/欠損flagや位置引数を拒否する。
public commandにclock差替え、外部adapter、ignore-expiry、forceは設けない。

## request v1

必須fieldのみを許可する。文字列の暗黙変換、大小文字修正、重複除去はしない。

- schemaVersion: 1
- product: product.config.jsonのnameに完全一致
- component: repo内のapps/src/resources配下の明示directory（repo root/harness/docs/workは禁止）
- candidateSha256: 実行候補を識別する64桁lowercase SHA-256。申告値であり、build済みや
  実ファイルinventory一致をこの機能だけで認定しない。
- environment: devのみ。test/prodへの流用不可。
- workspace: host（HTTPS origin、認証/query/hash/pathなし）、id、profile
- principal: 操作主体の明示ID
- resources: 1〜64の一意な資源ID文字列
- operations: 1〜32の一意な操作名（小文字英数字とハイフン、wildcardなし）
- permissions: 0〜64の一意な `resource / privilege` の組。resourceはresourcesに含める。
- cost: currency（USD/JPY）、maximumMinor（非負safe integer）、basis: total-candidate

配列順だけは意味を変えないので比較時に整列する。部分集合や低い費用への変更でも
今回のv1は完全一致のみを許す。candidate変更も新しい明示判断が必要。
費用は人が認めた上限の記録であり、消費測定・予算予約・課金側hard limitではない。
再試行や複数操作を自動許可する機能ではない。

## 保存・照合契約

- SCOPE-01: 初期化された案件、activeでexact IDのsession、acceptedで有効ACを持つ案件要件と、sessionが明示参照する設計を
  参照する。product config/要件/設計のraw bytesとパス、requestの意味、根拠bytesを束縛する。
- SCOPE-02: requestは上記の厳密型/field/上限で検査。日付は実在するUTC日時、
  expiresAtは現在より未来・発行から最大30日。期限の等号は失効。
- SCOPE-03: 同一案件・要件/設計・範囲の別active sessionからも照合可能。
  sessionの進捗更新は承認範囲を変えない。元sessionと利用sessionの対象参照は毎回照合する。
  発行時と利用先はactive必須。元sessionはactive/completed/blocked/supersededを許すが、
  記録の存在と対象参照一致を要求する。元session終了だけではscopeを撤回しない。
- SCOPE-04: 環境/資源/主体/操作/権限/費用/candidate/product/要件/設計/根拠の変更、
  撤回、失効、破損や不明recordは再判断が必要。勝手に更新/再承認/期限延長しない。
- SCOPE-05: record/revokeは新規ファイルだけを排他的に作る。保存前に読取snapshotを再照合し、
  writer lockを競合させる。古い記録や根拠を変更しない。部分失敗は再実行で隠さない。
- SCOPE-06: 入出力はrepo内canonical相対path、regular file、祖先/leaf link拒否、
  hardlink拒否、fatal UTF-8、各1MiB以下。componentも祖先link拒否。秘密情報の既知patternを拒否。
- SCOPE-07: check出力は `eligibleForReuse` と固定reason、承認ID、期限、利用sessionのみ。
  `executionAuthorized: false`、`identityAuthenticated: false` を常に返す。
  unresolved gateは別途表示し、scope一致がその解除を意味しない。
- SCOPE-08: legacy approval、simulation approval、他案件/対象へfallbackしない。
  読取だけのcheckがファイル・approval/session状態を変更しないことを試験する。

新approval/revocationは閉じたschema・固有kind・version・内容hashを検証する。
入れ子を含む重複JSON keyは拒否し、ID/文字列は長さ・control/不可視文字・wildcardを制限する。
旧loopが誤受理しないよう `decision/sessionId/gate/actor/evidence` の旧承認shapeを持たせない。
旧gateへ新台帳を渡した負例でも状態不変を確認する。撤回はapproval IDと原本raw hashへ
束縛し、未来日時や破損をfail-closedで扱う。issuedAt<=now<expiresAtと最大30日は読取時も再検査。

同じ案件identityはproduct.configのraw hashと対象文書参照/hashに限る。同じものをコピーした
別checkoutを暗号的に識別する仕組みではなく、Git由来の本人認証でもない。
設計statusはproposedでもよく、通常intakeとの互換を保って本文bytesを束縛する。
dispatcher・今回のvalidator・共有入力検証器・harness configのraw hashも束縛する。
これらcontrol codeは内容を記録せずhashだけを保存し、ユーザー入力に対する秘密pattern検査と区別する。

## 検証・統合段階

同じrequestを再開/別sessionから照合する正例、8種の範囲不一致、期限/撤回/型/境界/
競合/根拠改変/原本保存の負例、CLI面の拒否、legacy gate不変をローカルfixtureで検証する。
両providerが共通CLIを使う設計であり、実Claude Code/Copilotのcanaryは別の証拠が必要。
HARD-04では承認台帳と案件成果物の観測を別表示する。live adapterへの接続は人の承認と
対応版検証が必要であり、今回有効化しない。

採用済み旧レビューは当時のsnapshotとして保存する。新commandを追加するdispatcherや
配布所有一覧の変更は新しい候補の証拠へ記録し、旧hashを新しいbytesに付け替えない。
