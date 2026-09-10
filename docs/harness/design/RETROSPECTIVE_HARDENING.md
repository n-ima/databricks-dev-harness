# 振り返り改善の設計

状態: 第1節のみ正式採用済み、その他はdraft / 2026-09-10。[採用判断](../decisions/ADR-0006-acceptance-integrity-adoption.md)。要件: [retrospective-hardening](../requirements/retrospective-hardening.md)。

## 1. 受入条件の完全性 — 正式採用済み

共有モジュール tools/lib/acceptance.mjs に文法と抽出・review coverageの検証を集約する。

- 大文字prefix + ハイフン + 数値suffixを既存互換とし、AC-D01などの大文字subprefix + 数値も許容する。IDを勝手に大文字化・修正・dedupeしない。
- Markdownの実際の定義行を対象とする。bullet（-/*/+）、任意のcheckbox、ID、ASCII colon、空でない本文。既存のheadingなし要件も利用可能とする。
- fenced code内の例は定義とみなさない。空の要件、文法不正、重複は別の診断とする。
- Acceptance criteria / 受入条件セクションでは、定義らしいが未対応の記法を無視せず拒否する。外の一般的な箇条書きまで受入条件と誤認しない。
- reviewとreceiptは、IDの妥当性、重複、要件との集合一致を検証する。要件でAC-D01が未検証なら、AC-01だけのレビューをsealもcloseも通さない。
- intake生成・intake承認・既存要件のproduct-intent承認でも共有検証を実施する。承認時の不正入力はファイル更新前に拒否する。
- accepted文書や古いreceiptの不正文法は明示的に拒否し、受入条件の内容を自動移行しない。旧receiptは既存policyHashにより変更後staleになり、再レビューが必要。
- 合成fixtureで正常系と反例を試す。今回の要件・reviewを使って自分の変更を自己承認しない。

独立契約レビューF-01〜F-03への具体化: [受入記法](../operations/ACCEPTANCE_CONTRACT.md)を本設計の一部とする。headingなしでも不正な定義候補を拒否する。先頭frontmatter・閉じたcomment/fenceの例は除外し、引用/表/番号/装飾/入れ子等の曖昧な定義は場所を示して拒否する。ATX/setextの正式範囲があっても範囲外の定義候補を黙って落とさない。intake承認は入力だけでなく、全artifactの更新予定文字列をメモリ上で構成し、最終要件を検証してから書込を始める。

独立実装レビューIR-01〜IR-03への補強: 見出しとUnicode bullet・不可視prefixも一貫した定義候補判定を通す。既存product-intent承認では解析済み要件bytesと要件参照を固定し、session lock内で再照合する。sealではreview/要件の解析bytesをhash対象と一致させ、保存前に変更を検知する。receipt利用では要件hash照合とstatus/coverage解析を単一読取snapshotで行う。異なる時点の本文を混ぜた成功を防ぐものであり、同一OS権限の全writerを排除する保証ではない。

## 2. 配備の候補と承認

次のslice。現行CLIの公式plan/deployやApps project deployの能力を先に調べ、同じ処理を作り直さない。candidate（実行入力と構成のhash）、approval scope、deployment observationを別レコードとし相互参照する。

公式のplan適用だけではテスト合格・認証・healthまで保証しない。Appsはproject pathとApp名指定で挙動が変わり、検証・testの省略flagもある。対応するCLI版を明示し、サーバー受理と最終成功を区別する。最初は副作用のないfake adapterで停止・不一致・中断を検証し、未確認のlive adapterは有効にしない。

## 3. 再現性

fresh-templateはversioned fixtureを入力にする。実行元案件のproduct.config/apps/workを複写して別名setupする方式を止める。再setupの同名許容と改名拒否は保持する。

AppKitの想定ルートと実ルートは、限定した候補だけをパス境界・symlink・package.jsonで調べる。未知・複数候補は差分を提示して停止し、生成物の勝手な移動や既存ディレクトリの削除はしない。mock Bundleの隔離が正しい実ルートへ適用されることも必要。

## Tradeoffs

共有検証の厳格化は、以前黙って無視した曖昧な文書を拒否する互換性コストを伴う。それは受入条件を欠落させる成功より安全だが、場所・ID・理由を表示し人が内容を保持して修正できる必要がある。最先端モデルでも安全性の境界はモデルの自己申告へ移さない。追加の抽象化は測定された効果に応じて採否を判断する。
