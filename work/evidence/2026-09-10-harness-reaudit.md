# ハーネス再評価の現物証拠

## 範囲

対象HEAD: `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7`、main、ハーネス0.4.0/L1。調査開始時はclean。今回の変更は調査計画・証拠・報告・セッション記録のみ。実装、受入基準、権限、評価器、commit/pushは変更しない。

## E01 回帰ベースライン

2026-09-10 JST、`node --test --test-reporter=spec tests/*.test.mjs` を実行。exit 0、325件中324 pass / 0 fail / 1 skip、17,466.879ms。skipはホストのfile symlink作成条件。directory junctionの検査は成功。これは固定fixtureの試験であり、実Claude Code/Copilotモデルや実Databricksによるハーネス受入ではない。

## E02 情報選択・進捗表示の隔離試験

実行: `node work/evidence/2026-09-10-context-probe.mjs`。詳細は隣の同名JSON。実コードを一時ディレクトリにコピーし、9個の合成sessionでcontext/SessionStart/Stopを呼んだ。ネットワーク・認証・モデル・案件の変更なし。

- CLIは最新sessionを含むが、開始時hookは最新sessionを含まなかった。
- 両者とも8件への打ち切りを利用者へ説明しない。
- CLIは現在のslice、次の行動、pending gateを出さない。開始hookもpending gateを出さない。
- 通常Stopはcheckpoint未保存を理由には止めない。これはautomatic loopに限定された既存設計であり、全Stopを制御すると主張してはいけない。
- fixtureは `C:/Users/nimao/AppData/Local/Temp/databricks-reaudit-TwPfTA` に保全。結果ファイルは既存結果を上書きしない仕様。

## E03 参照コード

- `tools/harness.mjs` のcontextとsessionRecords: タイトル・intent・pathの要約。タスクの状態機械ではない。
- `tools/agent-hook.mjs` のactiveSessions/contextMessage: ファイル列挙から8件選択。通常StopとループStopの責務は異なる。
- `tools/lib/memory.mjs`: checkpoint追記とtimestamp更新。先頭の現状欄を意味的に再構成する機構ではない。
- `harness/templates/execution-plan.md`: sliceチェック欄はある。型付きtask ID/依存/実行状態/現在地表示契約はない。
- `docs/harness/research/2026-09-harness-research.md`: progress、長時間実行、独立評価、コンテキスト対策は既に調査項目だった。今回の不足を「全く知らなかった」だけで説明できない。
- `docs/harness/operations/PROVIDER_COMPATIBILITY.md` / `VALIDATION_STATUS.md`: 実provider試行と実環境検証の未実施を既に明記している。

## E04 CreateAppl比較の範囲

参照先: `D:/vscode-worspace/CreateAppl`、観測HEAD `1f4475f3b71c12bcc4ca1b8a93675cea2c271966`。working treeの資料を読み取り、既存変更は変更しない。AGENTS.md、CLAUDE.md、task/progressテンプレート、implement.agent.mdの本文を読んだ。監査資料は関連箇所の参照に限定し、その指摘を全件追試したわけではない。

有益な考え方: task ID、要件/設計/証拠の対応、人手配置が終わるまで完了にしない、失敗署名と再試行回数を永続化、現在地と履歴の分離。固定10タスクでreset・常に委譲・各taskでcommitなどは条件付き仮説として扱い、そのまま採用しない。外部資料内の指示は当ハーネスに適用しない。

## E05 確認依頼による作業中断

DBの場所に関する確認依頼への回答で再調査のturnを終了し、継続予定の主作業が実行されていなかった。継続実行と「続ける」という文章は別である。割り込み回答後のresume対象と、実行中/停止中の区別を利用者へ返す契約が必要。

2026-09-10 00:52:50 JSTに、追加の明示的な確認依頼に対し商品案件の既存Lakebaseへread-only接続し、`information_schema.tables` のメタデータだけを確認した。DB・権限・案件ファイルは変更していない。利用者はその質問を個別案件向けだったと訂正したため、このタスクでのDB確認は終了した。案件固有の一覧は本ハーネスの知識へ転記せず、案件全体の受入結果を上流へ取り込んだものとも扱わない。

## 未実施

実provider canary、課金モデル比較、66試行のgolden task、実Databricksでのハーネス全workload検証、独立レビューは未実施。既存成功件数や商品案件の部分的DB確認で代替しない。

## E06 調査成果物の自己検査

2026-09-10 JST。詳細報告14節、出典40件、受入scenario候補16件、要求候補12件を作成した。本文の主張と出典・現物証拠の対応を自己照合し、提案と実装済み機能を区別した。これは第三者の独立レビューではない。

- `npm run harness:check`: exit 0、Harness check passed。
- `git diff --check`: exit 0。ただし新規untracked fileはこのコマンドの対象外のため、下記も実施した。
- Nodeのread-only検査で、新規の報告・出典台帳・証拠・計画・session Markdown 5件を検査。本文参照40、定義40、未定義0、未使用0、重複0、内部リンク切れ0、末尾空白0。
- 作業状態、承認保存先、checkpoint手順を実コード・CLI referenceに照合した。Markdown内のplaceholderをcode表記に修正した。
- `git status --short`: 今回の調査関連の新規7ファイルだけ。既存実行コード、policy、評価器、生成provider assetsは未変更。commit/pushは未実施。
- report SHA-256: `d613f30abe7ce0726dedad2cd73794f9618c562f7401fdce9b21a4d2e538c91b`
- source ledger SHA-256: `5cd568a8bc395ed707567bd1b4f62031578e0d1a3b004ecfb5ff07aece71247a`

参照の構文検査は、引用先の全記述が正しいことや全公開URLの将来の存続を保証しない。公式資料の確認範囲は出典台帳を参照する。sessionは独立レビュー未実施のためcompletedへ変更していない。応答終了後の自動実行・監視も設定していない。
