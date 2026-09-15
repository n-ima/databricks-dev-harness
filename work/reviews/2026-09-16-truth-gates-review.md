# FIX-02/03 独立コードレビュー

2026-09-16 JST。担当 `/root/audit_gates_truth`。判定: **指定したローカル範囲は合格、未解消の阻害指摘なし**。全HARNESS機能、公開版、実provider/Databricksの合格を意味しない。

## 対象と独立性

`review-work` / `orchestrate-work`、文書標準、品質契約、`docs/harness/requirements/2026-09-16-truth-repair.md` のFIX-02/03、`docs/harness/design/TRUTH_REPAIR.md`、計画・関連sessionを確認した。実装変更は主担当が行い、当担当は本体・受入条件・実案件・資格情報を変更していない。独立試験と当報告だけを追加した。

対象は現在の修正候補。未採用UIF/HARD-03や固定公開0.6.1を今回採用・公開したとは扱わない。品質JSON全体の診断と他の是正項目の判定は主担当へ引き継ぐ。

## 受入条件との対応

| 条件 | 独立確認 |
|---|---|
| FIX-02 未解決loopを残した完了拒否 | pending gate、activeな第2loop、cancelledでも未完了iterationが残るloop、壊れた記録、loop実行lockを検査。正常なloopなし/achieved loopの完了も通る |
| FIX-03 停止したsessionから実行・完了しない | blocked/completed/superseded/pending、実行開始前のlock競合、provider/第1check/第2check中の停止、停止後achievedの拒否を確認 |
| 開始・終了境界 | 合成応答だけでなく実ローカルNode childからclose(blocked)を実施。依存注入なしmanual loopの既定check runnerでも確認。時間超過時は即時childのPIDが終了済みであることまで確認 |
| 記録と互換性 | 日本語title由来の正規session ID、ファイル名と本文IDの不一致拒否、完了済みloopへのgate/approve拒否時のbytes保持、既存Windows npm呼出しの保持 |

`memory.mjs:92`–94でsession同一性と関連loopを確認し、`session-loop.mjs:25`で未解決状態を拒否する。`loop.mjs:313`/349は既存session lock内で状態確認と非同期呼出し開始を行い、process待機はlock外。`assertSession` は状態違反をblockedと理由に記録する。通常writerはloop→session、closeはsessionだけ、initはsession→新しいloopで、長いprovider待機中のsession停止を妨げない。

未解決の旧loopを削除・取消で承認済みにしない点は設計どおり。旧sessionをblockedで保存して、判断と副作用の確認を新sessionへ明示引継ぎする。自動再開や既存承認の流用は追加していない。

## 独立レビュー中に検出し、修正後に解消確認した事項

- 同期 `commandResult` を呼び終わるまでsession lockが残る問題。非同期runnerへ変更後、実Node childが処理中のsessionを閉じられることを確認。
- 新しいASCII限定ID検査が日本語session IDを拒否する回帰。Unicodeの正規IDで初期化が成功。
- sessionファイル名と本文IDの不一致。初期化拒否に加え、IDを壊してpending loopを完了集計から隠す経路も拒否。
- gate/approveの拒否がachieved loopをblockedへ上書きする問題。terminal検査の順序修正後、拒否前後のbytesが同一。
- 時間/出力上限でkill送信直後に完了通知していた問題。即時childのclose待ちへ変更後、timeoutで得たchild PIDが終了済みであることを確認。単なるWindowsのcleanup待ちを成功証拠には使っていない。

Windows npmについては通常環境にVoltaのnpm.exeがあるため、初回の通常PATH試験では回帰を再現していない。その後、npm.cmdのみを置いた合成PATHでも旧同期adapterと新非同期adapterが同じversionを返すことを確認した。未再現の推測を確定欠陥数には加えない。

## 実行証拠

独立試験: `work/evidence/2026-09-16-truth-gates-independent.test.mjs`（IND-01〜18）。

```text
node --test work/evidence/2026-09-16-truth-gates-independent.test.mjs tests/truth-lifecycle.test.mjs tests/concurrency.test.mjs tests/memory.test.mjs
# tests 68
# pass 68
# fail 0
# skipped 0
```

全て専用temp、stub、ローカルNode/npmのみ。実Claude/Copilot、ネットワーク、課金、DBを使っていない。初回独立11件は6成功/5失敗だったが、上記5原因の修正と追加試験後、最終18件は全成功。上の68件は独立18件を含み、別担当の件数へ二重加算しない。

## 検証snapshot（SHA-256）

| ファイル | SHA-256 |
|---|---|
| tools/lib/session-loop.mjs | fb85cb5893f636769f093f156b54cef7a0008adf518edcf9516b4f152c7c017b |
| tools/lib/memory.mjs | c55b76592eb6d0344eef9f03f086e81b9e44cf60cb92595a2f1bc4ec7a1e5f4b |
| tools/lib/loop.mjs | 25f5892cd2db047edf9d795803fbc5e8ae59d404ecd6d07a2c8c2351f9901806 |
| tools/lib/command-async.mjs | 5d6f1a989e905dbdb506615d5114687b91080f9b76684f52021da875a463e952 |
| tests/truth-lifecycle.test.mjs | 05eaba09805f6822fb3feb3c25a1157631d50bf6947476668c33a8487836d452 |
| work/evidence/2026-09-16-truth-gates-independent.test.mjs | 3dc066a8366d511da80ec46eac52754f1328f052220a2a55a61f3ebab18a43a1 |

## 残る検証境界

Windows/Node 24.15.0で確認した。POSIXでTERMを無視するchildへのKILL分岐はコード確認だけで、実行検証していない。孫process全終了、権限隔離、実provider適合、SIGKILL自体が失敗するOS状態、全入力の網羅は保証しない。全回帰は当担当の68件とは別。上記snapshotが変われば該当差分の再確認が必要。
