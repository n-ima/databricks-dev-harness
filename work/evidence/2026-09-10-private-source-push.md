# Private source checkpoint — 2026-09-10

ユーザー指示: 「採用してOK。ここで１度pushしてください。リモートへ。」

## 対象と境界

- Repository: `https://github.com/n-ima/databricks-dev-harness`
- Remote: `origin` / branch: `main` / visibility: `PRIVATE` / template: `true`
- 準備時のlocal/remote HEAD: `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7`
- 蓄積したハーネスのtask可視化・受入判定・simulation・初期化安全性と研究/検証履歴を保存。
- HARD-08採用: [ADR-0008](../../docs/harness/decisions/ADR-0008-initialization-safety-adoption.md)。
- 通常のfast-forward pushのみ。force、バージョン変更、tag作成、実配備はしない。
- `main`のbranch APIは`protected: false`を返した。rules APIは契約機能の制約で403。
  課金・可視性・保護設定を変更せず、既存のprivate設定で送信する。

## 送信前の観測

- `npm run harness:check`: passed。
- 全体回帰: [専用ログ](2026-09-10-private-push-full.log)、505 tests / 504 pass / 0 fail / 1既存skip、exit 0。
- `initialization-adoption-check.mjs`: 最終独立review本体＋26対象、既存simulationのreview＋11対象が一致。
- `acceptance-adoption-check.mjs`: 5実装/試験と3文書の承認済み注記、独立review、受入8条件保持を確認。
- 秘密情報の高確度既知パターン（private key、GitHub、AWS、Databricks token、credential URL）は検出なし。
  これは全種類の秘密情報を検出できるという保証ではない。
- 初期inventoryは190files/約2MB、個別案件の実体・ローカル認証設定は含まない。
- 26件のCRLF logはGit変換を無効化し、元bytesを保持する。
- 旧証拠1件の参照不一致は[追補](2026-09-10-initialization-log-erratum.md)へ明記。最終r6とは別の履歴。
- `git diff --check`: passed。

ステージ後の確認では、197ファイルのindex blobと作業ファイルのbytesが全件一致。
ただし全体の`git diff --cached --check`は、保存したCRLF logや失敗診断の空白、
文書/生成記録のEOF空行を報告した。`cr-at-eol`としても47箇所の空白警告が残る。
これを全体成功とは扱わず、レビュー済みbytesの保存を優先して過去証拠は整形しない。
コード・設定・設計・運用文書（`.gitattributes` / `.claude` / `.github` / `harness` /
`tests` / `tools` / `docs/harness/{decisions,design,operations}`）の同チェックはexit 0。
上のunstagedチェックとstaged全体の対象は異なる。最終追記後に再度bytesを照合する。

独立の送信前確認は [private-source-push-review](../reviews/2026-09-10-private-source-push-review.md) を参照。
ステージbytes照合、commit、remote送信結果とhosted CIは後段で確認する。
ローカル試験を3OS hosted CI成功・実provider動作・実Databricks受入の代わりにしない。
