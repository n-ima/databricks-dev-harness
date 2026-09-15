# 開発中の案件へハーネス更新を取り込む

ハーネス元のGitHubへpushしても、テンプレートから作った案件は自動更新されない。案件を作り直したり、setupをやり直したりする必要はない。案件の開発ブランチとは分けて、レビュー可能な更新差分を作る。

## 旧0.4/0.5から初回更新するときの橋渡し

現在の推奨は[0.6.0の短い更新入口](SAFE_LOCAL_UPDATE.md)です。旧0.4/0.5から直接0.6.0へ進めます。以下は0.5.0へ更新する場合の履歴・元版登録手順として残します。保持は従来のupdaterにも組み込まれており、この文章を書き忘れると保護が外れる仕様ではありません。

```text
この案件のハーネスを、承認済みの0.5.0へ更新したい。
まず現在の作業をcheckpointし、他のエージェントの書込みが止まっているか確認して。
変更中の案件コード・文書・作業記録・秘密情報を守り、更新用ブランチで進めて。
信頼するハーネスの公開commitと配布manifestを照合し、旧baselineを保持して更新計画を作って。
競合と手動移行があれば説明してから統合して。基準hashや計画の書換えによる回避は禁止。
ハーネスと案件の試験・独立レビューまで行い、Databricksへの配備はしないで。
```

この指示を出す先はハーネス開発元ではなく、更新したい案件のClaude Code / Copilot。資料の読取りと差分計画は先に行えるが、実際のファイル更新は案件の書込みを止めてから行う。

## 1. 案件を保存し、更新元を固定する

- 実行中エージェントにcheckpointを依頼して停止する。未コミット変更・未追跡ファイルを確認し、秘密情報を除いて案件のGitへ保存する。無差別な`git add -A`は避ける。
- 案件側で`codex/harness-update-0.5.0`などの更新ブランチを作る。既存のブランチ名や変更を上書きしない。
- `.harness/installed-release.json`の元版を確認する。存在しなければ、案件作成時の真正な`harness/base-release.json`を`release baseline --manifest harness/base-release.json`で登録する。今の案件から基準を再作成してはいけない。元版が不明なら停止して出自を調べる。
- 開発元とは別のclean checkoutで、信頼する公開commitへ固定する。今回の0.5.0では、ローカル配布物は`D:/projects/databricks-dev-harness/.harness/releases/0.5.0`。別PCではprivate GitHubの権限で公開commitを取得し、下の生成手順を実行する。未採用候補を含む開発元のdirty treeから再生成しない。

公開commitのclean checkoutで実行する（案件側ではない）。

```text
npm ci --ignore-scripts
npm run harness:check
npm run test:harness
node tools/check-release.mjs
npm run harness -- release create --version 0.5.0
```

出力は`.harness/releases/0.5.0/manifest.json`と`files/`。生成日時は再生成ごとに異なるが、管理対象のpathとhashは公開commitの`harness/base-release.json`と一致することを確認する。既存出力の上書きや、案件側での`--stamp-template`は行わない。hash一致だけで供給元の本人認証にはならないため、GitHubの取得元とcommitも確認する。

## 2. 案件側で差分だけを計画する

次は案件のルートで実行する。以下の配布物パスは実際に検証した絶対パスに置き換える。

**0.4.0からの更新では、旧版の更新CLIを使わない。** 旧版は新版の追加テストファイルを許可リスト外として拒否する。検証済み0.5.0配布物内の更新APIを読み込み、対象は明示的に現在の案件ルート（`process.cwd()`）とする。新版`tools/harness.mjs`を絶対パスで実行するとハーネス側が更新対象になってしまうので、それも行わない。以下の長いコマンドはエージェントが操作する。

```text
node --input-type=module -e "import {pathToFileURL} from 'node:url'; const source=process.argv[1]; const {planUpdate}=await import(pathToFileURL(source+'/files/tools/lib/distribution.mjs')); await planUpdate(process.cwd(), {source});" D:/projects/databricks-dev-harness/.harness/releases/0.5.0
```

