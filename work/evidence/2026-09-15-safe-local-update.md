# 安全なローカル更新入口: 実装・自己検証記録

2026-09-15、Windows、Node.js v24.15.0。対象sessionは`20260915-010502-538-safe-local-harness-update`。ハーネスのローカル候補のみ。個別案件、GitHub、Databricksは操作していない。

## 変更と観測

- 現行は配布物向けplan/applyのみで、sourceフォルダーの判別・対象cwdの独立CLIがなかった。先に12ケースを追加し、`planLocalUpdate is not a function`等で12失敗を確認した。
- `tools/update-harness.mjs`を追加。defaultはplan、source固定snapshot、対象project markerとbaseline、厳格引数、競合停止を実装。指定sourceのcode実行/ネットワーク/依存追加はない。
- distributionの既存保護を再利用。全管理ファイルと削除結果を適用後に照合し、成功を確認してから導入版を記録する。途中改変を注入して旧baselineとbackup/interrupted journalを保持することを確認。
- canonicalの更新skillと両providerコピー、自然言語routing、日本語手順を追加。独立forward testの`.harness`表記不足を1ケース追加で修正。更新機構の改善依頼は別route、全routeは実行権限を与えない。
- 旧版手順の無条件`agent-assets:sync`を除去。実装が生成先全体を削除して再生成するため、独自skillを消すおそれを避ける。updaterが保持した独自ファイルをcheckの自動修復で削除しない。

## 自己試験

| 検証 | 観測結果 | 証拠 |
|---|---|---|
| 新入口の最終試験 | 15成功、0失敗 | `work/evidence/2026-09-15-safe-update-entry-final.log` |
| 全体の最終回帰 | 634件、633成功、0失敗、1skip | `work/evidence/2026-09-15-safe-update-full-r3.log` |
| harness:check | 成功 | 2026-09-15にCLIで再実行 |
| skill形式 | 成功 | `python -X utf8 C:/Users/nimao/.codex/skills/.system/skill-creator/scripts/quick_validate.py harness/skills/update-harness` |
| git diff --check | 成功 | 2026-09-15にCLIで再実行 |

skipは既存のfile-symlink権限不足。directory junction試験は成功。Python検査の初回はWindows既定cp932によるdecode失敗、UTF-8指定で再実行し成功した。全体試験の失敗ではない。

## 独立確認と受入の境界

設計2指摘は`work/reviews/2026-09-15-safe-update-design-review.md`で解消確認。実装・追加反例は`work/reviews/2026-09-15-safe-update-code-review.md`、公開0.4→0.5の隔離実行は`work/reviews/2026-09-15-safe-update-forward-test.md`を参照。合成fixture・実配布物fixture・実provider/実案件を混同しない。

独立追加試験は最終27成功（専用15＋追加12）。公開0.4→0.5は90管理ファイルを更新し全1057hashが一致、案件保護対象20ファイルが不変。途中のチャット/担当報告の22件は誤計数で、証拠JSONの20件が正しい。保護20件、管理1057件、baselineは別の母集団。

forwardの初回fixtureは`.gitignore`未配置による試験失敗と、意図して置いた独自provider skillによる更新前からのcheck不一致を検出。失敗を残したまま、別controlで正規の案件初期ファイルを置き、旧check成功→更新→新check成功、案件2成功、全434件中433成功/0失敗/1skipを確認した。独自skillは不一致解消のために削除しなかった。公開0.5には候補CLIを混ぜず、次回の案件内CLI起動は別の合成1.x fixtureで確認している。

要件statusはdraft、taskは技術確認後もverifying。正式採用・版上げ・公開は未実施。この候補を公開済み0.5.0へ混ぜたり、同版の配布物を作り直したりしない。未採用HARD-03は別候補のまま保持した。実Claude Code/Copilotのモデル起動、Node22実機、他OS、実案件適用、供給元署名認証は未確認。

最終品質契約は独立担当がreviewsのみ追記し、`delivery check --phase verify`を親担当も再実行してfindings=[] / recordedExecutions=7 / certifiesAcceptance=falseを確認。技術レビューは未解消指摘なし。正式採用や実案件受入をこの診断から推定しない。

## コストと限界

新依存なし。追加contextは更新時だけ短いskillと必要な手順を読む。sourceは全hash照合のI/Oとlocal snapshot容量を使い、上限はmanifest 8MiB / 8192 files / 64MiB per file / total 256MiB。既存backup/snapshotは勝手に消さない。人が必要な箇所は更新元信頼、計画、競合/手動移行、復旧、採用判断。任意コマンドや同一権限の敵対的writerを制約するOS sandboxではない。
