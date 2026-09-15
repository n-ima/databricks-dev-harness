# 0.6.1最終snapshotの公開前独立レビュー

2026-09-15。担当 `/root/publication_061_review`。判定: FIX-01〜03に阻害指摘なし。FIX-04のpush/remoteは未実施。旧公開PUB-01〜04は原0.6.0の証拠を読み直し、本文不変を確認した。

対象は `.harness/runtime/publish-0.6.1-final`、manifest SHA-256 `d9c637a2c5a25182b58ce67c71792ccf02b1920ec22cc37f70afb209d71d726d`、1068管理ファイル。Windows / PowerShell / Node.js v24.15.0。独立担当は実装・権限・GitHubを変更していない。

| 条件 | 確認した証拠 |
|---|---|
| FIX-01 | 原公開commit69ebf2eの要件全文と、PUBをP060へ逆置換した最終文書が完全一致。parser/evidence/更新CLI/distribution/hookは不変。正常seal成功、欠落・重複・旧ID・未知IDを拒否しreceiptを上書きしない。not-run入りsealはfailとなり完了用validateを拒否 |
| FIX-02 | 実文書2試験のred2件・green2件を読取り、最終snapshotでcheckとcontracts58件を独立実行し全成功。主担当の同manifest全回帰584件/583pass/0fail/1skip、fresh Gitのautocrlf=true byte照合を確認。全回帰そのものを独立再実行したとは主張しない |
| FIX-03 | 全1068のsource/payload/Git indexを独立照合。隔離した真正0.6.0案件内CLIから6update/1add/0delete。案件12files・旧base manifest保持、全1068hash一致、backup6files/旧baseline一致、競合plan/apply拒否と拒否後不変、導入版0.6.1・次回1068keep、案件試験前後成功、新process既存session読取りを確認。旧0.4/0.5/0.6配布物全filesとroot候補11filesを保持 |
| FIX-04 | 正式レビューJSONの事前seal結果は別証拠へ記録する。pushとremote一致は未確認なのでnot-runを維持 |

旧公開の採用・HARD-03除外・1067管理bytes・旧0.4/0.5からの更新・各20案件files保持・通常pushは、0.6.0の要約、forward、remote、公開前後レビューを読み直した。原公開SHAは `69ebf2ebe33da2bc3a551970e40fb5edca9667b7`、旧manifestは `4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c`。当時のprivate/template/main一致、workflow/check runs各0件という観測を維持する。今の0.6.1公開成功を示すものではない。旧品質JSON・レビュー・受入JSONは不変で、新しい正式PUB IDのレビューを別に記録する。

最初のcandidateでのauditと未適用forward計画は履歴。FIX-04の自己参照を主担当が公開前に検出し、受入から必須完了手順へ分離した後、別のfinal snapshotで上記を再検証した。この分離を独立設計レビューで確認した。

証拠: [audit](../evidence/2026-09-15-publication-061-independent-final-audit.json)、[forward](../evidence/2026-09-15-publication-061-independent-final-forward.json)、[契約試験](../evidence/2026-09-15-publication-061-independent-final-contracts.json)、[全回帰](../evidence/2026-09-15-publication-061-full.log)、[fresh Git bytes](../evidence/2026-09-15-publication-061-bytes.json)。全manifestは繰り返し複製せず、runner・manifestと各実行記録へ参照を残す。

未確認: 0.6.1のpush/remote/CI、実案件、実providerモデル、Databricks、他OS、Node22実機。fixtureは一時領域 `publication-061-forward-jafjLg` に保持した。実案件受入や本人認証をhash一致から推定しない。
