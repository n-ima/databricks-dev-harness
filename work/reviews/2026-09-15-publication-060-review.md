# 安全更新0.6.0公開前の独立レビュー

2026-09-15。担当: `/root/publication_060_review`。実装・公開担当とは別context。判定: **P060-01〜03とSU-01〜05の限定範囲に未解消の阻害指摘なし**。P060-04はpush前のため未確認。

## 対象と境界

固定snapshotは`.harness/runtime/publish-0.6.0`。Windows / PowerShell / Node.js v24.15.0で検証した。AGENTS、orchestrate-work、improve-harness、review-work、release-work、文書/品質/安全標準、採用要件とADR-0011、SAFE_LOCAL_UPDATE設計/運用、旧bridge、従来の独立レビューを読んだ。実装・managed文書・受入条件は編集せず、レビューと証拠、および依頼されたwork内品質契約の公開版再検証だけを記録した。

manifest SHA-256は`4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c`、管理ファイル1067件。全件について公開snapshot・配布payload・公開予定Git index blobを独立照合した。snapshot内の全pathを確認しscoped-approval/SCOPED_APPROVALSがなく、tools/harness、distribution、CLI_REFERENCEのcandidate import/dispatch/説明もない。元ツリーの候補等11filesは組立時hashと試験後hashが一致した。旧0.4.0/0.5.0配布物は全1012/1057filesを照合し、試験前後で不変。

## 受入と実行結果

| 条件 | 独立に確認した内容 |
|---|---|
| P060-01 | ADRとaccepted要件の採用範囲が一致。公開版からHARD-03を除き、元候補・旧配布物を保持 |
| P060-02 | 全1067のsnapshot/payload/index byte一致と独立check成功。主担当のfresh Git/core.autocrlf=true一致、全582件581pass/0fail/1skipの記録も同manifestで照合 |
| P060-03 | 真正な旧0.4/0.5から0.6への外部CLI導入、案件内CLI次回plan、各20files保持・競合停止、初回/次回日本語案内を確認 |
| SU-01 | Gitなしclean sourceと配布物で両旧版のoperations一致。plan時点の管理bytes/案件bytes/baseline不変。専用試験でdirty sourceの固定版選択と元source後変更の隔離を確認 |
| SU-02 | 二つの旧版案件で各20files、旧base manifest、binary/CRLF/設定/秘密fixtureを保持。独自編集・削除・未知衝突の全体停止を専用試験、実payloadの編集競合をforwardで確認 |
| SU-03 | 未知元版、対象取り違え/包含/drive root、source/target/managed parent junction、改変・path/size不正・未知/重複引数・無承認・stale/snapshot改変を拒否。指定source scriptは実行しない |
| SU-04 | 全管理hash後に導入版記録。旧0.4/0.5で更新前backup47/11filesと旧installed bytes一致。keep破損と削除file復活を注入し、interrupted journal・旧baseline保持・replay拒否を確認 |
| SU-05 | 3表記の自然言語route、canonical/Claude/Copilot生成skillのbyte一致。公開版を外部起動したあと案件内CLIで次回plan成功。実providerモデル試験と区別 |
| P060-04 | pushとremote/CIは未確認。公開完了とは判定しない |

独立実行は`tests/update-entry.test.mjs`の15件と、前独立レビューの反例を公開snapshot moduleへ向けた追加12件、計27pass/0fail/0skip（4608.002ms）。既存反例のコピーであり、今回初めて発案した12件とは数えない。主担当の全回帰を独立再実行したとは主張しない。

| 旧版 | 管理差分 | 更新後 | 保持・backup | 次回案件内CLI |
|---|---|---|---|---|
| 0.4.0 | update47/add55/delete0 | 1067hash一致 | 案件20files不変、backup47と旧installed一致 | 0.6→0.6 planは1067keep |
| 0.5.0 | update11/add10/delete0 | 1067hash一致 | 案件20files不変、backup11と旧installed一致 | 0.6→0.6 planは1067keep |

0.4はGitなしsourceのCLI、0.5は配布物のCLIを外部cwdから`--target`付きで起動した。両形式のplanは両版で比較した。計画の対象/版/件数/競合0/削除0とmanual-reviewを読んでから、許可されたfixtureのみ適用した。各版で無承認、AGENTS独自変更の競合、古い計画の適用を拒否し、拒否後に管理/案件/baseline不変を確認。試験が注入した差分だけを戻し、fresh planで適用した。実際の案件差分を戻したものではない。

両版とも更新前後harness check成功、案件の計算/異常入力2tests成功。新processで既存sessionを読めた。次の本物の公開版は存在しないため同版planまで確認し、別の合成版試験で案件内CLIによる1.2→1.3 planと0.6→0.7 plan/applyを補った。実案件/新モデルcontextの業務再開の証明ではない。

## 案内・品質契約の意味確認

初回に0.4/0.5自身の旧CLIへ新allowlistを足す必要はない。信頼済み0.6実行器とsourceデータを分け、明示target、真正なbaseline、固定source、計画説明、書込み停止、失敗時journal/backup照合を案内する。hash一致は本人認証や案件受入ではない。providerの無条件syncで独自skillを消さない説明は実装と整合する。

品質契約は候補記録を保存したうえ、公開snapshotの要件・実装・設定・運用hashと今回の結果に更新した。SU-01〜05、RISK-OWNERSHIP/SOURCE/COMPLETION、運用6項目の対応を確認。HTTP interfaceなしはローカルCLI/ファイルのみの範囲と整合する。TC-SU-06は実公開0.4/0.5→0.6と導入後の次回入口の証拠に対応させ、合成版の範囲も明記した。費用はローカルI/O/保存容量、依存はNode標準APIで、案件packageは保持する。

契約basis=`46b50104476578f8335e4d8e4da15761280492f87c1b56fbfbf55674ae57840b`、reviewedSha256=`d15e1b76a4d92bdad016225d269fc6bbb30b9f4a76eaea8b009447d8d9b3309f`。clean snapshotでの最終診断は[品質検証記録](../evidence/2026-09-15-publication-060-independent-quality-verify.json)へ保存する。診断の`certifiesAcceptance:false`を維持し、P060-04・実案件承認・本人認証へ転用しない。

## 証拠と未実施

- [要約](../evidence/2026-09-15-publication-060-independent-summary.json)、[全hash監査](../evidence/2026-09-15-publication-060-independent-audit.json)、[独立27件](../evidence/2026-09-15-publication-060-independent-tests.json)、[forward全照合](../evidence/2026-09-15-publication-060-independent-forward-result.json)。
- [再現runner](../evidence/2026-09-15-publication-060-independent-runner.mjs)のaudit→prepare→計画確認→apply。再実行時は証拠prefixを変え、既存証拠を上書きしない。全argv/cwd/終了値/stdout/stderrを各実行JSONに保存。
- 専用temp `C:/Users/nimao/AppData/Local/Temp/publication-060-forward-xVFJKa` に二つの案件・snapshot・backup/journalを保持。実案件、Databricks、ネットワーク、実Claude/Copilot、Linux/macOS、Node22実機、clone/ZIP取得・解凍、Git branch運用は未実施。供給元本人認証や敵対的同一OS権限writerの隔離は保証しない。
- 初回runnerの括弧構文誤りを実行前に修正した。製品不具合ではない。sandbox helper起動失敗後は許可されたrequire_escalatedでローカル読取・隔離試験を実行した。