表示された`.harness/updates/update-....json`を読む。この段階では管理ファイルは変更しない（計画JSONは保存する）。

- 元版と同じファイルは更新候補となる。
- 案件で独自変更・削除したファイルは`conflict`となる。新しい版と同一なら保持できる。
- 競合が1件でもあれば`update apply`は全体を拒否する。`canApply`や基準hashを書き換えて強行しない。
- 競合は元版・案件版・新版の3者をレビューして解決する。独自変更を新版から分離できるなら保存・承認のうえ退避し、更新後に別コミットで再適用して試験する。新版と同じにできない場合、現行updaterは自動mergeしないため、手動移行として別途レビューする。競合解決後は計画を作り直す。

## 3. 確認した計画を適用し、案件を検証する

競合がなく、手動移行の内容も確認できた場合だけ、同じ案件ルートで実行する。適用も検証済み新版のAPIを使う。元版baseline・競合・planHash・実行前bytesの照合は通常と同じで、許可リストを旧版側で書き換えない。

```text
node --input-type=module -e "import {pathToFileURL} from 'node:url'; const source=process.argv[1]; const {applyUpdate}=await import(pathToFileURL(source+'/files/tools/lib/distribution.mjs')); await applyUpdate(process.cwd(), {plan:process.argv[2], yes:true});" D:/projects/databricks-dev-harness/.harness/releases/0.5.0 .harness/updates/実際の計画ファイル名.json
npm run harness:check
npm run test:harness
```

provider向け生成済みファイルも配布物に含まれるため、更新後に`agent-assets:sync`を無条件実行する必要はない。この同期は生成先を作り直すため、案件独自のskill等があれば削除される恐れがある。checkで独自ファイルによる不一致が出ても自動修復せず、保持したまま差分をレビューする。

加えて、案件のunit/API/UI/受入試験と独立レビューを行い、差分を確認して更新ブランチを統合する。計画作成後に対象が変われば適用は拒否されるので再計画する。変更前の管理ファイルは`.harness/backups/`へ保存されるが、自動ロールバックではない。中断時は`recovery.json`とGit差分を調べ、案件の変更を残して復旧する。

## 自動上書きしないもの・0.5.0の手動確認

| 対象 | 取り扱い |
| --- | --- |
| `apps/`, `src/`, `resources/`, `product.config.json` | 案件の実装・設定として保持 |
| `docs/product/`, `work/` | 要件、設計、既存承認、証拠、作業記録を保持 |
| `package.json`, `package-lock.json`, `README.md`, `.vscode/` | 案件所有。必要なscripts/依存差分だけ手動レビュー。案件のversionをハーネスに合わせない |
| 秘密情報、認証、`.harness/local.json` | 配布物に含めず保持 |
| `docs/harness/`, `harness/`, `tools/`など | ハーネス管理対象。案件独自変更は競合として停止 |

0.5.0は新しいnpm依存を追加しない。通常の`harness` / `intake` / `test:harness` scriptsがあることを確認する。`docs/product/standards/FRONTEND.md`は自動更新対象外なので、軽量HTML確認とfixtureモックの使い分けの差分を案件の既存設計と照合して必要な部分だけ取り込む。

日本語の文書テンプレートと品質契約診断は、更新後の新規生成・変更作業で利用する。既に承認した要件書・設計書を一括翻訳したり、新テンプレートで上書きしたりしない。必要な部分だけ追記・移行し、内容に変更があれば再レビューする。過去の承認・receiptは履歴として保持するが、policyや対象hashが変わった後の新しい成果物へ自動流用しない。

最後にエージェントを新しいcontextで起動し、既存sessionと更新記録を読み直させる。記録された未完了作業から再開する。この一連の操作はハーネスのローカル更新であり、Databricksへの配備ではない。
