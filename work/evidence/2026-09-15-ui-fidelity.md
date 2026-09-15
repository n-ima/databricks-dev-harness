# UI設計のApps整合性 — ローカル候補の検証記録

対象session: `20260915-143222-315-ui-runtime-fidelity`。実施開始2026-09-15、最終確認2026-09-16 JST。

## 結論と原因

従来の説明は不正確だった。本実装/実行モックではAppKit・部品再利用を定めていたが、設計紙芝居は依存なしHTMLを推奨し、実部品との対応が必須になっていなかった。単にagentが守らなかったと断定できず、規約の矛盾と承認検査の不足がある。

旧動作は `ui-fidelity-red.log` に再現済み。spanによる近似HTMLに対する承認拒否を期待した試験が、承認されてしまい失敗した。候補では同試験が成功する。

## 変更

- 設計からAppsを既定、AppKitを標準部品とし、明示された外部hosting/別frameworkだけ例外とする。実部品由来の静的HTMLは視覚確認のみ。操作確認は同じアプリのfixture。
- 文書/設計生成/5skill/両provider生成コピー/開始hookを整合。旧CLIの移植例を削除して同じappを通常buildへ引き継ぐ手順に変更。
- UI契約で要件・設計・appRoot・版・参照source/style/fixture・画面/状態・独立レビューを束縛。通常buildでも現session/appの人の承認receiptを再検査可能。
- UI承認作成、loopの承認利用・実行前後・完了で再検証。新旧integration-initの再生成を拒否。fixture-only初期化の認証/隔離/MUSTルール/上書き保護は維持。
- 独立レビューで依存宣言と解決版の矛盾受入を追加発見し修正。対応npm specの範囲を文書化。下書きのリンク経由書込みも拒否。

## 証拠

| 検証 | 結果と境界 |
|---|---|
| `UIF-T01.log` | harness check成功。生成コピーと参照整合。実Claude/Copilotの動作確認ではない |
| `UIF-T02.log` | 承認・契約の正常/拒否回帰。合成fixtureのみ |
| `UIF-T03.log` | 全658件、657成功、0失敗、1skip。未採用HARD-03を含む既存作業ツリーでの回帰であり、UI候補だけの配布検証ではない |
| skip | ホストがfile symlinkを許可しないため既存distribution試験1件をskip。今回のUI出力ancestor-junction拒否試験は実行成功 |
| `UIF-T04.log` | 別contextが作成した独立45ケース成功。実AppKit画面ではない |
| `ui-fidelity-forward-design.md` | 期待回答を渡さない別agent試行の実出力。旧HTMLを保持し未承認と明記、項目/データ関係/状態の設計を先行、接続未選択で初期化停止 |
| skill形式 | 5skill成功。Windows既定cp932で日本語skillの読取が失敗したため、Python `-X utf8` を明示して再実行。意味の正しさを形式検査だけでは証明しない |
| `git diff --check` | 成功 |

品質契約: `work/quality/2026-09-15-ui-runtime-fidelity.json`。4ケースとリスク/運用の対応、実行basisとログhashを保存。設計診断は指摘0。最終の独立レビューとverify診断はその専用記録を正本にする。

## 未実施・保持境界

実案件のソース・画面・DB、実AppKitの描画、実Claude Code/GitHub Copilot、実Databricksには接続/変更していない。添付のTree/DataTable等のAPI説明を検証済みとはしていない。

正式採用・commit・push・リリース・既存案件への更新は未実施。公開版0.6.1とその配布payloadは変更していない。HARD-03の既存差分は保持。共有ファイルの `tools/harness.mjs` はUI help、`CLI_REFERENCE.md` はUI手順、`distribution.mjs` は今回の2test配布対象だけを追加し、HARD-03のhunkは変更していない。

機械検査は列挙した参照と記録の整合を検査する。完全なimport graph、画面一致、実行事実、人の実在は証明しない。標準の承認入口を使わない任意shellを遮断するsandboxでもない。選択漏れ/部品対応/実画面の意味は別contextレビューと人の確認が必要。

正式採用する場合の互換性変更は、旧UI承認の補完/再確認と `scaffold --purpose integration` の停止。既存案件は公開された新版で安全な更新計画を作り、新contextで差分を確認する。旧HTMLやアプリを削除・全面再生成する必要はない。
