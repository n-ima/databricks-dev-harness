# 監査是正の設計

2026-09-16。対象要求: `docs/harness/requirements/2026-09-16-truth-repair.md`。

## 状態制御

session Markdownの既存lockを共通に使う。loop writerはloop lock→session lockの順。closeはsession lock内で関連loopを読み、loop lockは取らない。initもsession lock内で確認・記録し、closeとの取り違えを防ぐ。intake/approval/checkpointの既存session lockと協調する。

provider/check実行全体ではsession lockを保持しない。短い開始境界でsession状態を再読し、開始を記録して呼出しを開始する。既に開始したprocessをclose(blocked)で強制終了したとは扱わず、復帰時と各後続開始前に状態を確認し停止する。loop記録は実行中lockを保持するため、close(completed)はそのloopを完了扱いできない。

閉じたsessionやpending gateからのrun/achievedを拒否し、停止理由を記録する。自動active復帰はしない。terminal loopに未解決gateや実行結果不明が残る場合、旧sessionをblockedとして保存し、要件・判断・副作用の確認結果を新sessionへ明示引継ぎする。記録削除や取消を承認の代用にしない。

## skillと初期化

Lakebaseの上流版・原本hashと可逆な訂正前後の差分を `harness/vendor-patches.json` に記録し、canonical vendorを訂正してから両providerへ同期する。vendorのSKILL.md自体は上流原文のままではない。逆変換後のhashによって出自を検証でき、既に訂正済みでも同じ結果になる。refreshは新しいvendorのstagingで版・原本hashを確認し、不一致なら現行vendor/lockの置換前に停止する。LICENSE/NOTICEは不変。訂正した技能にローカル変更であることを明記する。

同期は全targetを事前検査し、未知のfile/directory/linkがあればproviderへの書込み前に停止。管理fileの変更は既存内容を専用backupへ保存してから書き込み、ディレクトリの一括削除をやめる。backupは自動削除しない。setupは同じ保護された同期を使う。途中のI/O失敗は全体のrollbackではなく、既に書き込んだ対象とbackupを保持する。通常の例外ではその呼出しが排他的に作った一時ファイルだけを除去し、対象とbackupを照合してから再実行できる。強制終了やcleanup自体の失敗では残骸があり得るため、未知ファイルを自動削除せず停止する。エラーに示された正確な一時パスと実行processの終了を確認して個別に復旧する。敵対的な同一OS権限の競合を防ぐsandboxとは呼ばない。

## Metric SQL

生成元コメントはYAML文字列の外へ置き、文字列の中は正本YAMLそのものにする。項目名・説明等の `$` はJSON/YAML二重引用文字列内のUnicode escapeで保持し、SQLの `$$` を途中で閉じさせない。既存のローカルdraft出力と非自動実行を維持する。実Databricks DDLは未検証のまま区別する。

## 検証・運用・費用

ローカル隔離fixtureと合成providerで元反例を固定し、正常/拒否/複数/競合/引継ぎ境界を検査する。担当はハーネス保守者、監視はCLI失敗と保存された停止理由、復旧はbackup/旧session確認。実データ・実資格情報なし、課金呼出なし。技能訂正は版更新時に再レビューする。

HTTP外部API/UIを新設せずinterfacesは適用外。機械契約を変更する是正は独立レビューの対象。実際のClaude/Copilotでの意味的追従は、生成byte試験や別agentの模擬応答とは分けて記録する。

実コマンドは非同期spawnで実行し、session lockを待機全体に保持しない。timeout/出力上限に達した場合は直下childの終了を待って失敗を返す。子孫process tree全体の停止保証ではなく、実providerの隔離・課金上限・外部キャンセルは別の検証と実行環境の制御が必要。
