# タスクと現在地の運用

通常はエージェントが操作する。利用者は「商品登録を作りたい」「今どこまで進んだか」「続けて」と自然言語で依頼すればよい。この仕組みは自動実行schedulerではなく、作業の正本と表示である。

## 利用者に返す表示

着手、作業の切替、確認待ち、失敗、終了時に、対象session、task一覧の要約、現在の作業、次の行動、必要な人の判断を返す。実行中processを確認していない場合は記録上の状態として説明する。詳細は以下で再生成できる。

```text
npm run harness:context
npm run harness:context -- --session SESSION_ID
npm run harness -- status --session SESSION_ID --json
npm run harness -- status --all
npm run harness -- status --session SESSION_ID --write
```

`--write`だけが`work/STATUS.md`へsnapshotを保存する。生成日時の時点の表示であり、最新の正本はsession/task。既存の非生成file・人が編集したsnapshotは上書きしない。snapshotを手で更新せず、statusを再実行する。Markdownの直接表示に加え、JSONも同じ状態を返す。

既定は8session、各8task。省略件数を表示し、`--all`で全件参照する。明示した`--session`を優先、次に`HARNESS_SESSION_ID`を使う。指定のない一覧を「一番新しいものが今の案件」という指示として扱わない。不明・終了済みfocusなら停止して記録を確認する。hookが起動するproviderプロセスへ環境変数を渡す場合も、この値は承認ではない。

## Taskを作る

要件・設計・sessionを先に紐づける。ハーネス自身はdocs/harness、案件ではdocs/productを使う。taskは成果単位で作り、tool呼出し一つずつをtaskにする必要はない。

```text
npm run harness -- task create --id APP-01 --title "商品登録を実装・検証" --session SESSION_ID --done-when "要件AC-01の入力・保存・拒否ケースに合格する"
npm run harness -- task create --id APP-02 --title "登録後の集計を検証" --session SESSION_ID --done-when "合意した集計が一致する" --depends-on APP-01
npm run harness -- task list --session SESSION_ID
npm run harness -- task show --id APP-01
```

IDは`APP-01`のような大文字英数字・ハイフンの安定ID。同じsessionの要件・設計を継承する。done条件に要求の受入項目を対応付ける。依存はそのsessionに属する既存taskだけ指定する。

## 状態を進める

`show/list/create/update`が返す最新`revision`（SHA-256）を次の更新に使う。下記の`LATEST_SHA256`は実際の値に置換する。同じ値を連続使用しない。

```text
npm run harness -- task update --id APP-01 --status ready --expected-revision LATEST_SHA256 --summary "必要な入力と依存を確認"
npm run harness -- task update --id APP-01 --status running --expected-revision LATEST_SHA256 --summary "ローカル実装を開始"
npm run harness -- task update --id APP-01 --status verifying --expected-revision LATEST_SHA256 --summary "自己試験済み、独立確認待ち" --evidence work/evidence/app-01.md
npm run session:checkpoint -- --id SESSION_ID --summary "登録処理を自己試験済み" --next "独立確認で受入条件を照合する" --task APP-01
```

planned → ready → running → verifying → done。ready/running/verifying → blocked、blocked → ready。未完了はcancelledにできる。終端からの再開は新taskとして経緯を残す。未完了の依存があればready以降へ進めない。依存の修正はplanned/blockedで明示`--depends-on`し、履歴のsummaryへ理由を記す。循環は拒否する。

`done`には`--evidence`と`--verifier-evidence`の独立検証receiptが必要。既存[独立確認手順](CLI_REFERENCE.md)に従い、accepted requirement全体を検証したreceiptにtaskの証拠を含める。細かな作業すべてを直列依存にするとレビュー待ちで進めなくなるため、真に完了が必要な依存だけを記す。task doneはsession完了や公開承認を代行しない。自己試験までならverifyingのまま正直に返す。

## 中断と再開

checkpointは現在状態とnextを更新し、以前の初期状態とcheckpoint履歴を保持する。既存sessionも最新checkpointを優先して表示する。`--expected-revision`を指定すれば、sessionの読み取り後の変更も検出できる。focusを解除する場合は`--task none`。

`--blocker`を省略しても確認待ちは解除されない。旧形式のsessionでも最後に明示されたblockerを引き継ぐ。解消を記録する場合は`--blocker none`を指定する。blockerの本文を置換する際は初期情報や手追記もarchiveへ保存する。これは`gate_status`の承認・解除を行う操作ではない。

別件の確認を受けても主taskを完了扱いにしない。元sessionと次の作業を保持し、回答後は許可された範囲で実際に再開する。終了するなら最終状態と残作業を保存し、応答終了後も自動作業が続くようには説明しない。

lockが残った場合はprocessと保存結果を調べる。コマンドが失敗したからといってlockや生成物を無条件削除しない。同一OS権限の別processによる悪意ある書換えは、repository内のlockだけでは防げない。

## 検証範囲

CLIと両provider形式のhookを隔離fixtureで試験する。実Claude Code/Copilotの拡張・CLI・modelが実際にこのskillを読み、動作したことは別のcanaryで検証する。固定fixtureの成功を実provider受入と呼ばない。
