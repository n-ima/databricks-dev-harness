# 品質契約の設計候補

Status: proposed; not adopted. 2026-09-14.

要件: [HARNESS-DELIVERY-ASSURANCE](../requirements/2026-09-14-delivery-assurance.md)

## 境界

既存session/task/approval/evidenceを置換しない。追加の契約を読取専用で診断する。正式採用前はintake、hooks、session close、distributionに結線しない。新しいpolicyの自己採用を防ぐ。

## 成果物

案件の要件・設計・API仕様はdocs/product、テスト計画・結果はworkに置く。今回の例はharnessの候補fixtureであり案件そのものではない。契約は既存文書への参照とIDの対応を持ち、同じ設計本文を再記述しない。

## 診断モデル

requirements、risks、interfaces、testCases、operations、reviewsを対応付ける。designでは構造と検討の不足、verifyでは結果・証拠・snapshotも検査する。返すのはdiagnostic findingsであってaccepted/pass receiptではない。実際の品質は独立した意味レビューと実環境の確認が必要。

詳細な形式・運用は[候補ガイド](../../../work/candidates/delivery-assurance/README.md)に記録する。既存のチェックに自動追加するのは正式採用後の別変更。

## 独立設計レビューで具体化した条件

元の要件ファイルを必須とし、既存acceptanceIdsで得る全ACと契約のrequirementsを過不足なく照合する。新しいMarkdown parserは作らない。APIは最初の縦切りをHTTPに限定し、OpenAPI 3.1/3.2のJSON pathsのoperationIdを照合する。YAML、path $ref、callbacks、webhooks、3.2 additionalOperationsは未対応として診断する。OpenAPI全仕様のvalidatorを独自実装しない。

実行basisは結果・レビューを除いた契約全体のcanonical JSONをhashする。そこには要件bytesと選択した実装・テスト・API・運用文書のhash、テスト定義が含まれる。review hashはレビュー配列を除いた全体で、実行結果と証拠参照も含む。参照ファイルは読んだbytesで検査する。選択artifactの網羅性、実行事実、本人認証はこのhashでは保証しない。

designはresult:nullを許容するが実行済みとはしない。verifyはfail/not-run/blocked/nullを未合格として診断する。予定環境と観測環境は完全一致が必要で、localはdev/prodの代わりにならない。適用外には理由を要求するが、その妥当性は独立レビュー対象。運用項目すべてに一律の自動テストは要求せず、適用する項目のrunbook参照と必要な試験を保持する。

## 読取境界

repo相対path、通常file、各1 MiB、全体16 MiB、最大128参照file。contractは1 MiB、配列は各1000要素以下。絶対path、UNC、親参照、隠しfile、Windows予約名、symlink/junctionとその親経由を拒否する。commandは記録であって実行しない。URLへ接続せず、OpenAPIの外部参照をfetchしない。同権限の敵対processとTOCTOU全般を防ぐOS sandboxではない。

## 採用と将来の統合

候補はwork/candidates内に置き、既存tools/lib policy hashと配布対象を変えない。正式採用後に共通モジュールへ移し、intakeの設計確認・build前のテスト計画・reviewの対象へ段階的に接続する。人にJSONの作成を求めない。agentが既存文書から生成し、一覧を提示する。移設・provider資産生成・gateへの接続・downstream更新は別途検証する。
