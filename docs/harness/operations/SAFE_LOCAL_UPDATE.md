# 短い指示で安全にハーネスを更新する（0.6.0）

この入口は0.6.0で正式採用しました。0.4/0.5には含まれませんが、旧版案件から0.6.0へ直接更新できます。先に0.5へ更新する必要はありません。元版のない場合と旧0.5への移行履歴は[従来の橋渡し手順](UPDATING_EXISTING_PROJECTS.md)を参照してください。

## 旧版案件で最初の一度だけ伝えること

案件側のチャットへ、信頼する0.6.0のローカル展開先を指定して依頼します。古い案件内には新しいskillがないため、更新元の手順を読むよう明示します。保持対象の列挙は不要です。

```text
D:/tools/databricks-dev-harness/docs/harness/operations/SAFE_LOCAL_UPDATE.md を読み、
この案件のハーネスを、そのローカルフォルダーの0.6.0へ更新して。
```

配布物形式なら手順のpathは`LOCAL_RELEASE/files/docs/harness/operations/SAFE_LOCAL_UPDATE.md`。本PCの固定配布物は`D:/projects/databricks-dev-harness/.harness/releases/0.6.0`です。元ハーネスの開発中ファイルを丸ごとコピーせず、検証済み配布物を使います。

## 普段の使い方

更新したい**案件側**のClaude Code / Copilotで、次のように依頼します。

```text
この案件のハーネスを、D:/tools/databricks-dev-harness から更新して。
```

「案件固有を保持」「秘密情報を守る」と毎回書く必要はありません。エージェントが保存、差分計画、確認、適用、試験へ進めます。利用者は更新元を信頼できるかと差分・手動移行の判断を確認します。競合時に無理やり最新版へそろえることはしません。

## ローカル更新元の用意

- 接続できるPC: 信頼する公開版をclone、またはZIPをダウンロードして展開します。案件と別のフォルダーに置きます。特定の公開commit/版を選び、取得元を確認してください。
- 接続できないPC: 別PCから検証済みの展開フォルダーか配布物を持ち込みます。案件をGitHubへ接続する必要はありません。ZIPファイルそのものではなく展開先を指定します。
- ソースフォルダーには`harness/base-release.json`が必要です。全管理ファイルのbytesがその固定版と一致する必要があります。CRLF変換等でも不一致は止めます。改変した案件や開発途中のファイルからmanifestを再生成しないでください。
- 開発中ハーネスを更新元にする場合、同じbase版の検証済み`.harness/releases/<version>`があれば、その固定配布物だけを使います（`stamped-release`と表示）。未採用の編集を取り込みません。別版を自動検索しません。該当配布物がなければ不一致で停止します。

ハッシュ一致は取得元の本人認証ではありません。悪意のあるソースはmanifestも書き換えられるため、実行器と配布元の信頼確認は必要です。上限はmanifest 8 MiB、管理8192ファイル、1ファイル64 MiB、合計256 MiBです。上限超過を自動で緩和しません。

## エージェントが実行するコマンド

案件を保存し、書込み中agentを止めてから、案件のルートで実行します。Node.js 22以上が必要です。package.jsonの変更やnpm install、setupのやり直しは不要です。

```text
node tools/update-harness.mjs plan --source D:/tools/databricks-dev-harness
node tools/update-harness.mjs apply --plan .harness/updates/実際の計画名.json --yes
```

1行目は検証済みsourceのlocal snapshotと計画を保存するだけで、管理ファイルを変えません。対象・元版/先版・件数・競合・手動移行を日本語で確認します。2行目はその計画を確認してから実行します。計画後の対象変更は拒否されます。元sourceが後から更新されても、計画は固定snapshotの版を参照します。

新しいCLIがまだない旧版案件では、**採用・公開済み0.6.0の実行器**を明示して起動します。0.4/0.5配布物の実行器ではありません。

```text
node D:/tools/harness-release/files/tools/update-harness.mjs plan --source D:/tools/harness-release --target D:/projects/my-project
node D:/tools/harness-release/files/tools/update-harness.mjs apply --plan .harness/updates/実際の計画名.json --yes --target D:/projects/my-project
```

clean sourceなら実行器のpathは`D:/tools/databricks-dev-harness/tools/update-harness.mjs`。対象は`--target`の案件です。次回は案件内へ導入されたCLIを使えます。将来の管理対象/schemaに古いCLIが未対応なら、再び信頼済み新版の実行器を使い、古いallowlistを改変して回避しません。

対象には`product.config.json`と`.harness/installed-release.json`が必要です。元版がなければ[初回登録](UPDATING_EXISTING_PROJECTS.md)へ戻ります。空フォルダー、開発元自身、sourceを案件の中へ置く配置は対象外です。

## 保護と停止

案件コード、docs/product、work、package/lock、README、.vscode、接続設定、秘密情報は変更しません。ハーネス管理ファイルでも案件独自の変更・削除・追加衝突があれば全体を拒否します。未知の引数やforceも拒否します。管理ファイルの削除は計画に表示し、人が確認します。

適用前に`.harness/backups/<更新ID>/`へ元bytesと導入版を保存します。中断時は`recovery.json`、元plan、Git差分を照合します。自動rollbackではありません。途中追加されたファイルも計画にあるため、単にbackupを重ねるだけでは復旧になりません。利用者のその後の変更を確認し、復旧対象だけ別途承認して戻します。backupやlockの一括削除、古いplanの強制再実行はしません。

成功時は全管理ファイルと削除結果のhashを照合してから導入版を記録します。表示は「ファイル更新・hash確認済み」。案件試験と独立レビューが終わるまで案件の更新受入完了とは呼びません。provider設定、秘密情報、権限を自動追加しません。競合がないことは版の安全性の全面保証でもありません。

生成済みproviderファイルも更新済みなので、通常は`agent-assets:sync`を実行しません。この同期は生成先全体を再作成します。案件独自のskillがあれば、checkの不一致を直すために削除・再生成せず、そのまま保持して別途レビューしてください。

この仕組みは自動実行schedulerやOS sandboxではありません。同時に任意コマンドで変更する別agentは完全検知できないため、更新中の書込み停止は必要です。snapshots/backupsは自動削除せず、容量の整理は復旧不要と確認した後の別作業です。ハーネス更新はローカル操作であり、Databricks配備・GitHub pushではありません。
