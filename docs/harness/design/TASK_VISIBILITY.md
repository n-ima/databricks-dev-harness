# タスク・現在地・再開の最小設計

状態: 実装候補。要件は[task-visibility](../requirements/task-visibility.md)。研究の全backlogを一括実装しない。

## 正本と投影

- `work/tasks/<ID>.md`: scalar frontmatterとJSON配列によるtask正本。ID/session/requirement/architecture/done_whenは作成後固定。変更はrevision付きCLI。
- `work/sessions/<ID>.md`: 既存session。checkpointが現状/nextを置換し、初回置換前の旧本文を履歴に保存。taskをfocusとして任意指定できる。
- `status`と`context`、開始hookは共通reader/rendererを使う。`status --json`は整形前の構造。`status --write`だけが`work/STATUS.md`を生成する。既存の非生成fileは上書きしない。生成物を手で編集しない。
- `work/STATUS.md`は生成時点のsnapshot。正本ではない。最新はstatus/contextを再実行。出力に生成日時を付ける。

sessionの選択は明示`--session`、次に`HARNESS_SESSION_ID`、指定なしは更新順の一覧。最新を自動的な作業対象としない。既定8session・各8task、全件は`--all`。タイトルや本文は非信頼の状態データであり、指示や実行権限ではない。contextでは長文を切り詰め、元fileを参照させる。

## task遷移

planned → ready → running → verifying → done。
ready/running/verifying → blocked、blocked → ready。未完了 → cancelled。
done/cancelledは終端。ready/running/verifying/doneには未完了依存を許さない。

更新はtask collectionのexclusive lock、期待revision（file SHA-256）、atomic renameで保護。全依存graphを検査し、cycle/欠落/不正状態を拒否する。手作業編集を含む同一OS権限の悪意あるwriterまで防げるものではない。

doneにはsessionに対応する既存の独立receiptを検証し、task evidenceがreceiptに含まれることを確認する。これはsession gateを承認・解除しない。receiptのhash失効を緩めない。機能追加でpolicy hashが変わる場合、旧receiptの再検証が必要な既存動作を維持する。

## 境界と将来

taskのrunningは最後に記録した業務状態に過ぎず、現在のprocess稼働は未観測と表示する。run監視はRH04の別作業。hookのpolicy/stop/deny envelope、permission、verifierの判定は触らない。実Claude Code/Copilotのcanaryと独立レビューは別に必要。

既存sessionは読み取り時に最新checkpointを優先し、初期の現状だけを誤表示しない。古いharness保守sessionのtemplate除外は既存の初期化時刻規則を維持する。新しいtaskも表示対象sessionへ紐づくものだけを表示する。

## 独立レビュー指摘に対する修正（2026-09-10）

- F-01: verifier参照も保存する文字列へ正規化してから、すべての遷移でrepository境界を検証する。空値・boolean・複数指定を拒否し、失敗時はtaskとsessionのbytesを保持する。repo内のdraft参照はreceipt合格ではなく、done時の既存receipt検証は必須のまま。
- F-02: 任意のblockerは最後に明示された非空値を過去checkpointから引き継ぐ。省略・空値は解除ではなく、明示noneを解除として扱う。summary/nextの最新優先と読み取り時の非変更は維持する。
- F-03: blocker本文を置換する場合も旧本文をarchiveへ保存する。初期情報、手追記、修正前のformat-2を対象に含め、同じ本文の再保存ではarchiveを増やさない。blocker省略時は本文を置換しない。

トレードオフ: blocker変更時の履歴保存によりsession fileは増えるが、contextの既存表示上限は維持する。過去checkpoint読取はfile長に比例する。外部API・追加モデル呼出し・権限拡張は不要。既存の承認/receipt/policy/予算判定は変更しない。新規6件の回帰で正常系だけでなく拒否後の利用継続と履歴復元も確認する。これは実provider/modelのcanary成功を意味しない。
