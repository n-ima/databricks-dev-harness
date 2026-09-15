# UI設計整合性: 最終独立レビュー

- 確認日: 2026-09-16 JST
- reviewer actor: `/root/ui_fidelity_design_review`
- reviewer context: `20260916-ui-fidelity-final-review`（実装担当とは別context）
- 判定: **UIF-01〜04のローカル改善候補は合格。未解消の阻害指摘なし。** 正式採用・リリース・既存案件への更新を承認したものではない。
- 品質契約: `work/quality/2026-09-15-ui-runtime-fidelity.json`
- reviewedSha256: `b0316bb6989ffdca1fba239708ed56e4d7e451eec96f5c0e2e5451562817b150`
- basisSha256: `9c08fd7bde19d5f911575ec2705cfabcaf60c60c8fe52d6edfb477720e61d15a`

## 最終確認

| 要件 | 独立に確認した内容 | 判定 |
|---|---|---|
| UIF-01 | AGENTS、文書標準、FRONTEND、生成計画、5skill、開始hookが設計からApps/実部品を既定とする。両providerの10コピーはcanonicalとbyte一致。独立forward出力も旧span/CSSを承認済みとせず保持し、データ/項目/遷移設計を先行して初期化を停止している | ローカル候補の範囲でpass |
| UIF-02 | target/session/app/依存版/source/style/fixture/state/reviewの契約を照合。明示例外、自己review拒否、UIF-C01の依存spec/lock不整合修正を再検証 | pass |
| UIF-03 | 承認作成・通常buildのui-approval-check・loop継続/実行後/完了で古い承認を拒否。新契約の再レビューだけで旧人承認を再利用しない。runtime-htmlのpreview/mock区別、読取専用診断、出力junction拒否を再検証 | pass |
| UIF-04 | 独立反例と通常/拒否/例外/旧版移行/非UIの合成回帰を実行。既存security試験を保持。未採用差分・旧公開版を照合し、実provider/画面/Databricks未検証を明記 | pass |

CLI_REFERENCEの旧integration-init/画面移植例も訂正済み。scaffoldは共通validatorで再生成を許可するのではなく、新旧integration-init計画を拒否する。既存fixture appを通常buildで拡張する互換性変更を設計・手順に明記し、隔離Bundle/markerを自動解除しない。旧紙芝居・文書・承認・アプリを保存して、差分補完と人の再確認へ進める説明になっている。

## 実行と証拠

本担当が最終候補で再実行した狭い試験:

```text
node --test work/evidence/2026-09-15-ui-fidelity-final-independent.test.mjs work/evidence/2026-09-15-ui-fidelity-independent.test.mjs tests/ui-contract.test.mjs tests/approval.test.mjs
76 tests / 76 pass / 0 fail / 0 skip
独立45件 + 最終追加入口の独立5件 + 本体UI/承認26件
```

原ログ: `work/evidence/2026-09-15-ui-fidelity-final-independent.log`。再実行可能な照合手順は `work/evidence/2026-09-15-ui-fidelity-final-audit.mjs`、参照hash・結果は `work/evidence/2026-09-15-ui-fidelity-final-audit.json`。

実装担当の全回帰原ログ `work/evidence/2026-09-15-ui-fidelity-UIF-T03.log` は658件、657 pass、0 fail、1 skip。独立にログと品質契約のhashを照合した。本担当が全658件をこの最終確認で再実行したとは主張しない。skipはホストのfile-symlink作成権限による既存distribution試験1件。今回のjunction拒否試験は実行成功している。

品質契約の要件・artifact・実行ログの計35参照が一致し、design診断は指摘0。品質契約の4ケース、リスクUIF-R01/02、運用6観点の対応を確認した。外部HTTP/APIを追加していないためinterfacesは空で適切。レビューを追記した後のverify診断は `work/evidence/2026-09-15-ui-fidelity-final-quality-verify.json` に別途保存する。診断0件は業務受入や実環境成功の証明ではない。

## 保持と未採用差分

前回公開時の保存hashと照合し、HARD-03専用8ファイルを保持。tools/harness.mjsとdistribution.mjsは今回のUI追加行だけを除くと以前のhashに一致する。CLI_REFERENCEの既存scoped-approval説明も保持しており、今回はUI手順だけが変更されている。

0.4.0/0.5.0/0.6.0/0.6.1のmanifestと全4204 payloadファイルを独立照合し、不一致0。新リリースを作成していない。

全回帰と品質契約は**未採用HARD-03を含む作業ツリー**を対象にしている。UI候補だけを分離した公開payloadの検証ではない。将来の正式採用・公開時は、未採用差分を誤って同梱せず、選択した配布snapshotで改めて検証する必要がある。

## 限界

合成fixtureとstubによるコード検証であり、実AppKit部品の描画、実Claude Code/GitHub Copilot、実Databricks、添付の実案件は未検証。別agentのforward出力は自然言語の設計フロー確認であり、ブラウザー実画面試験ではない。

hash/構造検査は列挙した証拠の整合を調べる。全import graphの列挙、pixel一致、実行事実、人の実在、虚偽のレビューまで機械的に証明しない。これらは別contextで元要件から逆に確認する意味レビューと、人が実部品の画面を確認する工程を併用する。任意shellを遮断するOS sandboxとは異なる。

## 主な最終source SHA-256

```text
tools/lib/ui-contract.mjs cb2dfb2b1f782492557577480e52931c326637bc9073aa788552f25ae0c169df
tools/lib/approval.mjs 5636a238d15de0587221b80ade9899eb93e232223c8decde6503e778eff3a9d9
tools/lib/loop.mjs f1a6ae9de6e2890e6b864762b24adc3f0ec081e333c7f7371e42324e7490009d
tools/lib/scaffold.mjs d1b95ff08738c880c099ca19a4c2643ba9b290494e454c631f6dbc9c2d40cbf8
tools/lib/delivery-assurance.mjs 1edba05733cf24eba80c4d10f2b45d5dd6e784c966c94e41bec9c45af1592717
tools/harness.mjs 3f08bdc9af3b02691ebb9f1d8b56bd4f0a1c6d646f836ca628676859f2564ee6
docs/harness/operations/UI_RUNTIME_FIDELITY.md f274f1cd29484cf999fb28c2bd51cf49e051b153f45462f4eacd818b570d917a
docs/harness/operations/CLI_REFERENCE.md 36dbb161756ee7082035a3f1653bdeb8993468cf7f1e1c356d8e8d4135167f74
```

他の対象と証拠のhashは最終audit JSONを正本とする。これらのsourceまたは実行結果を変更した場合、古い本レビューを現在の候補の確認として流用しない。
